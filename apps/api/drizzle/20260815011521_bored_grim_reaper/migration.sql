CREATE TABLE "billing_entitlement" (
	"organization_id" text PRIMARY KEY,
	"capabilities" jsonb NOT NULL,
	"limits" jsonb NOT NULL,
	"source_event_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_usage_outbox" (
	"operation_id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"polar_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_event" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
