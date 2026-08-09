import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access";

const staffReaderAc = defaultAc.newRole({
  user: ["list", "get"],
  session: [],
});

/**
 * Same-origin auth via Vite `/api` proxy → apps/api.
 * Omit baseURL so the browser uses the current origin.
 */
export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    adminClient({
      roles: {
        admin: adminAc,
        owner: adminAc,
        support: staffReaderAc,
        operations: staffReaderAc,
        user: userAc,
      },
    }),
  ],
});
