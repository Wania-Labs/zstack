/**
 * Reviewed capability intent for this product clone. Secrets never live here.
 *
 * Intent only: nothing reads this file today. Not the API runtime, not
 * `alchemy.run.ts` (which always provisions Hyperdrive, R2, the jobs Queue, and
 * the example Workflow), not CI. Actual on/off comes from Alchemy resources in
 * `infra/*` plus empty vs set env (see `.env.example`, `apps/api/.dev.vars.example`).
 * Keep it in sync with AUTHORING.md → Template wiring policy so humans and agents
 * share one capability table.
 */

/**
 * - `core`: always on with a free/local default (Compose, Better Auth, Paraglide).
 * - `absent`: no Effect Layer, no Alchemy resource, no fake production fallback.
 * - `configured`: code + Alchemy bindings exist; stays fake / no-op / console
 *   until a clone sets secrets or flags.
 * - `enabled`: reserved for live-by-default once a clone commits to a vendor.
 */
export type CapabilityState = "core" | "absent" | "configured" | "enabled";

export type Capability =
  | "database"
  | "auth"
  | "i18n"
  | "email"
  | "observability"
  | "objectStorage"
  | "flags"
  | "billing"
  | "workflows"
  | "queues"
  | "analytics"
  | "ai";

export type ProductConfig = {
  readonly name: string;
  readonly capabilities: Readonly<Record<Capability, CapabilityState>>;
  /** Deploy-time vendor choices. Local dev always uses Compose. */
  readonly deploy: { readonly database: "planetscale" };
};

export const product = {
  name: "zstack",
  capabilities: {
    database: "core",
    auth: "core",
    i18n: "core",
    email: "configured",
    observability: "configured",
    objectStorage: "configured",
    flags: "configured",
    billing: "configured",
    workflows: "configured",
    queues: "configured",
    analytics: "configured",
    ai: "configured",
  },
  deploy: { database: "planetscale" },
} as const satisfies ProductConfig;
