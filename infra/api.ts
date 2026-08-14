import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

/**
 * Hono API Worker — async entry at `apps/api/src/index.ts`.
 * Workflows, queues, steps, and cron live in that same Worker when selected.
 */
export const Api = (hyperdrive: Cloudflare.Hyperdrive.Connection, objects: Cloudflare.R2.Bucket) =>
  Cloudflare.Worker("Api", {
    main: "./apps/api/src/index.ts",
    compatibility: {
      date: "2026-07-11",
      flags: ["nodejs_compat"],
    },
    env: {
      HYPERDRIVE: hyperdrive,
      OBJECTS: objects,
      BETTER_AUTH_URL: Config.string("BETTER_AUTH_URL").pipe(
        Config.withDefault("http://localhost:3000"),
      ),
      BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
      // Empty defaults keep console EmailService until Bento secrets are set.
      EMAIL_FROM: Config.string("EMAIL_FROM").pipe(Config.withDefault("")),
      BENTO_SITE_UUID: Config.string("BENTO_SITE_UUID").pipe(Config.withDefault("")),
      BENTO_PUBLISHABLE_KEY: Config.redacted("BENTO_PUBLISHABLE_KEY").pipe(Config.withDefault("")),
      BENTO_SECRET_KEY: Config.redacted("BENTO_SECRET_KEY").pipe(Config.withDefault("")),
      // Empty → Sentry + evlog Sentry drain stay off (template default).
      SENTRY_DSN: Config.string("SENTRY_DSN").pipe(Config.withDefault("")),
      SENTRY_ENVIRONMENT: Config.string("SENTRY_ENVIRONMENT").pipe(
        Config.withDefault("development"),
      ),
      SENTRY_RELEASE: Config.string("SENTRY_RELEASE").pipe(Config.withDefault("")),
      SENTRY_TRACES_SAMPLE_RATE: Config.string("SENTRY_TRACES_SAMPLE_RATE").pipe(
        Config.withDefault("1"),
      ),
      // Empty → fake AI registry (no Vercel AI Gateway spend).
      AI_GATEWAY_API_KEY: Config.redacted("AI_GATEWAY_API_KEY").pipe(Config.withDefault("")),
      // Empty → FakeBillingLive until POLAR_ACCESS_TOKEN is set.
      POLAR_ACCESS_TOKEN: Config.redacted("POLAR_ACCESS_TOKEN").pipe(Config.withDefault("")),
      POLAR_SERVER: Config.string("POLAR_SERVER").pipe(Config.withDefault("")),
    },
    dev: {
      port: 8787,
      strictPort: true,
    },
  });
