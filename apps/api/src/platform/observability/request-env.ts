import { AsyncLocalStorage } from "node:async_hooks";
import type { Context, Next } from "hono";

import type { ApiBindings } from "../cloudflare/bindings";

const requestEnv = new AsyncLocalStorage<ApiBindings>();

export function getRequestEnv(): ApiBindings | undefined {
  return requestEnv.getStore();
}

/** Expose Worker env to evlog drains (nodejs_compat ALS). */
export async function withRequestEnv(c: Context<{ Bindings: ApiBindings }>, next: Next) {
  await requestEnv.run(c.env, () => next());
}
