import type { ApiBindings } from "../../src/platform/cloudflare/bindings";

/**
 * Types `env` from `cloudflare:workers` inside the workerd Vitest pool.
 * Bindings come from wrangler.jsonc + vitest.workers.config.ts miniflare vars.
 */
declare global {
  namespace Cloudflare {
    interface Env extends ApiBindings {}
  }
}
