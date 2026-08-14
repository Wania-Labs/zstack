import { Effect } from "effect";
import type {
  CheckoutIntent,
  CreateCheckoutInput,
  CustomerPortalInput,
  PortalIntent,
} from "@zstack/contracts";

import { BillingError, BillingService } from "../../platform/billing/billing-service";

export function createCheckout(
  input: CreateCheckoutInput,
  organizationId: string,
): Effect.Effect<CheckoutIntent, BillingError, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    return yield* billing.createCheckout({
      customerId: organizationId,
      productSlug: input.productSlug,
    });
  });
}

export function customerPortal(
  _input: CustomerPortalInput,
  organizationId: string,
): Effect.Effect<PortalIntent, BillingError, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    return yield* billing.customerPortal({
      customerId: organizationId,
    });
  });
}
