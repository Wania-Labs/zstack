import type { Context, Next } from "hono";

import type { ApiEnv } from "./context";
import { rpcHandler } from "./orpc";

/**
 * Mount oRPC RPCHandler under /api/rpc (first-party typed clients).
 * Auth stays at /api/auth/*; OpenAPI public surface can share this later.
 *
 * We pass `c.req.raw` directly: upstream middleware does not consume the body.
 * If a future middleware does, use the Proxy pattern from oRPC Hono docs
 * (and bind Request methods so Workers don't throw Illegal invocation).
 */
export async function mountOrpc(c: Context<ApiEnv>, next: Next) {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: "/api/rpc",
    context: {
      requestContext: c.get("requestContext"),
      env: c.env,
      user: c.get("user"),
      runEffect: c.get("runEffect"),
      log: c.get("log"),
    },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
}
