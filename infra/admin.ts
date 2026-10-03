import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";

import { compatibility } from "./shared.ts";

/**
 * Staff TanStack Start console. Same `API` service binding pattern as web:
 * `apps/admin/src/routes/api/$.ts` and SSR auth/oRPC calls forward through it.
 * Do not add `@cloudflare/vite-plugin` in `apps/admin/vite.config.ts`.
 */
export const Admin = (api: Cloudflare.Worker) =>
  Cloudflare.Website.Vite("Admin", {
    rootDir: "./apps/admin",
    compatibility,
    env: {
      API: api,
      VITE_SENTRY_DSN: Config.String("VITE_SENTRY_DSN_ADMIN").pipe(Config.withDefault("")),
      VITE_SENTRY_ENVIRONMENT: Config.String("SENTRY_ENVIRONMENT").pipe(
        Config.withDefault("development"),
      ),
      VITE_SENTRY_RELEASE: Config.String("SENTRY_RELEASE").pipe(Config.withDefault("")),
    },
    assets: {
      runWorkerFirst: true,
    },
    dev: {
      port: 3001,
      strictPort: true,
    },
  });
