import { call } from "@orpc/server";

import { router } from "../src/http/orpc";
import type { ApiBindings } from "../src/platform/cloudflare/bindings";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://zstack:zstack@127.0.0.1:5432/zstack";

const env = {
  HYPERDRIVE: { connectionString },
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
} as ApiBindings;

const result = await call(router.health, undefined, {
  context: {
    requestContext: {
      requestId: "test-req",
      releaseId: "local",
      actor: { type: "system" as const },
      locale: "en",
    },
    env,
    user: null,
  },
});

console.log(JSON.stringify(result, null, 2));
