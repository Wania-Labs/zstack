import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { betterAuthAdminRoles } from "@zstack/auth-access/admin-roles";

/**
 * Same-origin auth via Vite `/api` proxy → apps/api.
 * Omit baseURL so the browser uses the current origin.
 */
export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    adminClient({
      roles: betterAuthAdminRoles,
    }),
  ],
});
