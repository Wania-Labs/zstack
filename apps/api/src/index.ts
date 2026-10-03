import * as Sentry from "@sentry/cloudflare";

import { createApp } from "./http/app";
import type { ApiBindings } from "./platform/cloudflare/bindings";
import { sentryOptions } from "./platform/observability/sentry";
import type { JobMessage } from "./platform/queue/job-queue";
import { handleJobsQueue } from "./queues/jobs";
import { ExampleWorkflow } from "./workflows/example";

const app = createApp();

// fetch is instrumented by the Hono Sentry middleware; queue needs its own wrapper
// or captures from the consumer go nowhere. No-op until SENTRY_DSN is set.
const queue = Sentry.withSentry(
  (env: ApiBindings): Sentry.CloudflareOptions => sentryOptions(env),
  {
    queue: handleJobsQueue,
  } satisfies ExportedHandler<ApiBindings, JobMessage>,
).queue;

export default {
  fetch: app.fetch,
  queue,
} satisfies ExportedHandler<ApiBindings, JobMessage>;

export { ExampleWorkflow };
