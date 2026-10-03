import { Effect } from "effect";
import type { Context } from "hono";

import { authorizeObjectKey } from "../modules/objects/access";
import { ObjectStore } from "../platform/object-store/object-store-service";
import type { ApiEnv } from "./context";
import { reportError } from "./report-error";

type ObjectContext = Context<ApiEnv>;

/** Upload ceiling for Worker-mediated bytes. Larger files should use presigned R2 URLs. */
export const MAX_OBJECT_UPLOAD_BYTES = 25 * 1024 * 1024;

const OBJECT_PATH_PREFIX = "/api/objects/";

/**
 * Types the browser may render inline. SVG is excluded: it can carry script.
 * Everything else is served as an attachment.
 */
const INLINE_IMAGE_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MIME_ESSENCE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/;

/** Lowercased `type/subtype` without parameters, or undefined when malformed. */
export function mimeEssence(value: string | null | undefined): string | undefined {
  const essence = value?.split(";")[0]?.trim().toLowerCase();
  return essence && MIME_ESSENCE_PATTERN.test(essence) ? essence : undefined;
}

/**
 * Response headers for stored bytes. The API shares the app origin, so
 * uploaded HTML/SVG must never render as a document there.
 */
export function objectResponseHeaders(contentType: string | undefined): Headers {
  const essence = mimeEssence(contentType);
  const inline = essence !== undefined && INLINE_IMAGE_TYPES.has(essence);
  return new Headers({
    "content-type": essence ?? "application/octet-stream",
    "content-disposition": inline ? "inline" : "attachment",
    "x-content-type-options": "nosniff",
    "content-security-policy": "sandbox",
    "cache-control": "private, no-store",
  });
}

type KeyResult = { kind: "ok"; key: string } | { kind: "missing" } | { kind: "malformed" };

function objectKeyFromUrl(url: string): KeyResult {
  const pathname = new URL(url).pathname;
  if (!pathname.startsWith(OBJECT_PATH_PREFIX)) {
    return { kind: "missing" };
  }
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice(OBJECT_PATH_PREFIX.length)).trim();
  } catch {
    // Malformed percent-encoding is a client error, not a server failure.
    return { kind: "malformed" };
  }
  return key ? { kind: "ok", key } : { kind: "missing" };
}

/**
 * Resolve and authorize the key for the signed-in caller, or return the
 * error response to send.
 */
function authorizedKey(c: ObjectContext, action: string): string | Response {
  if (!c.get("user")) {
    return c.json({ error: `Sign in to ${action} objects.` }, 401);
  }

  const parsed = objectKeyFromUrl(c.req.url);
  if (parsed.kind === "malformed") {
    return c.json({ error: "Object key is not valid." }, 400);
  }
  if (parsed.kind === "missing") {
    return c.json({ error: "Object key is required." }, 400);
  }

  const decision = authorizeObjectKey(parsed.key, c.get("requestContext"));
  if (decision === "invalid") {
    return c.json({ error: "Object key is not valid." }, 400);
  }
  if (decision === "forbidden") {
    return c.json({ error: "You do not have access to this object." }, 403);
  }
  return parsed.key;
}

type BodyResult = { kind: "ok"; body: Uint8Array } | { kind: "too_large" };

/**
 * Read the request body, refusing early on a declared oversize length and
 * aborting mid-stream when undeclared/chunked bodies exceed the cap.
 */
export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<BodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes) {
      return { kind: "too_large" };
    }
  }

  if (!request.body) {
    return { kind: "ok", body: new Uint8Array() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { kind: "too_large" };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { kind: "ok", body };
}

const putObject = Effect.fn("putObject")(function* (input: {
  key: string;
  body: Uint8Array;
  contentType?: string;
}) {
  const store = yield* ObjectStore;
  yield* store.put(input);
});

const getObject = Effect.fn("getObject")(function* (key: string) {
  const store = yield* ObjectStore;
  return yield* store.get(key);
});

const deleteObject = Effect.fn("deleteObject")(function* (key: string) {
  const store = yield* ObjectStore;
  yield* store.delete(key);
});

/**
 * Worker-mediated object bytes. Used when R2 S3 API tokens are unset.
 * With tokens, sign intents return a presigned R2 URL instead.
 */
export async function putObjectHandler(c: ObjectContext): Promise<Response> {
  const key = authorizedKey(c, "upload");
  if (key instanceof Response) {
    return key;
  }

  const read = await readBodyWithLimit(c.req.raw, MAX_OBJECT_UPLOAD_BYTES);
  if (read.kind === "too_large") {
    return c.json({ error: "Object is too large." }, 413);
  }

  const contentType = mimeEssence(c.req.header("content-type"));

  try {
    await c.get("runEffect")(
      putObject({ key, body: read.body, ...(contentType ? { contentType } : {}) }),
    );
  } catch (error) {
    reportError(c.get("log"), error, "objects.put");
    return c.json({ error: "Object store failed." }, 500);
  }

  return c.body(null, 204);
}

export async function getObjectHandler(c: ObjectContext): Promise<Response> {
  const key = authorizedKey(c, "download");
  if (key instanceof Response) {
    return key;
  }

  try {
    const stored = await c.get("runEffect")(getObject(key));
    if (!stored) {
      return c.body(null, 404);
    }
    return new Response(stored.body, {
      status: 200,
      headers: objectResponseHeaders(stored.contentType),
    });
  } catch (error) {
    reportError(c.get("log"), error, "objects.get");
    return c.json({ error: "Object store failed." }, 500);
  }
}

export async function deleteObjectHandler(c: ObjectContext): Promise<Response> {
  const key = authorizedKey(c, "delete");
  if (key instanceof Response) {
    return key;
  }

  try {
    await c.get("runEffect")(deleteObject(key));
  } catch (error) {
    reportError(c.get("log"), error, "objects.delete");
    return c.json({ error: "Object store failed." }, 500);
  }

  return c.body(null, 204);
}
