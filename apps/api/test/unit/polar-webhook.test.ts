import { describe, expect, it } from "vitest";

import { normalizeCustomerState } from "../../src/platform/billing/billing-service";
import {
  snapshotFromPolarState,
  timingSafeEqualString,
  verifyPolarWebhook,
} from "../../src/platform/billing/webhook";

async function hmacSha256Base64(secretBytes: Uint8Array, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function signedHeaders(input: { secret: string; body: string; id?: string }) {
  const webhookId = input.id ?? "evt_1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await hmacSha256Base64(
    new TextEncoder().encode(input.secret),
    `${webhookId}.${timestamp}.${input.body}`,
  );
  return new Headers({
    "webhook-id": webhookId,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  });
}

describe("verifyPolarWebhook", () => {
  const secret = "polar_whsec_test";
  const body = JSON.stringify({
    type: "order.created",
    data: { external_customer_id: "org_1", status: "paid" },
  });

  it("accepts a valid Standard Webhooks signature", async () => {
    const headers = await signedHeaders({ secret, body });
    const event = await verifyPolarWebhook({ body, headers, secret });
    expect(event.type).toBe("order.created");
    expect(event.organizationId).toBe("org_1");
  });

  it("rejects a bad signature", async () => {
    const headers = await signedHeaders({ secret, body });
    headers.set("webhook-signature", "v1,dG90YWxseV93cm9uZw==");
    await expect(verifyPolarWebhook({ body, headers, secret })).rejects.toThrow(
      "invalid polar webhook signature",
    );
  });

  it("rejects an expired timestamp", async () => {
    const webhookId = "evt_old";
    const timestamp = String(Math.floor(Date.now() / 1000) - 400);
    const signature = await hmacSha256Base64(
      new TextEncoder().encode(secret),
      `${webhookId}.${timestamp}.${body}`,
    );
    const headers = new Headers({
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    });
    await expect(verifyPolarWebhook({ body, headers, secret })).rejects.toThrow(
      "polar webhook timestamp expired",
    );
  });
});

describe("verifyPolarWebhook dedupe key", () => {
  const secret = "polar_whsec_test";

  it("keys events by webhook-id, not the shared resource data.id", async () => {
    // Polar sends no top-level id; every event for a subscription shares data.id.
    const created = JSON.stringify({
      type: "subscription.created",
      data: { id: "sub_123", status: "incomplete", customer: { external_id: "org_1" } },
    });
    const activated = JSON.stringify({
      type: "subscription.active",
      data: { id: "sub_123", status: "active", customer: { external_id: "org_1" } },
    });

    const first = await verifyPolarWebhook({
      body: created,
      headers: await signedHeaders({ secret, body: created, id: "msg_1" }),
      secret,
    });
    const second = await verifyPolarWebhook({
      body: activated,
      headers: await signedHeaders({ secret, body: activated, id: "msg_2" }),
      secret,
    });

    expect(first.id).toBe("msg_1");
    expect(second.id).toBe("msg_2");
    expect(first.id).not.toBe(second.id);
    expect(second.organizationId).toBe("org_1");
  });

  it("keeps the same key when Polar retries a delivery", async () => {
    const body = JSON.stringify({ type: "order.paid", data: { id: "ord_1" } });
    const attempt1 = await verifyPolarWebhook({
      body,
      headers: await signedHeaders({ secret, body, id: "msg_retry" }),
      secret,
    });
    const attempt2 = await verifyPolarWebhook({
      body,
      headers: await signedHeaders({ secret, body, id: "msg_retry" }),
      secret,
    });
    expect(attempt1.id).toBe(attempt2.id);
  });

  it("accepts a valid signature among several offered", async () => {
    const body = JSON.stringify({ type: "order.paid", data: {} });
    const headers = await signedHeaders({ secret, body, id: "msg_multi" });
    headers.set(
      "webhook-signature",
      `v1,dG90YWxseV93cm9uZw== ${headers.get("webhook-signature") ?? ""}`,
    );
    await expect(verifyPolarWebhook({ body, headers, secret })).resolves.toMatchObject({
      id: "msg_multi",
    });
  });
});

describe("timingSafeEqualString", () => {
  it("compares by value", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
    expect(timingSafeEqualString("", "")).toBe(true);
  });
});

describe("normalizeCustomerState", () => {
  it("only grants capabilities named by explicit feature metadata", () => {
    const state = normalizeCustomerState({
      granted_benefits: [
        { benefit_id: "ben_custom", benefit_type: "custom" },
        {
          benefit_id: "ben_ai",
          benefit_type: "custom",
          benefit_metadata: { feature: "ai.chat.smart" },
        },
      ],
      active_meters: [],
    });
    expect(state.grantedBenefits).toEqual([
      { benefitId: "ben_custom" },
      { benefitId: "ben_ai", feature: "ai.chat.smart" },
    ]);
    expect(snapshotFromPolarState(state).capabilities).not.toContain("custom");
  });
});

describe("snapshotFromPolarState", () => {
  it("flattens benefits and meters", () => {
    expect(
      snapshotFromPolarState({
        grantedBenefits: [{ feature: "ai.chat.premium" }, { benefitId: "ben_1" }],
        meters: [{ name: "projects", balance: 3 }],
      }),
    ).toEqual({
      capabilities: ["ai.chat.premium", "ben_1"],
      limits: { projects: 3 },
    });
  });
});
