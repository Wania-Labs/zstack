import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  BillingError,
  BillingService,
  FakeBillingLive,
  billingLiveFromEnv,
  runBillingEffect,
} from "../../src/platform/billing/billing-service";

const orgId = "org_opaque_1";

describe("FakeBillingLive", () => {
  it("returns unconfigured checkout and portal", async () => {
    await runBillingEffect(
      Effect.gen(function* () {
        const billing = yield* BillingService;
        const checkout = yield* billing.createCheckout({
          customerId: orgId,
          productSlug: "pro",
        });
        expect(checkout).toEqual({ kind: "unconfigured" });

        const portal = yield* billing.customerPortal({ customerId: orgId });
        expect(portal).toEqual({ kind: "unconfigured" });
      }),
      FakeBillingLive,
    );
  });

  it("denies entitlements", async () => {
    await runBillingEffect(
      Effect.gen(function* () {
        const billing = yield* BillingService;
        const allowed = yield* billing.canUse({
          customerId: orgId,
          capability: "ai.chat.premium",
        });
        expect(allowed).toBe(false);

        const projects = yield* billing.limit({
          customerId: orgId,
          name: "projects",
        });
        expect(projects).toBe(0);
      }),
      FakeBillingLive,
    );
  });
});

describe("billingLiveFromEnv", () => {
  it("uses the fake when Polar secrets are empty", async () => {
    const live = billingLiveFromEnv({});
    expect(live).toBe(FakeBillingLive);

    await runBillingEffect(
      Effect.gen(function* () {
        const billing = yield* BillingService;
        const checkout = yield* billing.createCheckout({
          customerId: orgId,
          productSlug: "pro",
        });
        expect(checkout).toEqual({ kind: "unconfigured" });
        expect(
          yield* billing.canUse({
            customerId: orgId,
            capability: "ai.chat.premium",
          }),
        ).toBe(false);
        expect(
          yield* billing.limit({
            customerId: orgId,
            name: "projects",
          }),
        ).toBe(0);
      }),
      live,
    );
  });

  it("uses Polar live when POLAR_ACCESS_TOKEN is set", async () => {
    const live = billingLiveFromEnv({ POLAR_ACCESS_TOKEN: "pol_placeholder" });
    expect(live).not.toBe(FakeBillingLive);

    const checkout = await runBillingEffect(
      Effect.gen(function* () {
        const billing = yield* BillingService;
        return yield* billing
          .createCheckout({
            customerId: orgId,
            productSlug: "pro",
          })
          .pipe(Effect.result);
      }),
      live,
    );
    expect(checkout._tag).toBe("Failure");
    if (checkout._tag === "Failure") {
      expect(checkout.failure).toBeInstanceOf(BillingError);
      expect(checkout.failure.message).toContain("not wired");
    }

    await runBillingEffect(
      Effect.gen(function* () {
        const billing = yield* BillingService;
        expect(
          yield* billing.canUse({
            customerId: orgId,
            capability: "ai.chat.premium",
          }),
        ).toBe(false);
        expect(
          yield* billing.limit({
            customerId: orgId,
            name: "projects",
          }),
        ).toBe(0);
      }),
      live,
    );
  });
});
