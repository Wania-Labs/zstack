import { Effect } from "effect";
import type {
  CheckoutIntent,
  CreateCheckoutInput,
  CustomerPortalInput,
  PortalIntent,
} from "@zstack/contracts";

import { BillingService } from "../../platform/billing/billing-service";

export function createCheckout(
  input: CreateCheckoutInput,
): Effect.Effect<CheckoutIntent, never, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    const result = yield* billing.createCheckout({
      customerId: input.customerId,
      productSlug: input.productSlug,
      ...(input.successUrl ? { successUrl: input.successUrl } : {}),
    });
    return result;
  }).pipe(
    Effect.orElseSucceed(() => ({
      kind: "unconfigured" as const,
    })),
  );
}

export function customerPortal(
  input: CustomerPortalInput,
): Effect.Effect<PortalIntent, never, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    const result = yield* billing.customerPortal({
      customerId: input.customerId,
    });
    return result;
  }).pipe(
    Effect.orElseSucceed(() => ({
      kind: "unconfigured" as const,
    })),
  );
}
