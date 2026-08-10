# Playbook: add or swap a platform adapter

Use when changing how email, AI, DB, or observability is provided at runtime.

## Steps

1. Define or extend the Effect `Context.Service` port under `apps/api/src/platform/<area>/`.
2. Implement the live adapter (vendor) and the safe default (console / fake / no-op).
3. Select the Layer at the Worker edge from env (empty credentials → safe default).
4. Keep `modules/` importing only the port.
5. Document new env keys in `apps/api/.dev.vars.example` (and Alchemy `infra` bindings if needed).
6. Leave `product.config.ts` as intent. Do not put secrets there.

## Common mistakes

- Importing Bento / AI Gateway / Sentry directly from a module
- Shipping a “configured” vendor path that fails hard when secrets are empty
- Binding the template author’s real SaaS accounts into the starter
