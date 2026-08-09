# zstack

Opinionated TypeScript product starter: pnpm, Turborepo, Cloudflare-first backend, portable Postgres.

## Status

- pnpm + Turborepo + TypeScript 7 + Oxlint/Oxfmt
- `apps/api` Hono + Effect + Zod + Drizzle 1.0 RC + Better Auth + oRPC
- `apps/web` TanStack Start + shadcn (Base UI / nova) + TanStack Query

Wrangler is local-only. Alchemy will own Hyperdrive/PlanetScale and production secrets.

## Commands

```bash
pnpm install
pnpm dev:services
pnpm db:migrate
pnpm db:seed
cp apps/api/.dev.vars.example apps/api/.dev.vars   # BETTER_AUTH_URL=http://localhost:3000
pnpm --filter @zstack/api dev                       # :8787
pnpm --filter @zstack/web dev                      # :3000, proxies /api → api
```

Open http://localhost:3000 for the customer shell (health + sign-in).

## Layout

```text
apps/api/                  # Hono Worker
apps/web/                  # TanStack Start + shadcn/Base UI
packages/contracts/        # Zod + oRPC contracts
compose.yaml               # local Postgres 18
```

See [AUTHORING.md](AUTHORING.md).
