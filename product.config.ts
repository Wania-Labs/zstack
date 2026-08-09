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
  },
} as const;
