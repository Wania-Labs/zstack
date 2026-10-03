import { describe, expect, it, vi } from "vitest";

import { handleJobsQueue } from "../../src/queues/jobs";
import type { JobMessage } from "../../src/platform/queue/job-queue";
import { testEnv } from "./support/app-harness";

function message(body: unknown) {
  return {
    id: `msg_${Math.random()}`,
    timestamp: new Date(0),
    attempts: 1,
    body: body as JobMessage,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("handleJobsQueue", () => {
  it("retries a malformed message without skipping the rest of the batch", async () => {
    const malformed = message("not-an-object");
    const alsoMalformed = message(null);
    const batch = {
      queue: "jobs",
      messages: [malformed, alsoMalformed],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as unknown as MessageBatch<JobMessage>;

    await expect(handleJobsQueue(batch, testEnv)).resolves.toBeUndefined();
    expect(malformed.retry).toHaveBeenCalledOnce();
    expect(alsoMalformed.retry).toHaveBeenCalledOnce();
  });
});
