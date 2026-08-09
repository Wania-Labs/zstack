import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = process.env.API_ORIGIN ?? "http://127.0.0.1:8787";

/**
 * Alchemy injects its Cloudflare Vite plugin under `alchemy dev` / deploy.
 * Do not add `@cloudflare/vite-plugin` here — it conflicts with Alchemy.
 * Standalone `vite dev` runs TanStack Start on Node and proxies `/api` to
 * the wrangler API Worker.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@base-ui/react"],
  },
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
});
