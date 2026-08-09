import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Workerd integration via @cloudflare/vitest-pool-workers.
 * Needs Compose Hyperdrive origin for handlers that touch Postgres —
 * not part of the default `pnpm test` CI gate.
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
