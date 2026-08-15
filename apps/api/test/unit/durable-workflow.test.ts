import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  DurableWorkflow,
  DurableWorkflowError,
  EXAMPLE_WORKFLOW_NAME,
  FakeDurableWorkflowLive,
  durableWorkflowLiveFromEnv,
  makeFakeDurableWorkflowLive,
} from "../../src/platform/workflow/durable-workflow";

async function runWorkflow<A>(
  effect: Effect.Effect<A, DurableWorkflowError, DurableWorkflow>,
  live = FakeDurableWorkflowLive,
) {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}

describe("FakeDurableWorkflowLive", () => {
  it("starts a run and returns an instance id", async () => {
    const fake = makeFakeDurableWorkflowLive();
    const handle = await runWorkflow(
      Effect.gen(function* () {
        const workflows = yield* DurableWorkflow;
        return yield* workflows.start({
          name: EXAMPLE_WORKFLOW_NAME,
          payload: { operationId: "op_1" },
          instanceId: "wf_fixed",
        });
      }),
      fake.live,
    );

    expect(handle).toEqual({ instanceId: "wf_fixed" });
    expect(fake.started).toEqual([{ instanceId: "wf_fixed" }]);
  });

  it("rejects an empty workflow name", async () => {
    await expect(
      runWorkflow(
        Effect.gen(function* () {
          const workflows = yield* DurableWorkflow;
          return yield* workflows.start({ name: " ", payload: {} });
        }),
      ),
    ).rejects.toBeInstanceOf(DurableWorkflowError);
  });
});

describe("durableWorkflowLiveFromEnv", () => {
  it("uses the in-memory fake when EXAMPLE_WORKFLOW is missing", async () => {
    const handle = await runWorkflow(
      Effect.gen(function* () {
        const workflows = yield* DurableWorkflow;
        return yield* workflows.start({
          name: EXAMPLE_WORKFLOW_NAME,
          payload: { operationId: "op_env" },
        });
      }),
      durableWorkflowLiveFromEnv({}),
    );

    expect(handle.instanceId.length).toBeGreaterThan(0);
  });
});
