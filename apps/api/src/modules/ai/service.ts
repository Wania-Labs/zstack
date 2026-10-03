import { Effect } from "effect";

import type { AiCompleteParams } from "../../platform/ai/ai-service";
import { AiService } from "../../platform/ai/ai-service";
import { BillingError, BillingService } from "../../platform/billing/billing-service";
import { CurrentRequestContext } from "../../platform/effect/request-context";

export const AI_USAGE_EVENT = "ai.generation";

/** BillingError message when billing is live but the caller has no active Team. */
export const AI_ORGANIZATION_REQUIRED = "organization required";

export function aiCapabilityEntitlement(capability: AiCompleteParams["capability"]): string {
  return `ai.${capability}`;
}

export const listAiCapabilities = Effect.fn("listAiCapabilities")(function* () {
  const ai = yield* AiService;
  return yield* ai.listCapabilities();
});

/**
 * Gate AI on billing. When billing is configured, the caller must have an
 * active organization holding the capability entitlement; the organization is
 * returned so usage can be metered against it. Without billing, AI is open and
 * unmetered (`undefined`).
 */
export const authorizeAiUsage = Effect.fn("authorizeAiUsage")(function* (
  capability: AiCompleteParams["capability"],
): Effect.fn.Return<string | undefined, BillingError, BillingService | CurrentRequestContext> {
  const billing = yield* BillingService;
  if (!(yield* billing.isConfigured())) {
    return undefined;
  }

  const request = yield* CurrentRequestContext;
  const organizationId = request.organizationId;
  if (!organizationId) {
    return yield* new BillingError({ message: AI_ORGANIZATION_REQUIRED });
  }

  const allowed = yield* billing.canUse({
    customerId: organizationId,
    capability: aiCapabilityEntitlement(capability),
  });
  if (!allowed) {
    return yield* new BillingError({ message: "entitlement denied" });
  }
  return organizationId;
});

/**
 * Authorize, then complete. `billedOrganizationId` is set exactly when usage
 * must be reported (billing configured), so callers meter consistently.
 */
export const completeAi = Effect.fn("completeAi")(function* (input: AiCompleteParams) {
  const billedOrganizationId = yield* authorizeAiUsage(input.capability);
  const ai = yield* AiService;
  const completion = yield* ai.complete(input);
  return { completion, billedOrganizationId };
});
