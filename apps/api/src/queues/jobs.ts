import * as Sentry from "@sentry/cloudflare";
import { Effect } from "effect";
import { log } from "evlog";

import { systemRequestContext } from "../http/context";
import { flushUsage } from "../modules/billing/service";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import { runRequestEffect } from "../platform/effect/runtime";
import { BILLING_USAGE_JOB, type JobMessage } from "../platform/queue/job-queue";
import { DurableWorkflow, EXAMPLE_WORKFLOW_NAME } from "../platform/workflow/durable-workflow";

export const EXAMPLE_JOB_ECHO = "example.echo";
export const EXAMPLE_JOB_WORKFLOW = "example.workflow";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function payloadOperationId(payload: unknown): string {
  if (!isRecord(payload)) {
    return crypto.randomUUID();
  }
  const operationId = payload.operationId;
  if (typeof operationId === "string" && operationId.trim()) {
    return operationId.trim();
  }
  return crypto.randomUUID();
}

const handleJob = Effect.fn("handleJob")(function* (message: JobMessage) {
  if (message.name === BILLING_USAGE_JOB) {
    yield* flushUsage(payloadOperationId(message.payload));
    return;
  }

  if (message.name !== EXAMPLE_JOB_WORKFLOW) {
    return;
  }

  const workflows = yield* DurableWorkflow;
  yield* workflows.start({
    name: EXAMPLE_WORKFLOW_NAME,
    payload: { operationId: payloadOperationId(message.payload) },
  });
});

/**
 * Cloudflare Queue consumer for `JOBS`. Lives on the API Worker, not a second app.
 */
export async function handleJobsQueue(
  batch: MessageBatch<JobMessage>,
  env: ApiBindings,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await runRequestEffect(handleJob(message.body), systemRequestContext(), env);
      message.ack();
    } catch (error) {
      // Retry is the recovery path, but a silently retried job hides outages.
      // A malformed body must not throw here or the rest of the batch is skipped.
      const body: unknown = message.body;
      const job =
        typeof body === "object" && body !== null && "name" in body
          ? String((body as { name: unknown }).name)
          : "unknown";
      log.error({
        action: "jobs.queue",
        job,
        messageId: message.id,
        attempts: message.attempts,
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error, { tags: { operation: "jobs.queue", job } });
      message.retry();
    }
  }
}
