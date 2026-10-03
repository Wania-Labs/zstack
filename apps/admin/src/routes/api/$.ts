import { createFileRoute } from "@tanstack/react-router";

import { sendToApi } from "@/lib/api-upstream.server";

/**
 * Same-origin `/api/*` → API Worker. Deployed, this forwards through the `API`
 * service binding (`infra/admin.ts`); plain `vite dev` never reaches it because
 * the Vite proxy answers `/api` first. Method, headers (cookies), streamed
 * body, and redirects (`redirect: "manual"`) pass through untouched.
 */
/** Staff console only needs auth and oRPC; objects and webhooks stay off this origin. */
const ADMIN_API_PREFIXES = ["/api/auth/", "/api/rpc/"];

function isAdminApiPath(pathname: string): boolean {
  return ADMIN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: ({ request }) =>
        isAdminApiPath(new URL(request.url).pathname)
          ? sendToApi(request)
          : new Response("Not found", { status: 404 }),
    },
  },
});
