import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { Database } from "../db/database";
import { billingEntitlement, billingUsageOutbox, billingWebhookEvent } from "../db/schema";

export type EntitlementSnapshot = {
  capabilities: string[];
  limits: Record<string, number>;
};

export type UsageOutboxRow = {
  operationId: string;
  organizationId: string;
  name: string;
  status: string;
};

/**
 * Insert Polar webhook. Returns false when the event id already exists.
 */
export const insertWebhookEvent = Effect.fn("insertWebhookEvent")(function* (input: {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  const db = yield* Database;
  const inserted = yield* db
    .insert(billingWebhookEvent)
    .values({
      id: input.id,
      type: input.type,
      payload: input.payload,
    })
    .onConflictDoNothing({ target: billingWebhookEvent.id })
    .returning({ id: billingWebhookEvent.id });
  return Boolean(inserted[0]);
});

export const upsertEntitlement = Effect.fn("upsertEntitlement")(function* (input: {
  organizationId: string;
  snapshot: EntitlementSnapshot;
  sourceEventId: string;
}) {
  const db = yield* Database;
  yield* db
    .insert(billingEntitlement)
    .values({
      organizationId: input.organizationId,
      capabilities: input.snapshot.capabilities,
      limits: input.snapshot.limits,
      sourceEventId: input.sourceEventId,
    })
    .onConflictDoUpdate({
      target: billingEntitlement.organizationId,
      set: {
        capabilities: input.snapshot.capabilities,
        limits: input.snapshot.limits,
        sourceEventId: input.sourceEventId,
        updatedAt: new Date(),
      },
    });
});

export const readEntitlement = Effect.fn("readEntitlement")(function* (organizationId: string) {
  const db = yield* Database;
  const rows = yield* db
    .select()
    .from(billingEntitlement)
    .where(eq(billingEntitlement.organizationId, organizationId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return {
    capabilities: row.capabilities,
    limits: row.limits,
  } satisfies EntitlementSnapshot;
});

export const insertUsageOutbox = Effect.fn("insertUsageOutbox")(function* (input: {
  operationId: string;
  organizationId: string;
  name: string;
}) {
  const db = yield* Database;
  const inserted = yield* db
    .insert(billingUsageOutbox)
    .values({
      operationId: input.operationId,
      organizationId: input.organizationId,
      name: input.name,
      status: "pending",
    })
    .onConflictDoNothing({ target: billingUsageOutbox.operationId })
    .returning({ operationId: billingUsageOutbox.operationId });
  return Boolean(inserted[0]);
});

export const loadPendingUsage = Effect.fn("loadPendingUsage")(function* (operationId: string) {
  const db = yield* Database;
  const rows = yield* db
    .select()
    .from(billingUsageOutbox)
    .where(
      and(
        eq(billingUsageOutbox.operationId, operationId),
        eq(billingUsageOutbox.status, "pending"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return {
    operationId: row.operationId,
    organizationId: row.organizationId,
    name: row.name,
    status: row.status,
  } satisfies UsageOutboxRow;
});

export const markUsageSent = Effect.fn("markUsageSent")(function* (input: {
  operationId: string;
  polarEventId?: string;
}) {
  const db = yield* Database;
  yield* db
    .update(billingUsageOutbox)
    .set({
      status: "sent",
      polarEventId: input.polarEventId,
      sentAt: new Date(),
    })
    .where(eq(billingUsageOutbox.operationId, input.operationId));
});
