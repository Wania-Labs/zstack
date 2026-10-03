export type PolarWebhookEvent = {
  /**
   * Standard Webhooks `webhook-id`: unique per event and stable across retries.
   * Polar payloads carry no top-level event id; `data.id` is the resource id
   * (e.g. the subscription) and repeats across every event for that resource.
   */
  id: string;
  type: string;
  payload: Record<string, unknown>;
  organizationId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function header(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined;
}

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

/**
 * Constant-time string comparison. Length is not secret (HMAC-SHA256 base64 is
 * always 44 chars), so a length mismatch may return early.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function decodeWebhookSecret(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) {
    try {
      const decoded = atob(trimmed.slice("whsec_".length));
      return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    } catch {
      return new TextEncoder().encode(trimmed);
    }
  }
  return new TextEncoder().encode(trimmed);
}

/**
 * Polar uses Standard Webhooks. Secret is often base64; we try that first.
 */
export async function verifyPolarWebhook(input: {
  body: string;
  headers: Headers;
  secret: string;
}): Promise<PolarWebhookEvent> {
  const webhookId = header(input.headers, "webhook-id");
  const timestamp = header(input.headers, "webhook-timestamp");
  const signatureHeader = header(input.headers, "webhook-signature");
  if (!webhookId || !timestamp || !signatureHeader) {
    throw new Error("missing polar webhook headers");
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    throw new Error("polar webhook timestamp expired");
  }

  const expected = await hmacSha256Base64(
    decodeWebhookSecret(input.secret),
    `${webhookId}.${timestamp}.${input.body}`,
  );
  const offered = signatureHeader.split(" ").flatMap((part) => {
    const value = part.trim();
    if (value.startsWith("v1,")) {
      return [value.slice(3)];
    }
    return [];
  });
  // Compare every offered signature without short-circuiting on a match.
  const matched = offered.reduce(
    (found, signature) => timingSafeEqualString(signature, expected) || found,
    false,
  );
  if (!matched) {
    throw new Error("invalid polar webhook signature");
  }

  const parsed: unknown = JSON.parse(input.body);
  if (!isRecord(parsed)) {
    throw new Error("polar webhook payload is not an object");
  }

  const type = typeof parsed.type === "string" ? parsed.type : "unknown";
  const data = isRecord(parsed.data) ? parsed.data : parsed;
  const organizationId = readOrganizationId(data);
  return { id: webhookId, type, payload: parsed, ...(organizationId ? { organizationId } : {}) };
}

function readOrganizationId(data: Record<string, unknown>): string | undefined {
  const direct =
    (typeof data.external_id === "string" && data.external_id) ||
    (typeof data.externalId === "string" && data.externalId) ||
    (typeof data.external_customer_id === "string" && data.external_customer_id);
  if (direct) {
    return direct;
  }
  const customer = data.customer;
  if (isRecord(customer)) {
    if (typeof customer.external_id === "string") {
      return customer.external_id;
    }
    if (typeof customer.externalId === "string") {
      return customer.externalId;
    }
  }
  return undefined;
}

export function snapshotFromPolarState(state: {
  grantedBenefits: ReadonlyArray<{ benefitId?: string; feature?: string }>;
  meters: ReadonlyArray<{ name: string; balance: number }>;
}): { capabilities: string[]; limits: Record<string, number> } {
  const capabilities = [
    ...new Set(
      state.grantedBenefits.flatMap((benefit) => {
        const values = [benefit.feature, benefit.benefitId].filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        );
        return values;
      }),
    ),
  ];
  const limits: Record<string, number> = {};
  for (const meter of state.meters) {
    limits[meter.name] = meter.balance;
  }
  return { capabilities, limits };
}
