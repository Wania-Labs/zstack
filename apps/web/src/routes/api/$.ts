import { createFileRoute } from "@tanstack/react-router";

import { sendToApi } from "@/lib/api-upstream.server";

/**
 * Same-origin `/api/*` → API Worker. Deployed, this forwards through the `API`
 * service binding (`infra/web.ts`); plain `vite dev` never reaches it because
 * the Vite proxy answers `/api` first. Method, headers (cookies), streamed
 * body, and redirects (`redirect: "manual"`) pass through untouched.
 */
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: ({ request }) => sendToApi(request),
    },
  },
});
