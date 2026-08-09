import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { initBrowserSentry } from "./lib/sentry";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  initBrowserSentry(router, "zstack-admin");

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
