# zstack

Opinionated TypeScript product starter: pnpm, Turborepo, Cloudflare-first backend, portable Postgres.

## Status

- pnpm + Turborepo + TypeScript 7 + Oxlint/Oxfmt
- `apps/api` Hono + Effect + Zod + Drizzle 1.0 RC + Better Auth + oRPC
- `apps/web` TanStack Start + shadcn (Base UI / nova) + TanStack Query
- `@zstack/email` React Email templates + console EmailService (Bento later)
- Alchemy v2 (`alchemy@2.0.0-beta.70`) owns deploy / Hyperdrive / secrets

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
```

### Alchemy (preferred full-stack / deploy)

```bash
# BETTER_AUTH_SECRET must be in the environment for alchemy
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
pnpm alchemy:dev                                   # api :8787 + web :3000
pnpm alchemy:deploy
```

Open http://localhost:3000 for the customer shell (health + sign-in).

## Layout

```text
alchemy.run.ts             # Alchemy v2 stack entry
infra/                     # api / web / database resources
product.config.ts          # capability intent (no secrets)
apps/api/                  # Hono Worker (workflows/queues/cron live here)
apps/web/                  # TanStack Start + shadcn/Base UI
packages/contracts/        # Zod + oRPC contracts
packages/email/            # React Email templates
compose.yaml               # local Postgres 18
```

See [AUTHORING.md](AUTHORING.md).
