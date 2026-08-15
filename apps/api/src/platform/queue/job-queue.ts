import { Context, Effect, Layer, Schema } from "effect";

export class JobQueueError extends Schema.TaggedError<JobQueueError>()("JobQueueError", {
  message: Schema.String,
}) {}

export type JobMessage = {
  name: string;
  payload: unknown;
};

export const BILLING_USAGE_JOB = "billing.usage";

/**
 * Application job-queue boundary. Domain code publishes named messages;
 * adapters own Cloudflare Queues vs in-memory.
 */
export class JobQueue extends Context.Service<
  JobQueue,
  {
    publish(message: JobMessage): Effect.Effect<void, JobQueueError>;
  }
>()("@zstack/api/platform/queue/JobQueue") {}

function requireName(name: string): Effect.Effect<string, JobQueueError> {
  const trimmed = name.trim();
  if (!trimmed) {
    return Effect.fail(
      new JobQueueError({
        message: "job name must be a non-empty opaque string",
      }),
    );
  }
  return Effect.succeed(trimmed);
}

function makeJobQueue(backend: JobQueue["Service"]): JobQueue["Service"] {
  return JobQueue.of({
    publish: (message) =>
      Effect.gen(function* () {
        const name = yield* requireName(message.name);
        return yield* backend.publish({ name, payload: message.payload });
      }),
  });
}

function makeFakeBackend(published: JobMessage[]): JobQueue["Service"] {
  return {
    publish: (message) =>
      Effect.sync(() => {
        published.push({ name: message.name, payload: message.payload });
      }),
  };
}

/**
 * Local/dev queue when the Worker Queue binding is absent.
 */
export function makeFakeJobQueueLive(): {
  published: JobMessage[];
  live: Layer.Layer<JobQueue>;
} {
  const published: JobMessage[] = [];
  return {
    published,
    live: Layer.succeed(JobQueue, makeJobQueue(makeFakeBackend(published))),
  };
}

export const FakeJobQueueLive = makeFakeJobQueueLive().live;

function isQueueBinding(value: unknown): value is Queue<JobMessage> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("send" in value)) {
    return false;
  }
  return typeof value.send === "function";
}

function makeCloudflareBackend(queue: Queue<JobMessage>): JobQueue["Service"] {
  return {
    publish: (message) =>
      Effect.tryPromise({
        try: () => queue.send(message),
        catch: (cause) =>
          new JobQueueError({
            message:
              cause instanceof Error
                ? `job publish failed: ${cause.message}`
                : "job publish failed",
          }),
      }),
  };
}

export function CloudflareJobQueueLive(queue: Queue<JobMessage>): Layer.Layer<JobQueue> {
  return Layer.succeed(JobQueue, makeJobQueue(makeCloudflareBackend(queue)));
}

export function jobQueueLiveFromEnv(env: { JOBS?: Queue<JobMessage> }): Layer.Layer<JobQueue> {
  return isQueueBinding(env.JOBS) ? CloudflareJobQueueLive(env.JOBS) : FakeJobQueueLive;
}
