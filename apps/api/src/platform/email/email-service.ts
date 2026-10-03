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

const URL_PATTERN = /https?:\/\/\S+/g;

/** Strip links (which carry reset/verification tokens) from console output. */
export function redactEmailLinks(text: string): string {
  return text.replace(URL_PATTERN, "[link redacted]");
}

export type ConsoleEmailOptions = {
  /** Redact links in logged bodies. On whenever the app runs on HTTPS. */
  redactLinks?: boolean;
};

function deliverConsole(
  message: EmailMessage,
  options: ConsoleEmailOptions,
): Effect.Effect<void, EmailError> {
  return Effect.try({
    try: () => {
      console.info("[email:console]", {
        to: message.to,
        subject: message.rendered.subject,
        text: options.redactLinks ? redactEmailLinks(message.rendered.text) : message.rendered.text,
      });
    },
    catch: () =>
      new EmailError({
        message: "console email delivery failed",
      }),
  });
}

export function makeConsoleEmailLive(options: ConsoleEmailOptions = {}): Layer.Layer<EmailService> {
  return Layer.succeed(
    EmailService,
    makeEmailService((message) => deliverConsole(message, options)),
  );
}

/**
 * Local/dev transport when Bento credentials are absent.
 */
export const ConsoleEmailLive = makeConsoleEmailLive();

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

type BentoEnv = {
  BENTO_SITE_UUID?: string;
  BENTO_PUBLISHABLE_KEY?: string;
  BENTO_SECRET_KEY?: string;
  EMAIL_FROM?: string;
};

const BENTO_ENV_KEYS = [
  "EMAIL_FROM",
  "BENTO_SITE_UUID",
  "BENTO_PUBLISHABLE_KEY",
  "BENTO_SECRET_KEY",
] as const satisfies ReadonlyArray<keyof BentoEnv>;

export type BentoConfig =
  | { kind: "unset" }
  | { kind: "partial"; missing: ReadonlyArray<keyof BentoEnv> }
  | { kind: "complete"; credentials: BentoCredentials };

export function readBentoConfig(env: BentoEnv): BentoConfig {
  const missing = BENTO_ENV_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length === BENTO_ENV_KEYS.length) {
    return { kind: "unset" };
  }
  if (missing.length > 0) {
    return { kind: "partial", missing };
  }
  const value = (key: keyof BentoEnv) => env[key]?.trim() ?? "";
  return {
    kind: "complete",
    credentials: {
      siteUuid: value("BENTO_SITE_UUID"),
      publishableKey: value("BENTO_PUBLISHABLE_KEY"),
      secretKey: value("BENTO_SECRET_KEY"),
      from: value("EMAIL_FROM"),
    },
  };
}

export function readBentoCredentials(env: BentoEnv): BentoCredentials | undefined {
  const config = readBentoConfig(env);
  return config.kind === "complete" ? config.credentials : undefined;
}

/** HTTPS app URL means a deployed (production-like) stage. */
function isHttpsUrl(url: string | undefined): boolean {
  return url?.trim().toLowerCase().startsWith("https://") ?? false;
}

const warnedPartialBento = new Set<string>();

function warnPartialBento(missing: ReadonlyArray<string>): void {
  const signature = missing.join(",");
  if (warnedPartialBento.has(signature)) {
    return;
  }
  warnedPartialBento.add(signature);
  console.warn(
    `[email] Bento is partially configured (missing: ${signature}). ` +
      "Falling back to the console transport: transactional email will NOT be delivered.",
  );
}

export function emailLiveFromEnv(
  env: BentoEnv & { BETTER_AUTH_URL?: string },
): Layer.Layer<EmailService> {
  const config = readBentoConfig(env);
  if (config.kind === "complete") {
    return BentoEmailLive(config.credentials);
  }
  if (config.kind === "partial") {
    warnPartialBento(config.missing);
  }
  const redactLinks = isHttpsUrl(env.BETTER_AUTH_URL);
  return redactLinks ? makeConsoleEmailLive({ redactLinks }) : ConsoleEmailLive;
}

export async function runEmailEffect<A>(
  effect: Effect.Effect<A, EmailError, EmailService>,
  live: Layer.Layer<EmailService> = ConsoleEmailLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
