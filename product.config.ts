/**
 * Reviewed capability / readiness intent for this product clone.
 * Secrets never live here. Alchemy provisions only what is selected.
 *
 * Template rule: scaffold ready-to-wire adapters; do not bind the author's
 * real SaaS accounts. Core local paths use Compose / console / empty DSN.
 * Optional vendors stay off until a clone sets secrets or flips the manifest.
 * See AUTHORING.md → Template wiring policy.
 *
 * Workflows and queues are configured: JobQueue and DurableWorkflow always
 * exist. Missing Worker bindings use in-memory fakes. Alchemy binds a Queue
 * producer/consumer and the example Cloudflare Workflow on the API Worker.
 *
 * Email is configured: React Email + EmailService always exist. Transport is
 * console until Bento credentials are bound (`EMAIL_FROM` + `BENTO_*`).
 *
 * Observability is configured: Sentry + evlog are wired. Empty DSNs keep the
 * SDKs and Sentry drain off until a clone binds project credentials.
 *
 * AI is configured: capability registry + Effect AiService + oRPC. Empty
 * `AI_GATEWAY_API_KEY` keeps the deterministic fake model (no spend).
 *
 * Database is PlanetScale Postgres on deploy (Alchemy). Local `alchemy:dev`
 * and wrangler / drizzle-kit use Compose only — no cloud DB create.
 *
 * Object storage is configured: ObjectStore always exists. Missing R2 binding
 * uses an in-memory fake. Sign intents use Worker `/api/objects/*` until R2
 * S3 API tokens are set, then aws4fetch presigns. Alchemy binds a bucket on
 * the API Worker; alchemy:dev uses Alchemy local R2, not a cloud bucket on
 * the author's account.
 *
 * Feature flags are configured: FeatureFlags always exists. The in-memory
 * provider returns the caller-supplied default when a key is missing. No flag SaaS.
 *
 * Billing is configured: BillingService always exists. Empty POLAR_ACCESS_TOKEN
 * keeps checkout/portal unconfigured and entitlements denied. With a token,
 * checkout/portal call Polar HTTP. Verified Polar webhooks write a unique
 * Postgres ledger and entitlement projection; canUse/limit read the projection
 * first and fall back to Polar customer state. Usage goes through an outbox
 * job (`billing.usage`) then Polar `events.ingest`. No Polar org or product IDs
 * in source.
 *
 * Analytics is configured: typed events in `@zstack/analytics`. Empty
 * POSTHOG_API_KEY / VITE_PUBLIC_POSTHOG_KEY keeps a no-op client. Staff capture
 * is skipped. PostHog flags stay off.
 */
export const product = {
  name: "zstack",
  capabilities: {
    workflows: "configured",
    queues: "configured",
    email: "configured",
    observability: "configured",
    ai: "configured",
    database: "planetscale",
    objectStorage: "configured",
    flags: "configured",
    billing: "configured",
    analytics: "configured",
  },
} as const;
