import { Effect } from "effect";
import type { Context } from "hono";

import type { ApiBindings } from "../platform/cloudflare/bindings";
import { runRequestEffect } from "../platform/effect/runtime";
import { ObjectStore } from "../platform/object-store/object-store-service";
import type { ApiVariables } from "./context";

type ObjectContext = Context<{ Bindings: ApiBindings; Variables: ApiVariables }>;

function objectKey(path: string): string | undefined {
  const prefix = "/api/objects/";
  if (!path.startsWith(prefix)) {
    return undefined;
  }
  const key = decodeURIComponent(path.slice(prefix.length)).trim();
  return key || undefined;
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
  if (!c.get("user")) {
    return c.json({ error: "Sign in to upload objects." }, 401);
  }

  const key = objectKey(c.req.path);
  if (!key) {
    return c.json({ error: "Object key is required." }, 400);
  }

  const body = new Uint8Array(await c.req.raw.arrayBuffer());
  const contentType = c.req.header("content-type") ?? undefined;

  try {
    await runRequestEffect(
      putObject({ key, body, ...(contentType ? { contentType } : {}) }),
      c.get("requestContext"),
      c.env,
    );
  } catch {
    return c.json({ error: "Object store failed." }, 500);
  }

  return c.body(null, 204);
}

export async function getObjectHandler(c: ObjectContext): Promise<Response> {
  if (!c.get("user")) {
    return c.json({ error: "Sign in to download objects." }, 401);
  }

  const key = objectKey(c.req.path);
  if (!key) {
    return c.json({ error: "Object key is required." }, 400);
  }

  try {
    const stored = await runRequestEffect(getObject(key), c.get("requestContext"), c.env);
    if (!stored) {
      return c.body(null, 404);
    }
    return new Response(stored.body, {
      status: 200,
      headers: {
        "content-type": stored.contentType ?? "application/octet-stream",
      },
    });
  } catch {
    return c.json({ error: "Object store failed." }, 500);
  }
}

export async function deleteObjectHandler(c: ObjectContext): Promise<Response> {
  if (!c.get("user")) {
    return c.json({ error: "Sign in to delete objects." }, 401);
  }

  const key = objectKey(c.req.path);
  if (!key) {
    return c.json({ error: "Object key is required." }, 400);
  }

  try {
    await runRequestEffect(deleteObject(key), c.get("requestContext"), c.env);
  } catch {
    return c.json({ error: "Object store failed." }, 500);
  }

  return c.body(null, 204);
}
