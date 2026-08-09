import { describe, expect, it } from "vitest";

import { staffCapabilitiesForRole, isStaff } from "../../src/modules/auth/staff";
import {
  listAiCapabilityPolicies,
  getAiCapabilityPolicy,
} from "../../src/platform/ai/capabilities";
import { resolveAiModel, resolveAiRoute } from "../../src/platform/ai/registry";
import { AiLive, runAiEffect } from "../../src/platform/ai/ai-service";
import { completeAi, listAiCapabilities } from "../../src/modules/ai/service";

describe("staffCapabilitiesForRole", () => {
  it("maps admin to staff.console", () => {
    const caps = staffCapabilitiesForRole("admin");
    expect(isStaff(caps)).toBe(true);
    expect(caps.has("staff.console")).toBe(true);
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

    const result = await runAiEffect(
      completeAi({ capability: "chat.fast", prompt: "ping" }),
      AiLive({}),
    );
    expect(result.text).toBe("pong");
    expect(result.route).toBe("fake");
  });
});
