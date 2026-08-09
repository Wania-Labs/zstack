import type { BetterAuthOptions } from "better-auth";
import { admin, organization } from "better-auth/plugins";

/**
 * Shared Better Auth options. Database/baseURL/secret are supplied per runtime.
 * Email delivery stays a no-op until the email layer lands.
 */
export const betterAuthOptions = {
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
    admin(),
  ],
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: false, // local only; Alchemy/production will force secure cookies
      httpOnly: true,
    },
  },
} satisfies BetterAuthOptions;
