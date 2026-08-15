# apps/api

Hono Worker on Cloudflare. Prefer `pnpm alchemy:dev` over bare wrangler for full-stack work.

## Layering

- `src/http/` — edge wiring (auth mount, oRPC mount, middleware)
- `src/modules/` — use cases; call platform ports only
- `src/platform/` — Effect `Context.Service` + Layers (db, email, ai, analytics, observability, object store, flags, billing, queue, workflow, cloudflare)
- `src/queues/` — Cloudflare Queue consumer for `JOBS` (same Worker)
- `src/workflows/` — Cloudflare `WorkflowEntrypoint` classes (same Worker)
- `drizzle/` — migrations; run via root `pnpm db:*`

## Do

- Implement oRPC against `@zstack/contracts` in `src/http/orpc.ts`
- Select adapters from env at the Worker edge (empty credential = safe default)
- Keep workflows/queues/cron under this app when they exist
- Before Effect code: read `node_modules/effect/AGENTS.md` and `.agent/skills/effect-ts/SKILL.md`

## Do not

- Import vendor SDKs inside `modules/`
- Treat `wrangler deploy` as the production path
- Put secrets in `product.config.ts`
