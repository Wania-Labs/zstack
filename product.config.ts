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
 * Database is PlanetScale Postgres (Alchemy) with Compose for local Hyperdrive
 * `dev` / wrangler / drizzle-kit.
 */
export const product = {
  name: "zstack",
  capabilities: {
    workflows: "absent",
    queues: "absent",
    email: "configured",
    database: "planetscale",
  },
} as const;
