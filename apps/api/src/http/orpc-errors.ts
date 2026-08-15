import { ORPCError } from "@orpc/server";
import * as Sentry from "@sentry/cloudflare";

import { AiError } from "../platform/ai/ai-service";
import { BillingError } from "../platform/billing/billing-service";
import { DurableWorkflowError } from "../platform/workflow/durable-workflow";
import { JobQueueError } from "../platform/queue/job-queue";
import { ObjectStoreError } from "../platform/object-store/object-store-service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function taggedErrorName(error: unknown): string | undefined {
  if (error instanceof BillingError) return error._tag;
  if (error instanceof AiError) return error._tag;
  if (error instanceof ObjectStoreError) return error._tag;
  if (error instanceof JobQueueError) return error._tag;
  if (error instanceof DurableWorkflowError) return error._tag;
  if (isRecord(error) && typeof error._tag === "string") {
    return error._tag;
  }
  return undefined;
}

export function captureOrpcError(error: unknown): void {
  Sentry.captureException(error);
}

/**
 * Map domain failures to oRPC without forwarding vendor `error.message`.
 */
export function orpcFailure(error: unknown, fallbackMessage: string): never {
  if (error instanceof ORPCError) {
    throw error;
  }

  const tag = taggedErrorName(error);
  const message = isRecord(error) && typeof error.message === "string" ? error.message : "";

  if (tag === "BillingError" && message.includes("not found in catalog")) {
    throw new ORPCError("BAD_REQUEST", { message: "Unknown product." });
  }

  if (tag === "BillingError" && message.includes("entitlement denied")) {
    throw new ORPCError("FORBIDDEN", {
      message: "This Team does not include that capability.",
    });
  }

  throw new ORPCError("INTERNAL_SERVER_ERROR", { message: fallbackMessage });
}
