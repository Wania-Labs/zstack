import { initLogger } from "evlog";
import { evlog, type EvlogVariables } from "evlog/hono";
import { sentry } from "@sentry/hono/cloudflare";
import { Hono } from "hono";

import type { ApiBindings } from "../platform/cloudflare/bindings";
import { createRequestDrain } from "../platform/observability/evlog-drain";
import { getRequestEnv, withRequestEnv } from "../platform/observability/request-env";
import { sentryOptions } from "../platform/observability/sentry";
import { attachAuthSession, mountAuthRoutes } from "./auth";
import { attachRequestContext, type ApiVariables } from "./context";
import { healthHandler } from "./health";
import { deleteObjectHandler, getObjectHandler, putObjectHandler } from "./objects";
import { mountOrpc } from "./orpc-mount";
import { polarWebhookHandler } from "./polar-webhook";

initLogger({
  env: { service: "zstack-api" },
});

type AppEnv = {
  Bindings: ApiBindings;
  Variables: ApiVariables & EvlogVariables["Variables"];
};

export function createApp() {
  const app = new Hono<AppEnv>();

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
  app.use("*", attachAuthSession);
  app.on(["POST", "GET"], "/api/auth/*", mountAuthRoutes);
  app.post("/api/webhooks/polar", polarWebhookHandler);
  app.use("/api/rpc/*", mountOrpc);
  app.put("/api/objects/*", putObjectHandler);
  app.get("/api/objects/*", getObjectHandler);
  app.delete("/api/objects/*", deleteObjectHandler);
  app.get("/health", healthHandler);

  return app;
}
