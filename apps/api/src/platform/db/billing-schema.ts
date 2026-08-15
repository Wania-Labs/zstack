import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Polar webhook inbox. Primary key is Polar's event id so retries are no-ops.
 */
export const billingWebhookEvent = pgTable("billing_webhook_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Organization entitlement snapshot recomputed from Polar customer state.
 */
export const billingEntitlement = pgTable("billing_entitlement", {
  organizationId: text("organization_id").primaryKey(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull(),
  limits: jsonb("limits").$type<Record<string, number>>().notNull(),
  sourceEventId: text("source_event_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Product usage waiting to be ingested by Polar. `operation_id` is the Polar
 * idempotency key.
 */
export const billingUsageOutbox = pgTable("billing_usage_outbox", {
  operationId: text("operation_id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  polarEventId: text("polar_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});
