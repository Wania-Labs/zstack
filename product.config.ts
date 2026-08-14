/**
 * Reviewed capability / readiness intent for this product clone.
 * Secrets never live here. Alchemy provisions only what is selected.
 *
 * Template rule: scaffold ready-to-wire adapters; do not bind the author's
 * real SaaS accounts. Core local paths use Compose / console / empty DSN.
 * Optional vendors stay off until a clone sets secrets or flips the manifest.
 * See AUTHORING.md → Template wiring policy.
 *
 * Workflows and queues are backend capabilities on the Hono Worker
 * (`apps/api`), not separate apps. They stay absent until a feature needs them.
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
 * uses an in-memory fake. Alchemy binds a bucket on the API Worker; alchemy:dev
 * uses Alchemy local R2, not a cloud bucket on the author's account.
 *
 * Feature flags are configured: FeatureFlags always exists. The in-memory
 * provider returns the caller-supplied default when a key is missing. No flag SaaS.
 *
 * Billing is configured: BillingService always exists. Empty POLAR_ACCESS_TOKEN
 * keeps checkout/portal unconfigured and entitlements denied. No Polar org or
 * product IDs in source. Clones bind their own Polar token.
 */
export const product = {
  name: "zstack",
  capabilities: {
    workflows: "absent",
    queues: "absent",
    email: "configured",
    observability: "configured",
    ai: "configured",
    database: "planetscale",
    objectStorage: "configured",
    flags: "configured",
    billing: "configured",
  },
} as const;
