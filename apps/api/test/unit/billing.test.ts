import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  BillingError,
  BillingService,
  FakeBillingLive,
  PolarBillingLive,
  billingLiveFromEnv,
  readPolarCredentials,
  readProductCatalog,
  runBillingEffect,
  type PolarTransport,
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
        expect(yield* billing.remaining({ customerId: orgId, name: "projects" })).toBe(0);
        expect(yield* billing.entitlement({ customerId: orgId, name: "ai.chat.premium" })).toEqual({
          granted: false,
          remaining: 0,
        });
        expect(
          yield* billing.ingestUsage({
            customerId: orgId,
            name: "ai.generation",
            operationId: "op_1",
          }),
        ).toEqual({});
        expect(yield* billing.isConfigured()).toBe(false);
      }),
      FakeBillingLive,
    );
  });
});

describe("readProductCatalog", () => {
  it("reads product mappings from env vars", () => {
    const catalog = readProductCatalog({
      POLAR_PRODUCT_PRO: "prod_abc123",
      POLAR_PRODUCT_ENTERPRISE: "prod_xyz789",
      OTHER_VAR: "ignored",
    });

    expect(catalog.get("pro")).toBe("prod_abc123");
    expect(catalog.get("enterprise")).toBe("prod_xyz789");
    expect(catalog.has("other_var")).toBe(false);
  });

  it("normalizes slugs to lowercase", () => {
    const catalog = readProductCatalog({
      POLAR_PRODUCT_PRO: "prod_abc",
      POLAR_PRODUCT_STARTER: "prod_def",
    });

    expect(catalog.get("pro")).toBe("prod_abc");
    expect(catalog.get("starter")).toBe("prod_def");
  });

  it("ignores empty values", () => {
    const catalog = readProductCatalog({
      POLAR_PRODUCT_PRO: "prod_abc",
      POLAR_PRODUCT_EMPTY: "",
      POLAR_PRODUCT_WHITESPACE: "   ",
    });

    expect(catalog.get("pro")).toBe("prod_abc");
    expect(catalog.has("empty")).toBe(false);
    expect(catalog.has("whitespace")).toBe(false);
  });

  it("returns empty map when no product vars present", () => {
    const catalog = readProductCatalog({
      SOME_OTHER_VAR: "value",
    });

    expect(catalog.size).toBe(0);
  });
});

describe("readPolarCredentials", () => {
  it("reads sandbox credentials by default", () => {
    const credentials = readPolarCredentials({
      POLAR_ACCESS_TOKEN: "pol_test123",
    });

    expect(credentials).toEqual({
      accessToken: "pol_test123",
      server: "sandbox",
    });
  });

  it("reads production credentials when specified", () => {
    const credentials = readPolarCredentials({
      POLAR_ACCESS_TOKEN: "pol_test123",
      POLAR_SERVER: "production",
    });

    expect(credentials).toEqual({
      accessToken: "pol_test123",
      server: "production",
    });
  });

  it("returns undefined when token is missing", () => {
    const credentials = readPolarCredentials({});
    expect(credentials).toBeUndefined();
  });

  it("returns undefined when token is empty", () => {
    const credentials = readPolarCredentials({
      POLAR_ACCESS_TOKEN: "   ",
    });
    expect(credentials).toBeUndefined();
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

  it("uses Polar live when POLAR_ACCESS_TOKEN is set", () => {
    const live = billingLiveFromEnv({
      POLAR_ACCESS_TOKEN: "pol_placeholder",
      POLAR_PRODUCT_PRO: "prod_test123",
    });
    expect(live).not.toBe(FakeBillingLive);
  });
});

describe("PolarBillingLive", () => {
  it("fails with BillingError when product slug not in catalog", async () => {
    const catalog = new Map([["pro", "prod_abc123"]]);
    const live = PolarBillingLive({ accessToken: "pol_test", server: "sandbox" }, catalog);

    try {
      await runBillingEffect(
        Effect.gen(function* () {
          const billing = yield* BillingService;
          return yield* billing.createCheckout({
            customerId: orgId,
            productSlug: "enterprise",
          });
        }),
        live,
      );
      // Should not reach here
      expect.fail("Expected BillingError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BillingError);
      expect((error as BillingError).message).toContain("not found in catalog");
    }
  });

  it("reads entitlements from Polar customer state", async () => {
    const catalog = new Map([["pro", "prod_abc123"]]);
    const transport: PolarTransport = {
      createCheckout: async () => ({ url: "https://example.com/checkout" }),
      createCustomerSession: async () => ({
        customer_portal_url: "https://example.com/portal",
      }),
      getCustomerState: async () => ({
        grantedBenefits: [{ feature: "ai.chat.premium" }],
        meters: [{ name: "projects", balance: 4 }],
      }),
      ingestUsage: async () => ({ polarEventId: "op_usage" }),
    };
    const live = PolarBillingLive(
      { accessToken: "pol_test", server: "sandbox" },
      catalog,
      undefined,
      transport,
    );

    await runBillingEffect(
      Effect.gen(function* () {
        const billing = yield* BillingService;
        expect(
          yield* billing.canUse({
            customerId: orgId,
            capability: "ai.chat.premium",
          }),
        ).toBe(true);
        expect(
          yield* billing.canUse({
            customerId: orgId,
            capability: "missing.capability",
          }),
        ).toBe(false);
        expect(
          yield* billing.limit({
            customerId: orgId,
            name: "projects",
          }),
        ).toBe(4);
        expect(
          yield* billing.remaining({
            customerId: orgId,
            name: "projects",
          }),
        ).toBe(4);
        expect(
          yield* billing.entitlement({
            customerId: orgId,
            name: "ai.chat.premium",
          }),
        ).toEqual({ granted: true, remaining: 0 });
        expect(
          yield* billing.ingestUsage({
            customerId: orgId,
            name: "ai.generation",
            operationId: "op_usage",
          }),
        ).toEqual({ polarEventId: "op_usage" });
        expect(yield* billing.isConfigured()).toBe(true);
      }),
      live,
    );
  });

  it("denies entitlements when Polar has no customer yet", async () => {
    const catalog = new Map([["pro", "prod_abc123"]]);
    const transport: PolarTransport = {
      createCheckout: async () => ({ url: "https://example.com/checkout" }),
      createCustomerSession: async () => ({
        customer_portal_url: "https://example.com/portal",
      }),
      getCustomerState: async () => undefined,
      ingestUsage: async () => ({}),
    };
    const live = PolarBillingLive(
      { accessToken: "pol_test", server: "sandbox" },
      catalog,
      undefined,
      transport,
    );

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
