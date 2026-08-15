import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { completeAi, listAiCapabilities } from "../../src/modules/ai/service";
import { isStaff, staffCapabilitiesForRole } from "../../src/modules/auth/staff";
import type { RequestContext } from "../../src/http/context";
import { AiLive, runAiEffect } from "../../src/platform/ai/ai-service";
import {
  getAiCapabilityPolicy,
  listAiCapabilityPolicies,
} from "../../src/platform/ai/capabilities";
import { resolveAiModel, resolveAiRoute } from "../../src/platform/ai/registry";
import {
  BillingError,
  FakeBillingLive,
  PolarBillingLive,
  type PolarTransport,
} from "../../src/platform/billing/billing-service";
import { CurrentRequestContext } from "../../src/platform/effect/request-context";

const guestRequest: RequestContext = {
  requestId: "req_test",
  releaseId: "local",
  actor: { type: "user", userId: "user_1" },
  locale: "en",
};

function completeAiLayer(request: RequestContext, billing = FakeBillingLive) {
  return Layer.mergeAll(AiLive({}), billing, Layer.succeed(CurrentRequestContext, request));
}

function runCompleteAi<A>(
  effect: Effect.Effect<A, unknown, unknown>,
  live: Layer.Layer<never, never, unknown>,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)) as Effect.Effect<A>);
}

describe("staffCapabilitiesForRole", () => {
  it("maps admin to staff.console", () => {
    const caps = staffCapabilitiesForRole("admin");
    expect(isStaff(caps)).toBe(true);
    expect(caps.has("staff.console")).toBe(true);
  });

  it("maps support, operations, and owner", () => {
    for (const role of ["support", "operations", "owner"] as const) {
      const caps = staffCapabilitiesForRole(role);
      expect(isStaff(caps)).toBe(true);
      expect(caps.has("staff.console")).toBe(true);
    }
  });

  it("unions comma-separated staff roles", () => {
    const caps = staffCapabilitiesForRole("support,operations");
    expect(isStaff(caps)).toBe(true);
  });

  it("returns empty for customers", () => {
    expect(isStaff(staffCapabilitiesForRole("user"))).toBe(false);
    expect(isStaff(staffCapabilitiesForRole(undefined))).toBe(false);
  });
});

describe("ai registry", () => {
  it("lists the starter capabilities", () => {
    expect(listAiCapabilityPolicies().map((p) => p.id)).toEqual([
      "chat.fast",
      "chat.smart",
      "extract.structured",
    ]);
    expect(getAiCapabilityPolicy("chat.fast").gatewayModelId).toContain("/");
  });

  it("uses fake route without a gateway key", () => {
    expect(resolveAiRoute({})).toBe("fake");
    const resolved = resolveAiModel("chat.fast", {});
    expect(resolved.route).toBe("fake");
    expect(resolved.modelId).toBe("fake/chat.fast");
  });

  it("uses gateway route when AI_GATEWAY_API_KEY is set", () => {
    expect(resolveAiRoute({ AI_GATEWAY_API_KEY: "test-key" })).toBe("gateway");
    const resolved = resolveAiModel("chat.fast", { AI_GATEWAY_API_KEY: "test-key" });
    expect(resolved.route).toBe("gateway");
    expect(resolved.modelId).toBe("openai/gpt-4.1-mini");
  });
});

describe("AiService fake complete", () => {
  it("lists capabilities and completes ping → pong", async () => {
    const listed = await runAiEffect(listAiCapabilities(), AiLive({}));
    expect(listed.provider).toBe("fake");
    expect(listed.capabilities.length).toBeGreaterThan(0);

    const result = await runCompleteAi(
      completeAi({ capability: "chat.fast", prompt: "ping" }),
      completeAiLayer(guestRequest),
    );
    expect(result.text).toBe("pong");
    expect(result.route).toBe("fake");
  });

  it("denies AI when Polar is live and the org lacks the entitlement", async () => {
    const transport: PolarTransport = {
      createCheckout: async () => ({ url: "https://example.com/checkout" }),
      createCustomerSession: async () => ({ customer_portal_url: "https://example.com/portal" }),
      getCustomerState: async () => undefined,
      ingestUsage: async () => ({}),
    };
    const billing = PolarBillingLive(
      { accessToken: "pol_test", server: "sandbox" },
      new Map([["pro", "prod_abc123"]]),
      undefined,
      transport,
    );
    const request: RequestContext = {
      ...guestRequest,
      organizationId: "org_1",
    };

    await expect(
      runCompleteAi(
        completeAi({ capability: "chat.fast", prompt: "ping" }),
        completeAiLayer(request, billing),
      ),
    ).rejects.toBeInstanceOf(BillingError);
  });
});
