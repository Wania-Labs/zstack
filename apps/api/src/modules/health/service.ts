import { HealthResponse } from "@zstack/contracts/health";
import { Effect } from "effect";

import { Database, ping } from "../../platform/db/database";
import { CurrentRequestContext } from "../../platform/effect/runtime";

export const getHealth = Effect.fn("getHealth")(function* (): Effect.fn.Return<
  HealthResponse,
  never,
  CurrentRequestContext | Database
> {
  const requestContext = yield* CurrentRequestContext;
  yield* ping().pipe(Effect.orDie);

  return HealthResponse.parse({
    ok: true,
    requestId: requestContext.requestId,
    database: "up",
  });
});
