import type { Context } from "hono";

import { ingestPolarWebhook } from "../modules/billing/service";
import { verifyPolarWebhook } from "../platform/billing/webhook";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import { runRequestEffect } from "../platform/effect/runtime";
import type { ApiVariables } from "./context";

type WebhookContext = Context<{ Bindings: ApiBindings; Variables: ApiVariables }>;

/**
 * Polar Standard Webhooks. Raw body, HMAC, then local ledger + entitlement projection.
 */
export async function polarWebhookHandler(c: WebhookContext): Promise<Response> {
  const secret = c.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return c.json({ error: "Polar webhooks are not configured." }, 503);
  }

  const body = await c.req.text();
  let event;
  try {
    event = await verifyPolarWebhook({
      body,
      headers: c.req.raw.headers,
      secret,
    });
  } catch {
    return c.json({ error: "Invalid Polar webhook." }, 403);
  }

  try {
    await runRequestEffect(ingestPolarWebhook(event), c.get("requestContext"), c.env);
  } catch {
    return c.json({ error: "Polar webhook ingest failed." }, 500);
  }

  return c.body(null, 202);
}
