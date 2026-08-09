import { Hono } from "hono";

import type { ApiBindings } from "../platform/cloudflare/bindings";
import { attachAuthSession, mountAuthRoutes } from "./auth";
import { attachRequestContext, type ApiVariables } from "./context";
import { healthHandler } from "./health";
import { mountOrpc } from "./orpc-mount";

export function createApp() {
  const app = new Hono<{ Bindings: ApiBindings; Variables: ApiVariables }>();

  app.use("*", attachRequestContext);
  app.use("*", attachAuthSession);
  app.on(["POST", "GET"], "/api/auth/*", mountAuthRoutes);
  app.use("/api/rpc/*", mountOrpc);
  app.get("/health", healthHandler);

  return app;
}
