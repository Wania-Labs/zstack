import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

/**
 * Staff TanStack Start console. Same API service binding pattern as web.
 * Do not add `@cloudflare/vite-plugin` in `apps/admin/vite.config.ts`.
 */
export const Admin = (api: Cloudflare.Worker) =>
  Cloudflare.Website.Vite("Admin", {
    rootDir: "./apps/admin",
    compatibility: {
      date: "2026-07-11",
      flags: ["nodejs_compat"],
    },
    env: {
      API: api,
      VITE_SENTRY_DSN: Config.string("VITE_SENTRY_DSN_ADMIN").pipe(Config.withDefault("")),
      VITE_SENTRY_ENVIRONMENT: Config.string("SENTRY_ENVIRONMENT").pipe(
        Config.withDefault("development"),
      ),
      VITE_SENTRY_RELEASE: Config.string("SENTRY_RELEASE").pipe(Config.withDefault("")),
    },
    assets: {
      runWorkerFirst: true,
    },
    dev: {
      port: 3001,
      strictPort: true,
    },
  });
