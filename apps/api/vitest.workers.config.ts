import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Workerd integration via @cloudflare/vitest-pool-workers.
 * Handlers that query Postgres need the Compose Hyperdrive origin; the binding
 * smoke does not. Runs as its own CI step (`pnpm test:workers`), not in `pnpm test`.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: "test-secret-not-for-production-use-32b",
          BETTER_AUTH_URL: "http://localhost:3000",
          AI_GATEWAY_API_KEY: "",
        },
      },
    }),
  ],
  test: {
    name: "api-workers",
    include: ["test/workers/**/*.test.ts"],
  },
});
