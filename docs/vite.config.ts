import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";

export default defineConfig({
  server: {
    port: 4000,
    strictPort: true,
  },
  plugins: [
    fumadocsMdx(),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      // Prerender hangs at Concurrency: 0 with this Start+Fumadocs pairing; SSR only.
      prerender: {
        enabled: false,
      },
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
  },
});
