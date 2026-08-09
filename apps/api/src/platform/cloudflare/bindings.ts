export type ApiBindings = {
  HYPERDRIVE: Hyperdrive;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Verified sender used by Bento (`from`). Absent → console transport. */
  EMAIL_FROM?: string;
  BENTO_SITE_UUID?: string;
  BENTO_PUBLISHABLE_KEY?: string;
  BENTO_SECRET_KEY?: string;
  /** Optional. Empty → Sentry SDK + evlog Sentry drain stay off. */
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  /** 0–1; defaults to 1 when DSN is set. Lower in production. */
  SENTRY_TRACES_SAMPLE_RATE?: string;
  /** Optional. Empty → deterministic fake AI models (no spend). */
  AI_GATEWAY_API_KEY?: string;
};
