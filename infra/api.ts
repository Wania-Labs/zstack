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
      date: "2026-08-07",
      flags: ["nodejs_compat"],
    },
    env: {
      HYPERDRIVE: hyperdrive,
      BETTER_AUTH_URL: Config.string("BETTER_AUTH_URL").pipe(
        Config.withDefault("http://localhost:3000"),
      ),
      BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
    },
    dev: {
      port: 8787,
      strictPort: true,
    },
  });
