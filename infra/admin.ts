import * as Cloudflare from "alchemy/Cloudflare";

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
    },
    assets: {
      runWorkerFirst: true,
    },
    dev: {
      port: 3001,
      strictPort: true,
    },
  });
