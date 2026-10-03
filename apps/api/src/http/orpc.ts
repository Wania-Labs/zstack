import { Effect } from "effect";
import type { RequestLogger } from "evlog";
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
import type { BoundRequestRunner, RequestContext } from "./context";
import { captureOrpcError, orpcFailure } from "./orpc-errors";
import { reportError } from "./report-error";

export type OrpcContext = {
  requestContext: RequestContext;
  env: ApiBindings;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string | null | undefined;
  } | null;
  runEffect: BoundRequestRunner;
  log?: Pick<RequestLogger, "error">;
};

/** Organization roles allowed to start checkout or open the billing portal. */
export const BILLING_MANAGER_ROLES: ReadonlySet<string> = new Set(["owner", "admin"]);

export function canManageBilling(requestContext: RequestContext): boolean {
  const roles = requestContext.organizationRoles;
  if (!roles) {
    return false;
  }
  for (const role of roles) {
    if (BILLING_MANAGER_ROLES.has(role)) {
      return true;
    }
  }
  return false;
}

function requireBillingManager(context: OrpcContext, action: string): string {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: `Sign in to ${action}.`,
    });
  }

  const organizationId = context.requestContext.organizationId;
  if (!organizationId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select a Team to continue.",
    });
  }

  if (!canManageBilling(context.requestContext)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only Team owners and admins can manage billing.",
    });
  }

  return organizationId;
}

const os = implement(appContract).$context<OrpcContext>();

const health = os.health.handler(async ({ context }) => {
  const status = await context.runEffect(getHealth());
  if (!status.ok) {
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Database unavailable." });
  }
  return status;
});

const staffMe = os.staff.me.handler(async ({ context }) => {
  return getStaffMe(context.user);
});

const aiCapabilities = os.ai.capabilities.handler(async ({ context }) => {
  return context.runEffect(listAiCapabilities());
});

const aiComplete = os.ai.complete.handler(async ({ input, context }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Sign in to use AI completions.",
    });
  }

  try {
    return await context.runEffect(
      Effect.gen(function* () {
        const { completion, billedOrganizationId } = yield* completeAi(input);
        const analytics = yield* Analytics;
        const request = yield* CurrentRequestContext;
        if (billedOrganizationId) {
          yield* reportUsage({
            organizationId: billedOrganizationId,
            name: AI_USAGE_EVENT,
            operationId: request.idempotencyKey ?? crypto.randomUUID(),
          }).pipe(
            // The completion already happened; record the metering failure
            // instead of failing the response.
            Effect.catch((error) =>
              Effect.sync(() => reportError(context.log, error, "billing.reportUsage")),
            ),
          );
        }
        yield* analytics.capture(
          {
            name: "ai_generation_completed",
            properties: {
              capability: input.capability,
              route: completion.route,
            },
          },
          {
            distinctId: request.effectiveUserId ?? request.requestId,
            ...(request.organizationId ? { organizationId: request.organizationId } : {}),
            ...(request.staffCapabilities && request.staffCapabilities.size > 0
              ? { isStaff: true }
              : {}),
          },
        );
        return completion;
      }),
    );
  } catch (error) {
    orpcFailure(error, "AI completion failed.");
  }
});

const billingCreateCheckout = os.billing.createCheckout.handler(async ({ input, context }) => {
  const organizationId = requireBillingManager(context, "create checkout");

  try {
    return await context.runEffect(createCheckout(input, organizationId));
  } catch (error) {
    orpcFailure(error, "Checkout failed.");
  }
});

const billingCustomerPortal = os.billing.customerPortal.handler(async ({ input, context }) => {
  const organizationId = requireBillingManager(context, "access customer portal");

  try {
    return await context.runEffect(customerPortal(input, organizationId));
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
    return await context.runEffect(customerSnapshot(context.requestContext.organizationId));
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
