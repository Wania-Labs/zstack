import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

/**
 * Hono API Worker — async entry at `apps/api/src/index.ts`.
 * Workflows, queues, steps, and cron live in that same Worker.
 */
export const Api = (
  hyperdrive: Cloudflare.Hyperdrive.Connection,
  objects: Cloudflare.R2.Bucket,
  jobs: Cloudflare.Queues.Queue,
) =>
  Cloudflare.Worker("Api", {
    main: "./apps/api/src/index.ts",
    compatibility: {
      date: "2026-07-11",
      flags: ["nodejs_compat"],
    },
    env: {
      HYPERDRIVE: hyperdrive,
      OBJECTS: objects,
      JOBS: jobs,
      EXAMPLE_WORKFLOW: Cloudflare.Workflow("ExampleWorkflow", {
        className: "ExampleWorkflow",
      }),
      BETTER_AUTH_URL: Config.String("BETTER_AUTH_URL").pipe(
        Config.withDefault("http://localhost:3000"),
      ),
      BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
      // Empty defaults keep console EmailService until Bento secrets are set.
      EMAIL_FROM: Config.String("EMAIL_FROM").pipe(Config.withDefault("")),
      BENTO_SITE_UUID: Config.String("BENTO_SITE_UUID").pipe(Config.withDefault("")),
      BENTO_PUBLISHABLE_KEY: Config.Redacted("BENTO_PUBLISHABLE_KEY").pipe(Config.withDefault("")),
      BENTO_SECRET_KEY: Config.Redacted("BENTO_SECRET_KEY").pipe(Config.withDefault("")),
      // Empty → Sentry + evlog Sentry drain stay off (template default).
      SENTRY_DSN: Config.String("SENTRY_DSN").pipe(Config.withDefault("")),
      SENTRY_ENVIRONMENT: Config.String("SENTRY_ENVIRONMENT").pipe(
        Config.withDefault("development"),
      ),
      SENTRY_RELEASE: Config.String("SENTRY_RELEASE").pipe(Config.withDefault("")),
      SENTRY_TRACES_SAMPLE_RATE: Config.String("SENTRY_TRACES_SAMPLE_RATE").pipe(
        Config.withDefault("1"),
      ),
      // Empty → fake AI registry (no Vercel AI Gateway spend).
      AI_GATEWAY_API_KEY: Config.Redacted("AI_GATEWAY_API_KEY").pipe(Config.withDefault("")),
      // Empty → FakeBillingLive until POLAR_ACCESS_TOKEN is set.
      POLAR_ACCESS_TOKEN: Config.Redacted("POLAR_ACCESS_TOKEN").pipe(Config.withDefault("")),
      POLAR_SERVER: Config.String("POLAR_SERVER").pipe(Config.withDefault("")),
      POLAR_CHECKOUT_SUCCESS_URL: Config.String("POLAR_CHECKOUT_SUCCESS_URL").pipe(
        Config.withDefault(""),
      ),
      POLAR_PRODUCT_PRO: Config.String("POLAR_PRODUCT_PRO").pipe(Config.withDefault("")),
      POLAR_PRODUCT_ENTERPRISE: Config.String("POLAR_PRODUCT_ENTERPRISE").pipe(
        Config.withDefault(""),
      ),
      POLAR_WEBHOOK_SECRET: Config.Redacted("POLAR_WEBHOOK_SECRET").pipe(Config.withDefault("")),
      POSTHOG_API_KEY: Config.Redacted("POSTHOG_API_KEY").pipe(Config.withDefault("")),
      POSTHOG_HOST: Config.String("POSTHOG_HOST").pipe(
        Config.withDefault("https://us.i.posthog.com"),
      ),
      CLOUDFLARE_ACCOUNT_ID: objects.accountId,
      OBJECTS_BUCKET_NAME: objects.bucketName,
      R2_ACCESS_KEY_ID: Config.Redacted("R2_ACCESS_KEY_ID").pipe(Config.withDefault("")),
      R2_SECRET_ACCESS_KEY: Config.Redacted("R2_SECRET_ACCESS_KEY").pipe(Config.withDefault("")),
      FEATURE_FLAG_EXAMPLE_READY: Config.String("FEATURE_FLAG_EXAMPLE_READY").pipe(
        Config.withDefault("true"),
      ),
    },
    dev: {
      port: 8787,
      strictPort: true,
    },
  });
