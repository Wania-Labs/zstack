# zstack

Opinionated TypeScript product starter: pnpm, Turborepo, Cloudflare-first backend, portable Postgres.

Optional vendors (Sentry, Bento, …) are scaffolded and **off until a clone binds credentials**. Local core path is Compose Postgres + `alchemy:dev` — no paid cloud required for day-to-day work.

## Status

- pnpm + Turborepo + TypeScript 7 + Oxlint/Oxfmt
- `apps/api` Hono + Effect + Zod + Drizzle 1.0 RC + Better Auth + oRPC
- `apps/web` TanStack Start + shadcn (Base UI / nova) + TanStack Query
- `apps/admin` staff TanStack Start shell (Better Auth admin role → `staff.me` gate)
- `@zstack/email` React Email + EmailService (console default, Bento when secrets set)
- Alchemy v2 (`alchemy@2.0.0-beta.70`) owns deploy / PlanetScale / Hyperdrive / secrets
- Sentry + evlog scaffolded (DSN-gated; quiet until consumers bind projects)
- AI capability registry + Effect AiService (fake until `AI_GATEWAY_API_KEY`)
- Vitest + vitest-evals (deterministic) in CI; workerd pool optional
- `create-zstack` authoring CLI (citty + giget + nypm; excluded from clones)

Workflows and queues (when selected) live **inside** `apps/api` — same Hono Worker, not separate apps.

## Commands

```bash
pnpm install
pnpm dev:services
pnpm db:migrate
pnpm db:seed
cp apps/api/.dev.vars.example apps/api/.dev.vars   # BETTER_AUTH_URL=http://localhost:3000
```

### Local (wrangler + Vite)

```bash
pnpm --filter @zstack/api dev                       # :8787
pnpm --filter @zstack/web dev                      # :3000, proxies /api → api
pnpm --filter @zstack/admin dev                    # :3001, staff console
```

### Alchemy (preferred full-stack / deploy)

```bash
# Cloudflare + PlanetScale auth via Alchemy profiles
alchemy login
# BETTER_AUTH_SECRET must be in the environment for alchemy
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
pnpm alchemy:dev                                   # api :8787 + web :3000 + admin :3001 (Compose only)
pnpm alchemy:deploy                                # provisions PlanetScale + Hyperdrive
```

Open http://localhost:3000 for the customer shell. Staff console: http://localhost:3001 (promote with `STAFF_EMAIL=… pnpm db:seed` after sign-up).

## CI

Product PRs run `.github/workflows/ci.yml` (ignores `docs/**`). Docs changes run `.github/workflows/docs.yml` against the standalone `docs/` lockfile.

```bash
pnpm test              # api unit + vitest-evals (fake)
pnpm test:workers      # optional workerd pool
pnpm create-zstack my-app
cd docs && pnpm install && pnpm dev   # authoring docs :4000
```

## Layout

```text
alchemy.run.ts             # Alchemy v2 stack entry
infra/                     # api / web / admin / database resources
product.config.ts          # capability intent (no secrets)
AGENTS.md                  # coding-agent playbook (ships to clones)
.agent/playbooks/          # multi-step agent procedures
.agent/skills/             # agent skills (Effect, …)
scripts/vendor-effect.mjs  # optional git subtree/submodule of Effect-TS/effect
apps/api/                  # Hono Worker (workflows/queues/cron live here)
apps/web/                  # TanStack Start customer shell
apps/admin/                # TanStack Start staff console
packages/contracts/        # Zod + oRPC contracts
packages/email/            # React Email templates
create-zstack/             # authoring-only scaffold CLI (not in clones)
docs/                      # authoring-only docs site (own lockfile/CI; not in clones)
compose.yaml               # local Postgres 18
```

See [AUTHORING.md](AUTHORING.md). Agents: [AGENTS.md](AGENTS.md).
