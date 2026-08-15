import { Effect } from "effect";
import { ORPCError, implement, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { appContract } from "@zstack/contracts/router";

import { completeAi, listAiCapabilities, AI_USAGE_EVENT } from "../modules/ai/service";
import {
  createCheckout,
  customerPortal,
  customerSnapshot,
  reportUsage,
} from "../modules/billing/service";
import { getHealth } from "../modules/health/service";
import { getStaffMe } from "../modules/staff/service";
import { Analytics } from "../platform/analytics/analytics-service";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import { CurrentRequestContext } from "../platform/effect/request-context";
import { runRequestEffect } from "../platform/effect/runtime";
import type { RequestContext } from "./context";
import { captureOrpcError, orpcFailure } from "./orpc-errors";

export type OrpcContext = {
  requestContext: RequestContext;
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
  return runRequestEffect(getHealth(), context.requestContext, context.env);
});

const staffMe = os.staff.me.handler(async ({ context }) => {
  return getStaffMe(context.user);
});

const aiCapabilities = os.ai.capabilities.handler(async ({ context }) => {
  return runRequestEffect(listAiCapabilities(), context.requestContext, context.env);
});

const aiComplete = os.ai.complete.handler(async ({ input, context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to use AI completions.",
    });
  }

  try {
    return await runRequestEffect(
      Effect.gen(function* () {
        const result = yield* completeAi(input);
        const analytics = yield* Analytics;
        const request = yield* CurrentRequestContext;
        if (request.organizationId) {
          yield* reportUsage({
            organizationId: request.organizationId,
            name: AI_USAGE_EVENT,
            operationId: request.idempotencyKey ?? crypto.randomUUID(),
          }).pipe(Effect.catch(() => Effect.void));
        }
        yield* analytics.capture(
          {
            name: "ai_generation_completed",
            properties: {
              capability: input.capability,
              route: result.route,
            },
          },
          {
            distinctId: request.effectiveUserId ?? request.requestId,
            ...(request.organizationId ? { organizationId: request.organizationId } : {}),
            ...(request.staffCapabilities && request.staffCapabilities.size > 0
              ? { isStaff: true }
              : {}),
            environment: context.env.SENTRY_ENVIRONMENT?.trim() || "development",
          },
        );
        return result;
      }),
      context.requestContext,
      context.env,
    );
  } catch (error) {
    orpcFailure(error, "AI completion failed.");
  }
});

const billingCreateCheckout = os.billing.createCheckout.handler(async ({ input, context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to create checkout.",
    });
  }

  if (!context.requestContext.organizationId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select a Team to continue.",
    });
  }

  try {
    return await runRequestEffect(
      createCheckout(input, context.requestContext.organizationId),
      context.requestContext,
      context.env,
    );
  } catch (error) {
    orpcFailure(error, "Checkout failed.");
  }
});

const billingCustomerPortal = os.billing.customerPortal.handler(async ({ input, context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to access customer portal.",
    });
  }

  if (!context.requestContext.organizationId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select a Team to continue.",
    });
  }

  try {
    return await runRequestEffect(
      customerPortal(input, context.requestContext.organizationId),
      context.requestContext,
      context.env,
    );
  } catch (error) {
    orpcFailure(error, "Customer portal failed.");
  }
});

const billingSnapshot = os.billing.snapshot.handler(async ({ context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to read billing entitlements.",
    });
  }

  if (!context.requestContext.organizationId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select a Team to continue.",
    });
  }

  try {
    return await runRequestEffect(
      customerSnapshot(context.requestContext.organizationId),
      context.requestContext,
      context.env,
    );
  } catch (error) {
    orpcFailure(error, "Billing snapshot failed.");
  }
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
    snapshot: billingSnapshot,
  },
});

export type AppRouter = typeof router;

export const rpcHandler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      if (error instanceof ORPCError) {
        const status = typeof error.status === "number" ? error.status : 500;
        if (status < 500) {
          return;
        }
      }
      captureOrpcError(error);
    }),
  ],
});
