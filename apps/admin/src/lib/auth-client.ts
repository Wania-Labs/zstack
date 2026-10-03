import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { betterAuthAdminRoles } from "@zstack/auth-access/admin-roles";

import { SSR_API_PLACEHOLDER_ORIGIN, apiFetch } from "./api-fetch";

/**
 * Browser: same-origin `/api/auth` (Vite proxy locally, `/api/$` → `API`
 * binding deployed). Server: an absolute placeholder base whose requests
 * `apiFetch` re-targets at the API with the incoming Cookie header, so SSR
 * guards see the staff session on hard refresh.
 */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? SSR_API_PLACEHOLDER_ORIGIN : undefined,
  fetchOptions: {
    customFetchImpl: apiFetch,
  },
  plugins: [
    organizationClient(),
    adminClient({
      roles: betterAuthAdminRoles,
    }),
  ],
});
