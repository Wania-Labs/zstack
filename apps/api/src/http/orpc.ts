import { ORPCError, implement, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { appContract } from "@zstack/contracts/router";

import { completeAi, listAiCapabilities } from "../modules/ai/service";
import { createCheckout, customerPortal } from "../modules/billing/service";
import { getHealth } from "../modules/health/service";
import { getStaffMe } from "../modules/staff/service";
import { AiLive, runAiEffect } from "../platform/ai/ai-service";
import { BillingLive, runBillingEffect } from "../platform/billing/billing-service";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import { runRequestEffect } from "../platform/effect/runtime";
import type { RequestContext } from "./context";

export type OrpcContext = {
  requestContext: RequestContext;
  connectionString: string;
  env: ApiBindings;
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

const aiCapabilities = os.ai.capabilities.handler(async ({ context }) => {
  return runAiEffect(listAiCapabilities(), AiLive(context.env));
});

const aiComplete = os.ai.complete.handler(async ({ input, context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to use AI completions.",
    });
  }

  try {
    return await runAiEffect(completeAi(input), AiLive(context.env));
  } catch (error) {
    const message = error instanceof Error ? error.message : "ai complete failed";
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message });
  }
});

const billingCreateCheckout = os.billing.createCheckout.handler(async ({ input, context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to create checkout.",
    });
  }

  return runBillingEffect(createCheckout(input), BillingLive(context.env));
});

const billingCustomerPortal = os.billing.customerPortal.handler(async ({ input, context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to access customer portal.",
    });
  }

  return runBillingEffect(customerPortal(input), BillingLive(context.env));
});

export const router = os.router({
  health,
  staff: {
    me: staffMe,
  },
  ai: {
    capabilities: aiCapabilities,
    complete: aiComplete,
  },
  billing: {
    createCheckout: billingCreateCheckout,
    customerPortal: billingCustomerPortal,
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
