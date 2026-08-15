import { createApp } from "./http/app";
import type { ApiBindings } from "./platform/cloudflare/bindings";
import type { JobMessage } from "./platform/queue/job-queue";
import { handleJobsQueue } from "./queues/jobs";
import { ExampleWorkflow } from "./workflows/example";

const app = createApp();

export default {
  fetch: app.fetch,
  queue: handleJobsQueue,
} satisfies ExportedHandler<ApiBindings, JobMessage>;

export { ExampleWorkflow };
