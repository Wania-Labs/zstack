import { defineConfig } from "vitest/config";

/**
 * Pure unit tests only (node). Kept separate from `vite.config.ts` so the
 * TanStack Start / Tailwind plugins never load under Vitest.
 */
export default defineConfig({
  test: {
    name: "web-unit",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
