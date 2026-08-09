import { defineConfig } from "vitest/config";

/**
 * Node unit + domain tests (no workerd). Fast CI path.
 */
export default defineConfig({
  test: {
    name: "api-unit",
    environment: "node",
    include: ["src/**/*.test.ts", "test/unit/**/*.test.ts"],
    exclude: ["**/*.eval.ts", "test/workers/**", "node_modules", "dist"],
  },
});
