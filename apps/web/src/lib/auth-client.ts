import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

/**
 * Same-origin auth via Vite `/api` proxy → apps/api.
 * Omit baseURL so the browser uses the current origin.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient(), adminClient()],
});
