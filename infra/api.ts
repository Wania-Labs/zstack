import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

/**
 * Hono API Worker — async entry at `apps/api/src/index.ts`.
 * Workflows, queues, steps, and cron live in that same Worker when selected.
 */
export const Api = (hyperdrive: Cloudflare.Hyperdrive.Connection) =>
  Cloudflare.Worker("Api", {
    main: "./apps/api/src/index.ts",
    compatibility: {
      date: "2026-07-11",
      flags: ["nodejs_compat"],
    },
    env: {
      HYPERDRIVE: hyperdrive,
      BETTER_AUTH_URL: Config.string("BETTER_AUTH_URL").pipe(
        Config.withDefault("http://localhost:3000"),
      ),
      BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
      // Empty defaults keep console EmailService until Bento secrets are set.
      EMAIL_FROM: Config.string("EMAIL_FROM").pipe(Config.withDefault("")),
      BENTO_SITE_UUID: Config.string("BENTO_SITE_UUID").pipe(Config.withDefault("")),
      BENTO_PUBLISHABLE_KEY: Config.redacted("BENTO_PUBLISHABLE_KEY").pipe(Config.withDefault("")),
      BENTO_SECRET_KEY: Config.redacted("BENTO_SECRET_KEY").pipe(Config.withDefault("")),
    },
    dev: {
      port: 8787,
      strictPort: true,
    },
  });
