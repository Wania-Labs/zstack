import { initLogger } from "evlog";
import { evlog } from "evlog/hono";
import { sentry } from "@sentry/hono/cloudflare";
import { Hono } from "hono";

import { runRequestEffect, type RequestRunner } from "../platform/effect/runtime";
import { createRequestDrain } from "../platform/observability/evlog-drain";
import { getRequestEnv, withRequestEnv } from "../platform/observability/request-env";
import { sentryOptions } from "../platform/observability/sentry";
import { attachAuthSession, mountAuthRoutes, type SessionResolver } from "./auth";
import { attachRequestContext, bindRequestRunner, type ApiEnv } from "./context";
import { healthHandler } from "./health";
import { deleteObjectHandler, getObjectHandler, putObjectHandler } from "./objects";
import { mountOrpc } from "./orpc-mount";
import { polarWebhookHandler } from "./polar-webhook";

initLogger({
  env: { service: "zstack-api" },
});

/**
 * Edge seams. Defaults are the production adapters; tests inject fakes to
 * exercise the real routing, middleware, and handlers without Postgres.
 */
export type AppDeps = {
  /** Better Auth session lookup (default opens a pg client only when a session cookie exists). */
  resolveSession?: SessionResolver;
  /** Runs request-scoped effects against the request layer. */
  runRequest?: RequestRunner;
};

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<ApiEnv>();

  // Sentry first — empty DSN keeps the SDK quiet for clones without observability wired.
  app.use(
    "*",
    sentry(app, (env) => ({
      ...sentryOptions(env),
      dataCollection: {
        userInfo: false,
        httpBodies: [],
      },
    })),
  );

  app.use("*", withRequestEnv);
  app.use(
    "*",
    evlog({
      drain: createRequestDrain(getRequestEnv),
      exclude: ["/health"],
      enrich: (ctx) => {
        const env = getRequestEnv();
        if (env?.SENTRY_ENVIRONMENT) {
          ctx.event.environment = env.SENTRY_ENVIRONMENT;
        }
      },
    }),
  );
  app.use("*", attachRequestContext);
  app.use("*", attachAuthSession(deps.resolveSession));
  app.use("*", bindRequestRunner(deps.runRequest ?? runRequestEffect));
  app.on(["POST", "GET"], "/api/auth/*", mountAuthRoutes);
  app.post("/api/webhooks/polar", polarWebhookHandler);
  app.use("/api/rpc/*", mountOrpc);
  app.put("/api/objects/*", putObjectHandler);
  app.get("/api/objects/*", getObjectHandler);
  app.delete("/api/objects/*", deleteObjectHandler);
  app.get("/health", healthHandler);

  return app;
}
