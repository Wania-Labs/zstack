import { Context, Effect, Layer, Schema } from "effect";

export class DurableWorkflowError extends Schema.TaggedError<DurableWorkflowError>()(
  "DurableWorkflowError",
  {
    message: Schema.String,
  },
) {}

export const EXAMPLE_WORKFLOW_NAME = "example";

export type ExampleWorkflowParams = {
  operationId: string;
};

export type StartWorkflowInput = {
  name: string;
  payload: unknown;
  instanceId?: string;
};

export type WorkflowRunHandle = {
  instanceId: string;
};

/**
 * Application durable-workflow boundary. Domain code starts named runs;
 * adapters own Cloudflare Workflows vs in-process fake.
 */
export class DurableWorkflow extends Context.Service<
  DurableWorkflow,
  {
    start(input: StartWorkflowInput): Effect.Effect<WorkflowRunHandle, DurableWorkflowError>;
  }
>()("@zstack/api/platform/workflow/DurableWorkflow") {}

function requireName(name: string): Effect.Effect<string, DurableWorkflowError> {
  const trimmed = name.trim();
  if (!trimmed) {
    return Effect.fail(
      new DurableWorkflowError({
        message: "workflow name must be a non-empty opaque string",
      }),
    );
  }
  return Effect.succeed(trimmed);
}

function makeDurableWorkflow(backend: DurableWorkflow["Service"]): DurableWorkflow["Service"] {
  return DurableWorkflow.of({
    start: (input) =>
      Effect.gen(function* () {
        const name = yield* requireName(input.name);
        return yield* backend.start({ ...input, name });
      }),
  });
}

function makeFakeBackend(started: WorkflowRunHandle[]): DurableWorkflow["Service"] {
  return {
    start: (input) =>
      Effect.sync(() => {
        const handle = {
          instanceId: input.instanceId?.trim() || crypto.randomUUID(),
        };
        started.push(handle);
        return handle;
      }),
  };
}

/**
 * Local/dev workflow when the Worker Workflow binding is absent.
 * Runs are recorded; they are not durable across isolates.
 */
export function makeFakeDurableWorkflowLive(): {
  started: WorkflowRunHandle[];
  live: Layer.Layer<DurableWorkflow>;
} {
  const started: WorkflowRunHandle[] = [];
  return {
    started,
    live: Layer.succeed(DurableWorkflow, makeDurableWorkflow(makeFakeBackend(started))),
  };
}

export const FakeDurableWorkflowLive = makeFakeDurableWorkflowLive().live;

function isWorkflowBinding(value: unknown): value is Workflow<ExampleWorkflowParams> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("create" in value)) {
    return false;
  }
  return typeof value.create === "function";
}

function exampleParams(payload: unknown): ExampleWorkflowParams {
  if (typeof payload === "object" && payload !== null && "operationId" in payload) {
    const operationId = payload.operationId;
    if (typeof operationId === "string" && operationId.trim()) {
      return { operationId: operationId.trim() };
    }
  }
  return { operationId: crypto.randomUUID() };
}

function makeCloudflareBackend(
  workflow: Workflow<ExampleWorkflowParams>,
): DurableWorkflow["Service"] {
  return {
    start: (input) =>
      Effect.gen(function* () {
        if (input.name !== EXAMPLE_WORKFLOW_NAME) {
          return yield* Effect.fail(
            new DurableWorkflowError({
              message: `unknown workflow "${input.name}"`,
            }),
          );
        }

        const instance = yield* Effect.tryPromise({
          try: () =>
            workflow.create({
              ...(input.instanceId?.trim() ? { id: input.instanceId.trim() } : {}),
              params: exampleParams(input.payload),
            }),
          catch: (cause) =>
            new DurableWorkflowError({
              message:
                cause instanceof Error
                  ? `workflow start failed: ${cause.message}`
                  : "workflow start failed",
            }),
        });

        return { instanceId: instance.id };
      }),
  };
}

export function CloudflareDurableWorkflowLive(
  workflow: Workflow<ExampleWorkflowParams>,
): Layer.Layer<DurableWorkflow> {
  return Layer.succeed(DurableWorkflow, makeDurableWorkflow(makeCloudflareBackend(workflow)));
}

export function durableWorkflowLiveFromEnv(env: {
  EXAMPLE_WORKFLOW?: Workflow<ExampleWorkflowParams>;
}): Layer.Layer<DurableWorkflow> {
  return isWorkflowBinding(env.EXAMPLE_WORKFLOW)
    ? CloudflareDurableWorkflowLive(env.EXAMPLE_WORKFLOW)
    : FakeDurableWorkflowLive;
}
