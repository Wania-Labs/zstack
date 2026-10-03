import { HealthResponse } from "@zstack/contracts/health";
import { Effect } from "effect";

import { Database, ping } from "../../platform/db/database";
import { CurrentRequestContext } from "../../platform/effect/runtime";

export type HealthDown = {
  ok: false;
  requestId: string;
  database: "down";
};

export type HealthStatus = HealthResponse | HealthDown;

export function healthDown(requestId: string): HealthDown {
  return { ok: false, requestId, database: "down" };
}

/**
 * Liveness + database ping. A failed ping is reported as `database: "down"`
 * (callers map it to 503) instead of dying, so monitors can see the outage.
 */
export const getHealth = Effect.fn("getHealth")(function* (): Effect.fn.Return<
  HealthStatus,
  never,
  CurrentRequestContext | Database
> {
  const requestContext = yield* CurrentRequestContext;
  const databaseUp = yield* ping().pipe(
    Effect.as(true),
    Effect.catch((error) =>
      Effect.logError("health: database ping failed", error).pipe(Effect.as(false)),
    ),
  );

  if (!databaseUp) {
    return healthDown(requestContext.requestId);
  }

  return HealthResponse.parse({
    ok: true,
    requestId: requestContext.requestId,
    database: "up",
  });
});
