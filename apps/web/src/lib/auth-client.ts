import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

import { SSR_API_PLACEHOLDER_ORIGIN, apiFetch } from "./api-fetch";

/**
 * Browser: same-origin `/api/auth`. Server: an absolute placeholder base (Node
 * rejects relative URLs) whose requests `apiFetch` re-targets at the API with
 * the incoming Cookie header, so SSR `getSession` sees the browser session.
 */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? SSR_API_PLACEHOLDER_ORIGIN : undefined,
  fetchOptions: {
    customFetchImpl: apiFetch,
  },
  plugins: [organizationClient(), adminClient()],
});
