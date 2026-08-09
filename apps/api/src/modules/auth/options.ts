import { betterAuthAdminRoleNames, betterAuthAdminRoles } from "@zstack/auth-access/admin-roles";
import type { BetterAuthOptions } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { Effect, type Layer } from "effect";

import { ConsoleEmailLive, EmailService, runEmailEffect } from "../../platform/email/email-service";

export type BetterAuthOptionsInput = {
  baseURL: string;
  emailLive?: Layer.Layer<EmailService>;
};

/**
 * Shared Better Auth options. Database/baseURL/secret are supplied per runtime.
 * Transactional mail goes through EmailService (console or Bento).
 */
export function createBetterAuthOptions(input: BetterAuthOptionsInput) {
  const emailLive = input.emailLive ?? ConsoleEmailLive;

  return {
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await runEmailEffect(
          Effect.gen(function* () {
            const email = yield* EmailService;
            yield* email.sendPasswordResetEmail({
              to: user.email,
              name: user.name,
              url,
            });
          }),
          emailLive,
        );
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await runEmailEffect(
          Effect.gen(function* () {
            const email = yield* EmailService;
            yield* email.sendVerificationEmail({
              to: user.email,
              name: user.name,
              url,
            });
          }),
          emailLive,
        );
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        async sendInvitationEmail(data) {
          await runEmailEffect(
            Effect.gen(function* () {
              const email = yield* EmailService;
              yield* email.sendInvitationEmail({
                to: data.email,
                inviterName: data.inviter.user.name,
                organizationName: data.organization.name,
                url: `${input.baseURL}/accept-invitation/${data.id}`,
              });
            }),
            emailLive,
          );
        },
      }),
      admin({
        roles: betterAuthAdminRoles,
        adminRoles: [...betterAuthAdminRoleNames],
      }),
    ],
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        // Local HTTP needs Secure=false. HTTPS BETTER_AUTH_URL forces Secure cookies.
        secure: resolveSecureCookies(input.baseURL),
        httpOnly: true,
      },
    },
  } satisfies BetterAuthOptions;
}

function resolveSecureCookies(baseURL: string): boolean {
  try {
    return new URL(baseURL).protocol === "https:";
  } catch {
    return false;
  }
}
