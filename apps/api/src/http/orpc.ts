import { appContract } from "@zstack/contracts/router";
import { implement, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";

import { getHealth } from "../modules/health/service";
import { runRequestEffect } from "../platform/effect/runtime";
import type { RequestContext } from "./context";

export type OrpcContext = {
  requestContext: RequestContext;
  connectionString: string;
};

const os = implement(appContract).$context<OrpcContext>();

const health = os.health.handler(async ({ context }) => {
  return runRequestEffect(getHealth(), context.requestContext, context.connectionString);
});

export const router = os.router({
  health,
});

export type AppRouter = typeof router;

export const rpcHandler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error("[orpc]", error);
    }),
  ],
});
