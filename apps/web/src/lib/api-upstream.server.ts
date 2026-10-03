import { getRequest, getResponseHeaders } from "@tanstack/react-start/server";

/**
 * Server-only bridge from this TanStack Start Worker to the API Worker.
 *
 * - Deployed / `alchemy dev`: the `API` service binding declared in
 *   `infra/web.ts`, read from `cloudflare:workers` env.
 * - Plain `vite dev` on Node: no binding, so fall back to `API_ORIGIN`
 *   (default `http://127.0.0.1:8787`, the wrangler API Worker).
 */

type ServiceBinding = {
  fetch: (request: Request) => Promise<Response>;
};

// Indirect specifier so Vite on Node never tries to resolve the workerd-only
// module at transform time. Outside workerd the import rejects → fallback.
const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

// Hop-by-hop headers that undici's fetch rejects or that must not be forwarded.
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "host",
];

let apiBindingPromise: Promise<ServiceBinding | undefined> | undefined;

function isServiceBinding(value: unknown): value is ServiceBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { fetch?: unknown }).fetch === "function"
  );
}

function loadApiBinding(): Promise<ServiceBinding | undefined> {
  apiBindingPromise ??= import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE).then(
    (mod: { env?: Record<string, unknown> }) => {
      const binding = mod.env?.API;
      return isServiceBinding(binding) ? binding : undefined;
    },
    () => undefined,
  );
  return apiBindingPromise;
}

function localApiOrigin(): string {
  return process.env.API_ORIGIN ?? "http://127.0.0.1:8787";
}

function hasRequestBody(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

async function fetchLocalApi(request: Request): Promise<Response> {
  const source = new URL(request.url);
  const target = new URL(`${source.pathname}${source.search}`, localApiOrigin());
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) {
    headers.delete(name);
  }
  // Node's fetch decompresses bodies but keeps `content-encoding`; ask for
  // identity so the proxied response stays byte-accurate.
  headers.set("accept-encoding", "identity");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
    signal: request.signal,
  };
  if (hasRequestBody(request.method) && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }
  return fetch(target, init);
}

/**
 * Send a request to the API Worker without following redirects. The request
 * URL's path and query are preserved; its origin is ignored by the API.
 */
export async function sendToApi(request: Request): Promise<Response> {
  const binding = await loadApiBinding();
  let upstream: Response;
  try {
    upstream = binding
      ? await binding.fetch(new Request(request, { redirect: "manual" }))
      : await fetchLocalApi(request);
  } catch (error) {
    console.error("[api-proxy] upstream request failed", error);
    return new Response("API unavailable", { status: 502 });
  }

  // Re-wrap so headers are mutable for TanStack Start's response merging.
  return new Response(NULL_BODY_STATUSES.has(upstream.status) ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

function currentRequest(): Request | undefined {
  try {
    return getRequest();
  } catch {
    return undefined;
  }
}

/**
 * `fetch` for API calls made while rendering on the server (route
 * `beforeLoad` / loaders during SSR). Forwards the incoming request's cookies
 * so Better Auth sees the browser session, routes through {@link sendToApi},
 * and relays any `Set-Cookie` (session refresh / clear) onto the SSR response.
 */
const FORWARDED_CLIENT_HEADERS = ["cf-connecting-ip", "x-forwarded-for", "user-agent"] as const;

export async function fetchApiDuringSsr(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const incoming = currentRequest();
  const draft = new Request(input, init);
  const path = new URL(draft.url);
  const origin = incoming ? new URL(incoming.url).origin : localApiOrigin();

  const headers = new Headers(draft.headers);
  if (incoming) {
    const cookie = incoming.headers.get("cookie");
    if (cookie && !headers.has("cookie")) {
      headers.set("cookie", cookie);
    }
    // Keep the caller's identity for Better Auth's per-IP rate limits and
    // session metadata; otherwise every SSR call shares one bucket.
    for (const name of FORWARDED_CLIENT_HEADERS) {
      const value = incoming.headers.get(name);
      if (value && !headers.has(name)) {
        headers.set(name, value);
      }
    }
    // Better Auth rejects cookie-bearing mutations without a trusted Origin.
    // The SSR call acts for a request that already landed on this origin.
    if (!headers.has("origin")) {
      headers.set("origin", origin);
    }
  }

  const request = new Request(new URL(`${path.pathname}${path.search}`, origin), {
    method: draft.method,
    headers,
    redirect: "manual",
    ...(hasRequestBody(draft.method) ? { body: await draft.arrayBuffer() } : {}),
  });

  const response = await sendToApi(request);

  if (incoming) {
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      const outgoing = getResponseHeaders();
      for (const cookie of setCookies) {
        outgoing.append("set-cookie", cookie);
      }
    }
  }

  return response;
}
