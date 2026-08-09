import * as Cloudflare from "alchemy/Cloudflare";

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
      date: "2026-08-07",
      flags: ["nodejs_compat"],
    },
    env: {
      API: api,
    },
    assets: {
      runWorkerFirst: true,
    },
    dev: {
      port: 3000,
      strictPort: true,
    },
  });
