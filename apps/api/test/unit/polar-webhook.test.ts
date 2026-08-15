import { describe, expect, it } from "vitest";

import { snapshotFromPolarState, verifyPolarWebhook } from "../../src/platform/billing/webhook";

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
