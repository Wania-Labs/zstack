import { appContract } from "@zstack/contracts/router";
import { implement, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";

import { getHealth } from "../modules/health/service";
import { getStaffMe } from "../modules/staff/service";
import { runRequestEffect } from "../platform/effect/runtime";
import type { RequestContext } from "./context";

export type OrpcContext = {
  requestContext: RequestContext;
  connectionString: string;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string | null | undefined;
  } | null;
};

const os = implement(appContract).$context<OrpcContext>();

const health = os.health.handler(async ({ context }) => {
  return runRequestEffect(getHealth(), context.requestContext, context.connectionString);
});

const staffMe = os.staff.me.handler(async ({ context }) => {
  return getStaffMe(context.user);
});

export const router = os.router({
  health,
  staff: {
    me: staffMe,
  },
});

export type AppRouter = typeof router;

export const rpcHandler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error("[orpc]", error);
    }),
  ],
});
