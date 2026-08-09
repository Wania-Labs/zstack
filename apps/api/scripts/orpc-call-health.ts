import { call } from "@orpc/server";

import { router } from "../src/http/orpc";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://zstack:zstack@127.0.0.1:5432/zstack";

const result = await call(router.health, undefined, {
  context: {
    requestContext: {
      requestId: "test-req",
      releaseId: "local",
      actor: { type: "system" as const },
      locale: "en",
    },
    connectionString,
  },
});

console.log(JSON.stringify(result, null, 2));
