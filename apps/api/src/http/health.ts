import type { Context } from "hono";

import { getHealth, healthDown, type HealthStatus } from "../modules/health/service";
import type { ApiEnv } from "./context";
import { reportError } from "./report-error";

export async function healthHandler(c: Context<ApiEnv>) {
  let status: HealthStatus;
  try {
    status = await c.get("runEffect")(getHealth());
  } catch (error) {
    // The request layer connects to Postgres while it is built, so a refused
    // connection surfaces here rather than inside the ping.
    reportError(c.get("log"), error, "health");
    status = healthDown(c.get("requestContext").requestId);
  }
  return c.json(status, status.ok ? 200 : 503);
}
