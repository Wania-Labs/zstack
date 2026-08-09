/**
 * Reviewed capability / readiness intent for this product clone.
 * Secrets never live here. Alchemy provisions only what is selected.
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
    database: "planetscale",
  },
} as const;
