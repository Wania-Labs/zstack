# Agent guide

Rules for coding agents working in this product tree. Prefer these constraints over inventing a second architecture.

Deep tutorials live on the zstack docs site when published. This file must stay useful without that site.

## Layout

| Path                        | Role                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/api`                  | Hono Worker: HTTP, oRPC, Effect modules + platform ports                                     |
| `apps/web`                  | Customer TanStack Start app                                                                  |
| `apps/admin`                | Staff TanStack Start console                                                                 |
| `packages/contracts`        | Zod + oRPC contracts (client-safe)                                                           |
| `packages/email`            | React Email templates only (no transport)                                                    |
| `packages/auth-access`      | Better Auth admin role access control                                                        |
| `packages/i18n`             | Paraglide catalogs; compiled messages and runtime                                            |
| `infra/` + `alchemy.run.ts` | Cloudflare + PlanetScale resources (Alchemy **v2 IaC**, not blockchain Alchemy)              |
| `product.config.ts`         | Capability **intent** only. Not imported by runtime today. No secrets.                       |
| `.agent/playbooks/`         | Multi-step procedures                                                                        |
| `.agent/skills/`            | Agent skills (Effect, …). Tool packs may copy these into `.cursor/skills` / `.claude/skills` |

Nested `AGENTS.md` files add package-local rules. Read the nearest one when editing that tree.

## Hard rules

1. **Alchemy owns deploy.** Entry is `alchemy.run.ts` + `infra/*`. `wrangler` in `apps/api` is local/dry-run only. Do not add a parallel Wrangler deploy path.
2. **Modules call ports.** Feature code under `apps/api/src/modules/` uses Effect services from `apps/api/src/platform/`. Do not import Bento, AI Gateway, Sentry, R2 SDK, Polar SDK, or console email adapters directly from modules.
3. **Frontends import contracts and i18n only.** `apps/web` and `apps/admin` may import `@zstack/contracts` and `@zstack/i18n`. They must not import `apps/api` source.
4. **Keep `patches/`.** The three pnpm patches under `patches/` are required for Effect / Drizzle / Alchemy beta interop. Removing them breaks the Alchemy CLI or the Worker at startup.
5. **No `@cloudflare/vite-plugin` on web/admin.** Alchemy injects its own under `alchemy dev` / deploy.
6. **Secrets stay out of `product.config.ts`.** Flip optional vendors with empty vs set env (see `.dev.vars.example`).
7. **Workflows and queues stay inside `apps/api`.** Do not create separate Worker apps for them.

## Effect v4

Before writing Effect / Layer / Schema / `@effect/sql*` code:

1. Read `node_modules/effect/AGENTS.md` completely (pnpm may nest it under `node_modules/.pnpm/effect@…/node_modules/effect/`).
2. Prefer searching `node_modules/effect/src` and related `@effect/*` packages over web search.
3. Follow `.agent/skills/effect-ts/SKILL.md`.

Optional deeper checkout (Effect’s recommended agent workflow): `pnpm agent:vendor-effect` vendors upstream into `repos/effect/` via **git subtree** (default) or `--submodule`. Treat `repos/**` as read-only reference. Never import app code from `repos/`. See `.agent/playbooks/vendor-effect.md`.

## Dependency knowledge (MCPs + Context7)

When agent packs write MCP config (`create-zstack --agent-tools=… --mcp=…`):

| Server                     | Group   | Use for                                                                                               |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `cloudflare-docs`          | docs    | Workers / platform reference                                                                          |
| `context7`                 | docs    | Live docs for Effect, Drizzle, Hono, TanStack, Better Auth, oRPC, Zod, AI SDK, Alchemy IaC package, … |
| `shadcn`                   | docs    | Component registry (`apps/web`, `apps/admin`)                                                         |
| `cloudflare-bindings`      | account | Bindings against a Cloudflare account (OAuth)                                                         |
| `cloudflare-observability` | account | Workers logs (OAuth)                                                                                  |
| `sentry`                   | account | Issues/traces when DSNs are bound (OAuth)                                                             |
| `planetscale`              | account | Deployed Postgres schema / Insights (OAuth)                                                           |

`--mcp=defaults` (alias `docs`) installs the docs group. `--mcp=account` or `--mcp=all` adds OAuth servers. There is **no** Bento MCP; email stays console until `EMAIL_FROM` + `BENTO_*`. Do **not** configure blockchain Alchemy MCP (`mcp.alchemy.com`) — wrong product.

Skills for Cursor/Claude: `--skills=copy` (default), `symlink` (relative link from `.cursor/skills` / `.claude/skills` → `.agent/skills`), or `none`. Canonical skills always live under `.agent/skills/`.

## Commands

```bash
pnpm install
pnpm dev:services          # Compose Postgres 18
pnpm db:migrate && pnpm db:seed
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm alchemy:dev           # preferred: api :8787 + web :3000 + admin :3001

pnpm typecheck && pnpm lint && pnpm test
pnpm alchemy:deploy        # provisions PlanetScale + Hyperdrive (needs alchemy login)
pnpm agent:vendor-effect   # optional: subtree Effect source under repos/effect
```

Escape hatch (dual process): `pnpm --filter @zstack/api|web|admin dev`. Vite proxies `/api` to `:8787`.

Staff promote after sign-up: `STAFF_EMAIL=you@example.com pnpm db:seed`.

## Env split

| Concern              | Local wrangler                                           | Alchemy                            |
| -------------------- | -------------------------------------------------------- | ---------------------------------- |
| `BETTER_AUTH_SECRET` | `apps/api/.dev.vars`                                     | Process / stage env                |
| Compose DB           | `DATABASE_URL` / Hyperdrive → Compose when `ALCHEMY_DEV` | Deploy uses PlanetScale origin     |
| Optional vendors     | Empty in `.dev.vars` → safe defaults                     | Same: empty = off / fake / console |

## Playbooks

- [Add a capability](.agent/playbooks/add-capability.md)
- [Swap an adapter](.agent/playbooks/swap-adapter.md)
- [Alchemy deploy](.agent/playbooks/deploy-alchemy.md)
- [Database migrations](.agent/playbooks/database-migrations.md)
- [Vendor Effect for agents](.agent/playbooks/vendor-effect.md)

## Product AI vs coding agents

`apps/api` AI (`AiService`, gateway key, oRPC `ai.*`) is a **product** feature for end users. It is unrelated to this file, Cursor/Claude/OpenCode setup, or MCP configs.
