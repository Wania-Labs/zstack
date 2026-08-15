import type {
  CheckoutIntent,
  CreateCheckoutInput,
  CustomerPortalInput,
  PortalIntent,
} from "@zstack/contracts";
import { Effect } from "effect";

import { Analytics } from "../../platform/analytics/analytics-service";
import { BillingError, BillingService } from "../../platform/billing/billing-service";
import {
  insertUsageOutbox,
  insertWebhookEvent,
  loadPendingUsage,
  markUsageSent,
  readEntitlement,
  upsertEntitlement,
} from "../../platform/billing/ledger";
import type { PolarWebhookEvent } from "../../platform/billing/webhook";
import { CurrentRequestContext } from "../../platform/effect/request-context";
import { BILLING_USAGE_JOB, JobQueue } from "../../platform/queue/job-queue";

export function createCheckout(
  input: CreateCheckoutInput,
  organizationId: string,
): Effect.Effect<CheckoutIntent, BillingError, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    return yield* billing.createCheckout({
      customerId: organizationId,
      productSlug: input.productSlug,
    });
  });
}

export function customerPortal(
  _input: CustomerPortalInput,
  organizationId: string,
): Effect.Effect<PortalIntent, BillingError, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    return yield* billing.customerPortal({
      customerId: organizationId,
    });
  });
}

export const canUse = Effect.fn("billing.canUse")(function* (
  organizationId: string,
  capability: string,
) {
  const projected = yield* readEntitlement(organizationId);
  if (projected) {
    return projected.capabilities.includes(capability);
  }
  const billing = yield* BillingService;
  return yield* billing.canUse({ customerId: organizationId, capability });
});

export const limit = Effect.fn("billing.limit")(function* (organizationId: string, name: string) {
  const projected = yield* readEntitlement(organizationId);
  if (projected) {
    return projected.limits[name] ?? 0;
  }
  const billing = yield* BillingService;
  return yield* billing.limit({ customerId: organizationId, name });
});

export const remaining = Effect.fn("billing.remaining")(function* (
  organizationId: string,
  name: string,
) {
  const projected = yield* readEntitlement(organizationId);
  if (projected) {
    return projected.limits[name] ?? 0;
  }
  const billing = yield* BillingService;
  return yield* billing.remaining({ customerId: organizationId, name });
});

export const entitlement = Effect.fn("billing.entitlement")(function* (
  organizationId: string,
  name: string,
) {
  const projected = yield* readEntitlement(organizationId);
  if (projected) {
    return {
      granted: projected.capabilities.includes(name),
      remaining: projected.limits[name] ?? 0,
    };
  }
  const billing = yield* BillingService;
  return yield* billing.entitlement({ customerId: organizationId, name });
});

export const customerSnapshot = Effect.fn("billing.customerSnapshot")(function* (
  organizationId: string,
) {
  const projected = yield* readEntitlement(organizationId);
  if (projected) {
    return projected;
  }
  const billing = yield* BillingService;
  return yield* billing.customerSnapshot(organizationId);
});

export const reportUsage = Effect.fn("billing.reportUsage")(function* (input: {
  organizationId: string;
  name: string;
  operationId: string;
}) {
  yield* insertUsageOutbox({
    operationId: input.operationId,
    organizationId: input.organizationId,
    name: input.name,
  });
  // Flush in-process so wrangler without a JOBS binding still delivers.
  // The queue consumer retries when Polar ingest fails here.
  yield* flushUsage(input.operationId).pipe(Effect.catch(() => Effect.void));
  const queue = yield* JobQueue;
  yield* queue
    .publish({
      name: BILLING_USAGE_JOB,
      payload: { operationId: input.operationId },
    })
    .pipe(Effect.catch(() => Effect.void));
});

export const flushUsage = Effect.fn("billing.flushUsage")(function* (operationId: string) {
  const row = yield* loadPendingUsage(operationId);
  if (!row) {
    return;
  }
  const billing = yield* BillingService;
  const ingested = yield* billing.ingestUsage({
    customerId: row.organizationId,
    name: row.name,
    operationId: row.operationId,
  });
  yield* markUsageSent({
    operationId: row.operationId,
    ...(ingested.polarEventId ? { polarEventId: ingested.polarEventId } : {}),
  });
});

export const ingestPolarWebhook = Effect.fn("billing.ingestPolarWebhook")(function* (
  event: PolarWebhookEvent,
) {
  const inserted = yield* insertWebhookEvent({
    id: event.id,
    type: event.type,
    payload: event.payload,
  });

  if (!event.organizationId) {
    return { duplicate: !inserted };
  }

  const billing = yield* BillingService;
  const snapshot = yield* billing.customerSnapshot(event.organizationId);
  yield* upsertEntitlement({
    organizationId: event.organizationId,
    snapshot,
    sourceEventId: event.id,
  });

  if (!inserted) {
    return { duplicate: true };
  }

  const analytics = yield* Analytics;
  const request = yield* CurrentRequestContext;
  const kind = billingAnalyticsKind(event.type);
  if (kind === "checkout") {
    yield* analytics.capture(
      {
        name: "checkout_completed",
        properties: {
          organizationId: event.organizationId,
          ...productSlugFromPayload(event.payload),
        },
      },
      {
        distinctId: event.organizationId,
        organizationId: event.organizationId,
        environment: request.releaseId === "local" ? "development" : request.releaseId,
      },
    );
  } else if (kind === "subscription") {
    yield* analytics.capture(
      {
        name: "subscription_changed",
        properties: {
          organizationId: event.organizationId,
          status: statusFromPayload(event.payload),
        },
      },
      {
        distinctId: event.organizationId,
        organizationId: event.organizationId,
        environment: request.releaseId === "local" ? "development" : request.releaseId,
      },
    );
  }

  return { duplicate: false };
});

function billingAnalyticsKind(type: string): "checkout" | "subscription" | "other" {
  const normalized = type.toLowerCase();
  if (normalized.includes("checkout") || normalized.includes("order")) {
    return "checkout";
  }
  if (normalized.includes("subscription")) {
    return "subscription";
  }
  return "other";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function productSlugFromPayload(
  payload: Record<string, unknown>,
): { productSlug: string } | Record<string, never> {
  const data = isRecord(payload.data) ? payload.data : payload;
  const product = isRecord(data.product) ? data.product : undefined;
  const slug =
    (typeof data.product_slug === "string" && data.product_slug) ||
    (typeof product?.slug === "string" && product.slug) ||
    (typeof product?.name === "string" && product.name);
  return slug ? { productSlug: slug } : {};
}

function statusFromPayload(payload: Record<string, unknown>): string {
  const data = isRecord(payload.data) ? payload.data : payload;
  return typeof data.status === "string" && data.status.trim() ? data.status.trim() : "unknown";
}
