import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

import { compatibility } from "./shared.ts";

/**
 * Customer TanStack Start app. Alchemy injects its Cloudflare Vite plugin —
 * do not add `@cloudflare/vite-plugin` in `apps/web/vite.config.ts`.
 *
 * `API` is the service binding behind same-origin `/api/*`: the
 * `apps/web/src/routes/api/$.ts` server route and SSR auth/oRPC calls forward
 * through it. Plain `vite dev` proxies `/api` → `:8787` instead.
 */
export const Web = (api: Cloudflare.Worker) =>
  Cloudflare.Website.Vite("Web", {
    rootDir: "./apps/web",
    compatibility,
    env: {
      API: api,
      // Public browser DSN — empty keeps client Sentry off.
      VITE_SENTRY_DSN: Config.String("VITE_SENTRY_DSN_WEB").pipe(Config.withDefault("")),
      VITE_SENTRY_ENVIRONMENT: Config.String("SENTRY_ENVIRONMENT").pipe(
        Config.withDefault("development"),
      ),
      VITE_SENTRY_RELEASE: Config.String("SENTRY_RELEASE").pipe(Config.withDefault("")),
      VITE_PUBLIC_POSTHOG_KEY: Config.String("VITE_PUBLIC_POSTHOG_KEY").pipe(
        Config.withDefault(""),
      ),
      VITE_PUBLIC_POSTHOG_HOST: Config.String("VITE_PUBLIC_POSTHOG_HOST").pipe(
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
