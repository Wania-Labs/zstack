import { Effect } from "effect";

import type { AiCompleteParams } from "../../platform/ai/ai-service";
import { AiService } from "../../platform/ai/ai-service";
import { BillingError, BillingService } from "../../platform/billing/billing-service";
import { CurrentRequestContext } from "../../platform/effect/request-context";

export const AI_USAGE_EVENT = "ai.generation";

export function aiCapabilityEntitlement(capability: AiCompleteParams["capability"]): string {
  return `ai.${capability}`;
}

export const listAiCapabilities = Effect.fn("listAiCapabilities")(function* () {
  const ai = yield* AiService;
  return yield* ai.listCapabilities();
});

export const completeAi = Effect.fn("completeAi")(function* (input: AiCompleteParams) {
  const request = yield* CurrentRequestContext;
  const organizationId = request.organizationId;

  if (organizationId) {
    const billing = yield* BillingService;
    if (yield* billing.isConfigured()) {
      const allowed = yield* billing.canUse({
        customerId: organizationId,
        capability: aiCapabilityEntitlement(input.capability),
      });
      if (!allowed) {
        return yield* Effect.fail(
          new BillingError({
            message: "entitlement denied",
          }),
        );
      }
    }
  }

  const ai = yield* AiService;
  return yield* ai.complete(input);
});
