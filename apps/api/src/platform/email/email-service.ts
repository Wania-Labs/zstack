import {
  InvitationEmail,
  PasswordResetEmail,
  VerificationEmail,
  renderEmail,
  type RenderedEmail,
} from "@zstack/email";
import { Context, Effect, Layer, Schema } from "effect";

export class EmailError extends Schema.TaggedError<EmailError>()("EmailError", {
  message: Schema.String,
}) {}

export type SendVerificationEmailInput = {
  to: string;
  name: string;
  url: string;
};

export type SendPasswordResetEmailInput = {
  to: string;
  name: string;
  url: string;
};

export type SendInvitationEmailInput = {
  to: string;
  inviterName: string;
  organizationName: string;
  url: string;
};

export type EmailMessage = {
  to: string;
  rendered: RenderedEmail;
};

/**
 * Application email boundary. Domain/auth code sends named messages;
 * adapters own transport (console now, Bento later via Alchemy secrets).
 */
export class EmailService extends Context.Service<
  EmailService,
  {
    sendVerificationEmail(
      input: SendVerificationEmailInput,
    ): Effect.Effect<void, EmailError>;
    sendPasswordResetEmail(
      input: SendPasswordResetEmailInput,
    ): Effect.Effect<void, EmailError>;
    sendInvitationEmail(
      input: SendInvitationEmailInput,
    ): Effect.Effect<void, EmailError>;
  }
>()("@zstack/api/platform/email/EmailService") {}

function deliverConsole(message: EmailMessage): Effect.Effect<void, EmailError> {
  return Effect.try({
    try: () => {
      console.info("[email:console]", {
        to: message.to,
        subject: message.rendered.subject,
        text: message.rendered.text,
      });
    },
    catch: () =>
      new EmailError({
        message: "console email delivery failed",
      }),
  });
}

function renderOrFail(
  render: () => Promise<RenderedEmail>,
): Effect.Effect<RenderedEmail, EmailError> {
  return Effect.tryPromise({
    try: render,
    catch: () =>
      new EmailError({
        message: "email template render failed",
      }),
  });
}

/**
 * Local/dev transport. Replace with Bento when Alchemy binds credentials.
 */
export const ConsoleEmailLive = Layer.succeed(
  EmailService,
  EmailService.of({
    sendVerificationEmail: (input) =>
      Effect.gen(function* () {
        const rendered = yield* renderOrFail(() =>
          renderEmail(
            "Verify your email",
            VerificationEmail({ name: input.name, url: input.url }),
          ),
        );
        yield* deliverConsole({ to: input.to, rendered });
      }),
    sendPasswordResetEmail: (input) =>
      Effect.gen(function* () {
        const rendered = yield* renderOrFail(() =>
          renderEmail(
            "Reset your password",
            PasswordResetEmail({ name: input.name, url: input.url }),
          ),
        );
        yield* deliverConsole({ to: input.to, rendered });
      }),
    sendInvitationEmail: (input) =>
      Effect.gen(function* () {
        const rendered = yield* renderOrFail(() =>
          renderEmail(
            `Join ${input.organizationName} on zstack`,
            InvitationEmail({
              inviterName: input.inviterName,
              organizationName: input.organizationName,
              url: input.url,
            }),
          ),
        );
        yield* deliverConsole({ to: input.to, rendered });
      }),
  }),
);

export async function runEmailEffect<A>(
  effect: Effect.Effect<A, EmailError, EmailService>,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(ConsoleEmailLive)));
}
