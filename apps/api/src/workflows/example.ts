import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { ApiBindings } from "../platform/cloudflare/bindings";
import type { ExampleWorkflowParams } from "../platform/workflow/durable-workflow";

/**
 * Starter Cloudflare Workflow hosted by the API Worker.
 * Domain code starts it through DurableWorkflow, not this class.
 */
export class ExampleWorkflow extends WorkflowEntrypoint<ApiBindings, ExampleWorkflowParams> {
  async run(event: WorkflowEvent<ExampleWorkflowParams>, step: WorkflowStep) {
    const operationId = event.payload.operationId;
    await step.do("ack", async () => operationId);
    return { operationId };
  }
}
