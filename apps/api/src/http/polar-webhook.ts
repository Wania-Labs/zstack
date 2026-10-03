import type { Context } from "hono";

import { ingestPolarWebhook } from "../modules/billing/service";
import { verifyPolarWebhook } from "../platform/billing/webhook";
import type { ApiEnv } from "./context";
import { reportError } from "./report-error";

type WebhookContext = Context<ApiEnv>;

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
  } catch (error) {
    // Rejected deliveries are client errors: log for debugging, no Sentry noise.
    c.get("log").warn("polar webhook rejected", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return c.json({ error: "Invalid Polar webhook." }, 403);
  }

  try {
    await c.get("runEffect")(ingestPolarWebhook(event));
  } catch (error) {
    reportError(c.get("log"), error, "billing.polarWebhook");
    return c.json({ error: "Polar webhook ingest failed." }, 500);
  }

  return c.body(null, 202);
}
