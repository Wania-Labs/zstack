import { defineConfig } from "vitest/config";

/**
 * Deterministic AI evals (fake models by default). Live gateway runs are
 * opt-in via AI_GATEWAY_API_KEY + EVALS_LIVE=1 — never in default CI.
 */
export default defineConfig({
  test: {
    name: "api-evals",
    environment: "node",
    include: ["src/**/*.eval.ts", "test/evals/**/*.eval.ts"],
    testTimeout: 30_000,
  },
});
