import { createIsomorphicFn } from "@tanstack/react-start";

import { fetchApiDuringSsr } from "./api-upstream.server";

/**
 * Absolute origin for API clients during SSR. Server code cannot fetch
 * relative URLs, but the host is never used: {@link apiFetch} keeps only the
 * path and sends it through the `API` service binding (or local API origin).
 */
export const SSR_API_PLACEHOLDER_ORIGIN = "http://api.internal";

/**
 * `fetch` for Better Auth and oRPC clients.
 *
 * - Browser: same-origin `/api/*` (Vite proxy locally, `/api/$` server route
 *   → `API` binding when deployed).
 * - Server (SSR `beforeLoad`): forwards the incoming Cookie header so auth
 *   guards see the real session on hard refresh.
 */
export const apiFetch = createIsomorphicFn()
  .server((input: RequestInfo | URL, init?: RequestInit) => fetchApiDuringSsr(input, init))
  .client((input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, { ...init, credentials: "include" }),
  );
