import type { Context } from "hono";

import { getHealth } from "../modules/health/service";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import { runRequestEffect } from "../platform/effect/runtime";
import type { ApiVariables } from "./context";

export async function healthHandler(
  c: Context<{ Bindings: ApiBindings; Variables: ApiVariables }>,
) {
  const body = await runRequestEffect(getHealth(), c.get("requestContext"), c.env);
  return c.json(body);
}
