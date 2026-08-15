import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  FakeJobQueueLive,
  JobQueue,
  JobQueueError,
  jobQueueLiveFromEnv,
  makeFakeJobQueueLive,
} from "../../src/platform/queue/job-queue";

async function runQueue<A>(
  effect: Effect.Effect<A, JobQueueError, JobQueue>,
  live = FakeJobQueueLive,
) {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}

describe("FakeJobQueueLive", () => {
  it("records published jobs", async () => {
    const fake = makeFakeJobQueueLive();
    await runQueue(
      Effect.gen(function* () {
        const queue = yield* JobQueue;
        yield* queue.publish({ name: "example.echo", payload: { n: 1 } });
      }),
      fake.live,
    );

    expect(fake.published).toEqual([{ name: "example.echo", payload: { n: 1 } }]);
  });

  it("rejects an empty job name", async () => {
    await expect(
      runQueue(
        Effect.gen(function* () {
          const queue = yield* JobQueue;
          yield* queue.publish({ name: "  ", payload: {} });
        }),
      ),
    ).rejects.toBeInstanceOf(JobQueueError);
  });
});

describe("jobQueueLiveFromEnv", () => {
  it("uses the in-memory fake when JOBS is missing", async () => {
    await runQueue(
      Effect.gen(function* () {
        const queue = yield* JobQueue;
        yield* queue.publish({ name: "example.echo", payload: {} });
      }),
      jobQueueLiveFromEnv({}),
    );
  });
});
