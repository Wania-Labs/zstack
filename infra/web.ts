import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

/**
 * Customer TanStack Start app. Alchemy injects its Cloudflare Vite plugin —
 * do not add `@cloudflare/vite-plugin` in `apps/web/vite.config.ts`.
 *
 * `API` is a service binding for same-origin `/api` proxying later; local
 * Vite still proxies `/api` → `:8787` when running the dual wrangler path.
 */
export const Web = (api: Cloudflare.Worker) =>
  Cloudflare.Website.Vite("Web", {
    rootDir: "./apps/web",
    compatibility: {
      date: "2026-07-11",
      flags: ["nodejs_compat"],
    },
    env: {
      API: api,
      // Public browser DSN — empty keeps client Sentry off.
      VITE_SENTRY_DSN: Config.string("VITE_SENTRY_DSN_WEB").pipe(Config.withDefault("")),
      VITE_SENTRY_ENVIRONMENT: Config.string("SENTRY_ENVIRONMENT").pipe(
        Config.withDefault("development"),
      ),
      VITE_SENTRY_RELEASE: Config.string("SENTRY_RELEASE").pipe(Config.withDefault("")),
      VITE_PUBLIC_POSTHOG_KEY: Config.string("VITE_PUBLIC_POSTHOG_KEY").pipe(
        Config.withDefault(""),
      ),
      VITE_PUBLIC_POSTHOG_HOST: Config.string("VITE_PUBLIC_POSTHOG_HOST").pipe(
        Config.withDefault("https://us.i.posthog.com"),
      ),
    },
    assets: {
      runWorkerFirst: true,
    },
    dev: {
      port: 3000,
      strictPort: true,
    },
  });
