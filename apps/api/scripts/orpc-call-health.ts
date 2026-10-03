import { call } from "@orpc/server";

import { router } from "../src/http/orpc";
import type { RequestContext } from "../src/http/context";
import type { ApiBindings } from "../src/platform/cloudflare/bindings";
import { runRequestEffect } from "../src/platform/effect/runtime";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://zstack:zstack@127.0.0.1:5432/zstack";

const env = {
  HYPERDRIVE: { connectionString },
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
} as ApiBindings;

const requestContext: RequestContext = {
  requestId: "test-req",
  releaseId: "local",
  actor: { type: "system" },
  locale: "en",
};

const result = await call(router.health, undefined, {
  context: {
    requestContext,
    env,
    user: null,
    runEffect: (effect) => runRequestEffect(effect, requestContext, env),
  },
});

console.log(JSON.stringify(result, null, 2));
