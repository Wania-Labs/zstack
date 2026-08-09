/**
 * Reviewed capability / readiness intent for this product clone.
 * Secrets never live here. Alchemy provisions only what is selected.
 *
 * Workflows and queues are backend capabilities on the Hono Worker
 * (`apps/api`), not separate apps. They stay absent until a feature needs them.
 */
export const product = {
  name: "zstack",
  capabilities: {
    workflows: "absent",
    queues: "absent",
  },
} as const;
