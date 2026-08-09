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

export type BentoCredentials = {
  siteUuid: string;
  publishableKey: string;
  secretKey: string;
  from: string;
};

/**
 * Application email boundary. Domain/auth code sends named messages;
 * adapters own transport (console locally, Bento when credentials are bound).
 */
export class EmailService extends Context.Service<
  EmailService,
  {
    sendVerificationEmail(input: SendVerificationEmailInput): Effect.Effect<void, EmailError>;
    sendPasswordResetEmail(input: SendPasswordResetEmailInput): Effect.Effect<void, EmailError>;
    sendInvitationEmail(input: SendInvitationEmailInput): Effect.Effect<void, EmailError>;
  }
>()("@zstack/api/platform/email/EmailService") {}

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

function makeEmailService(
  deliver: (message: EmailMessage) => Effect.Effect<void, EmailError>,
): EmailService["Service"] {
  return EmailService.of({
    sendVerificationEmail: (input) =>
      Effect.gen(function* () {
        const rendered = yield* renderOrFail(() =>
          renderEmail("Verify your email", VerificationEmail({ name: input.name, url: input.url })),
        );
        yield* deliver({ to: input.to, rendered });
      }),
    sendPasswordResetEmail: (input) =>
      Effect.gen(function* () {
        const rendered = yield* renderOrFail(() =>
          renderEmail(
            "Reset your password",
            PasswordResetEmail({ name: input.name, url: input.url }),
          ),
        );
        yield* deliver({ to: input.to, rendered });
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
        yield* deliver({ to: input.to, rendered });
      }),
  });
}

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

/**
 * Local/dev transport when Bento credentials are absent.
 */
export const ConsoleEmailLive = Layer.succeed(EmailService, makeEmailService(deliverConsole));

function deliverBento(
  credentials: BentoCredentials,
  message: EmailMessage,
): Effect.Effect<void, EmailError> {
  return Effect.tryPromise({
    try: async () => {
      const authorization = `Basic ${btoa(`${credentials.publishableKey}:${credentials.secretKey}`)}`;
      const response = await fetch(
        `https://app.bentonow.com/api/v1/batch/emails?site_uuid=${encodeURIComponent(credentials.siteUuid)}`,
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            "User-Agent": "zstack/0.0.0",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emails: [
              {
                to: message.to,
                from: credentials.from,
                subject: message.rendered.subject,
                html_body: message.rendered.html,
                text_body: message.rendered.text,
                transactional: true,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Bento ${response.status}: ${detail.slice(0, 200)}`);
      }
    },
    catch: (cause) =>
      new EmailError({
        message:
          cause instanceof Error
            ? `bento email delivery failed: ${cause.message}`
            : "bento email delivery failed",
      }),
  });
}

/**
 * Production transport. Requires Bento site UUID + API keys + verified from.
 */
export function BentoEmailLive(credentials: BentoCredentials) {
  return Layer.succeed(
    EmailService,
    makeEmailService((message) => deliverBento(credentials, message)),
  );
}

export function readBentoCredentials(env: {
  BENTO_SITE_UUID?: string;
  BENTO_PUBLISHABLE_KEY?: string;
  BENTO_SECRET_KEY?: string;
  EMAIL_FROM?: string;
}): BentoCredentials | undefined {
  const siteUuid = env.BENTO_SITE_UUID?.trim();
  const publishableKey = env.BENTO_PUBLISHABLE_KEY?.trim();
  const secretKey = env.BENTO_SECRET_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();

  if (!siteUuid || !publishableKey || !secretKey || !from) {
    return undefined;
  }

  return { siteUuid, publishableKey, secretKey, from };
}

export function emailLiveFromEnv(env: {
  BENTO_SITE_UUID?: string;
  BENTO_PUBLISHABLE_KEY?: string;
  BENTO_SECRET_KEY?: string;
  EMAIL_FROM?: string;
}): Layer.Layer<EmailService> {
  const credentials = readBentoCredentials(env);
  return credentials ? BentoEmailLive(credentials) : ConsoleEmailLive;
}

export async function runEmailEffect<A>(
  effect: Effect.Effect<A, EmailError, EmailService>,
  live: Layer.Layer<EmailService> = ConsoleEmailLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
