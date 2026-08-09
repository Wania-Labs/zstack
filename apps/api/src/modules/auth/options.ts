import type { BetterAuthOptions } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { Effect } from "effect";

import { EmailService, runEmailEffect } from "../../platform/email/email-service";

export type BetterAuthOptionsInput = {
  baseURL: string;
};

/**
 * Shared Better Auth options. Database/baseURL/secret are supplied per runtime.
 * Transactional mail goes through EmailService (console locally; Bento later).
 */
export function createBetterAuthOptions(input: BetterAuthOptionsInput) {
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
          );
        },
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
}
