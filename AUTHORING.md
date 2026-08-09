# Authoring notes

This file is for people building zstack itself. `create-zstack` must exclude it from consumer clones.

## Consumer ignore contract

When `create-zstack` downloads this template with giget, skip at least:

```text
tech-stack-architecture-guide/**
AUTHORING.md
.cursor/
.cursor/plans/
create-zstack/**
docs/**
```

Also exclude any future authoring-only paths (internal plans, draft CLIs, unpublished create-package sources that are not part of the product template). The ignore list is encoded in `create-zstack/src/cli.ts` (`CONSUMER_IGNORE`) — keep both in sync.

## What consumers get

The product monorepo: `apps/`, `packages/`, root toolchain configs, and later `AGENTS.md` files that teach agents how to work in the tree.

Human architecture docs live on the separate zstack website, not in cloned products.

## Packaging stack

- **citty** — `create-zstack` CLI (`create-zstack/` in this repo; authoring-only)
- **giget** — template download without git history (`ignore` for the paths above)
- **nypm** — install with the user's package manager

Local smoke against this tree:

```bash
ZSTACK_TEMPLATE=file:$(pwd) pnpm create-zstack /tmp/zstack-smoke --force
```

Default remote template: `gh:Wania-Labs/zstack` (override with `--template` or `ZSTACK_TEMPLATE`).

## Notes from scaffolding

`create-hono` with an absolute target path under this monorepo wrote into a relative `Users/...` tree inside the workspace. Prefer scaffolding into a temp directory (or use the official `honojs/starter` template via giget) and copy into `apps/*`.

## Template wiring policy

This repo is a **starter template**, not a product under the author's SaaS accounts.

1. **Do not provision or bind real third-party projects** for this repo (Sentry orgs, Bento sites, Polar, PostHog, paid PlanetScale clusters for "smoke," etc.) unless the human explicitly asks to exercise a live path.
2. **Scaffold ready-to-wire code** — SDKs, adapters, Alchemy env slots, docs — so a clone can turn a capability on by config/secrets.
3. **Core to local functionality may be always-on with a free/local default:** Compose Postgres, Better Auth against that DB, Hono/oRPC, web/admin shells. Those must work with `pnpm alchemy:dev` + `pnpm dev:services` and no paid vendors.
4. **Everything else is opt-in** via `product.config.ts` (`absent` | `configured` | later `enabled`) and/or empty credentials:
   - `absent` — no Effect Layer, no Alchemy resource, no fake production fallback.
   - `configured` — code + Alchemy bindings exist; behavior stays off/no-op until secrets or flags are set (Bento, Sentry).
5. Prefer **empty env defaults** over dummy cloud accounts. Prefer **console / Compose / local workerd** over hitting a vendor during template authoring.

| Capability                       | State today | Live default                                                             |
| -------------------------------- | ----------- | ------------------------------------------------------------------------ |
| Postgres                         | core        | Compose locally; PlanetScale only on `alchemy:deploy` (consumer chooses) |
| Auth / orgs / staff              | core        | Better Auth + Compose                                                    |
| Email                            | configured  | Console until `EMAIL_FROM` + `BENTO_*`                                   |
| Observability                    | configured  | Off until `SENTRY_DSN` / `VITE_SENTRY_DSN*`                              |
| Workflows / queues               | absent      | Not scaffolded as live infra yet                                         |
| Billing / analytics / R2 / flags | not started | Must follow this policy when added                                       |
| AI                               | configured  | Fake models until `AI_GATEWAY_API_KEY`                                   |

## Deploy authority

Alchemy v2 (`alchemy@2.0.0-beta.*`) is the sole owner of provisioned Cloudflare resources, secret bindings, and production deploys. Entry: `alchemy.run.ts` + `infra/*`. Pin the exact beta and upgrade with Effect.

`wrangler` in `apps/api` remains a local development / dry-run escape hatch. Do not grow a parallel Wrangler deploy path.

Hyperdrive is declared in `infra/database.ts`. Under `alchemy:dev` (`ALCHEMY_DEV`), PlanetScale resources are skipped and Hyperdrive origin is Compose (`pnpm dev:services`). Under `alchemy:deploy` / `plan`, cloud origin comes from a PlanetScale `PostgresRole` (`AppRole.origin`) and Hyperdrive `dev` still points at Compose. Migrations stay on drizzle-kit against `DATABASE_URL` — Alchemy `migrationsDir` is not wired yet (expects flat numeric-prefixed `.sql`, not Drizzle 1.0 folders).

PlanetScale auth for `alchemy plan` / `deploy`: `alchemy login` (or token credentials). Not required for `alchemy:dev`. Optional `PLANETSCALE_REGION` (default `us-east`). Cluster size is `PS_DEV`, Postgres major `18` to match Compose.

`BETTER_AUTH_SECRET` for wrangler lives in ignored `apps/api/.dev.vars`. For Alchemy, set it in the process env / stage secret store (`Config.redacted("BETTER_AUTH_SECRET")`). Regenerate with `openssl rand -base64 32` or `pnpm dlx auth@latest secret`.

`BETTER_AUTH_URL` defaults to `http://localhost:3000` (web is the public origin). Vite proxies `/api/*` to the API Worker on `:8787` for the dual-process local path.

Do not add `@cloudflare/vite-plugin` to `apps/web` — Alchemy injects its own under `alchemy dev` / deploy.

## Frontend UI

`apps/web` (customer) and `apps/admin` (staff) both use shadcn **base-nova** (Base UI primitives + default neutral theme, light/dark via `.dark`). Add components with:

```bash
pnpm --filter @zstack/web exec shadcn add button
pnpm --filter @zstack/admin exec shadcn add button
```

Interactive `shadcn init` prompts are flaky under TanStack Start; `components.json` is committed so `add` works non-interactively.

Admin is staff-only: Better Auth Admin plugin supplies `user.role` / impersonation fields; product code maps roles (`admin`, `support`, `operations`, `owner`) to `staffCapabilities` on the request context. `staff.me` oRPC rejects non-staff. Promote a user after customer sign-up:

```bash
STAFF_EMAIL=you@example.com pnpm db:seed
```

Local admin: `http://localhost:3001` (`alchemy:dev` or `pnpm --filter @zstack/admin dev` with API on `:8787`).

## Observability

Sentry + evlog are scaffolded and **off until DSNs are set** (same pattern as Bento email).

- `apps/api`: `@sentry/hono/cloudflare` + `evlog` with `evlog/sentry` drain. Bind `SENTRY_DSN` (wrangler `.dev.vars` or Alchemy env).
- `apps/web` / `apps/admin`: `@sentry/tanstackstart-react` in the router. Set `VITE_SENTRY_DSN` (or Alchemy `VITE_SENTRY_DSN_WEB` / `VITE_SENTRY_DSN_ADMIN`).
- Consumers create their own Sentry projects — this template does not ship org DSNs.
- Source maps / `SENTRY_AUTH_TOKEN` / Vite upload plugin can be added per-clone when shipping production builds.

Suggested project split: one Sentry project each for api, web, and admin.

## CI

Product gate: `.github/workflows/ci.yml` — typecheck / test / lint / format for the monorepo. **Ignores `docs/**`.**

Docs gate: `.github/workflows/docs.yml` — install/typecheck/lint/format/build **inside `docs/` only** (separate lockfile). Never fold docs into the product job.

`pnpm test` runs API unit tests plus deterministic `vitest-evals` (fake models). Workerd pool tests (`pnpm test:workers`) stay local/optional. Depot runners, DB/integration jobs, Playwright, Alchemy plan/deploy, and cloud previews come later.

## Docs site (authoring only)

`docs/` is a standalone TanStack Start + Fumadocs site. Not in `pnpm-workspace.yaml`, not in Alchemy, not in product turbo tasks, excluded from `create-zstack`.

```bash
cd docs && pnpm install && pnpm dev   # :4000
```

## Testing and evals

- **Unit:** Vitest (node) in `apps/api` — `pnpm --filter @zstack/api test:unit`
- **Evals:** `vitest-evals` + `@vitest-evals/harness-ai-sdk` — `test/evals/*.eval.ts`, fake by default
- **Workers:** `@cloudflare/vitest-pool-workers` — `pnpm test:workers` (needs wrangler/bindings; not CI yet)

## AI

Capability registry + Effect `AiService` in `apps/api/src/platform/ai/`. Product code asks for IDs (`chat.fast`, `chat.smart`, `extract.structured`); model strings live only in the registry. oRPC: `ai.capabilities` (public), `ai.complete` (signed-in). Empty `AI_GATEWAY_API_KEY` → deterministic fake model (no spend). Bind a Vercel AI Gateway key for live routing. AI Elements / chat UI stay deferred until a product surface needs them.

## Email

`@zstack/email` owns React Email templates. `EmailService` in `apps/api` is the Effect boundary.

- Default transport: console (`[email:console]`).
- Bento: set `EMAIL_FROM`, `BENTO_SITE_UUID`, `BENTO_PUBLISHABLE_KEY`, and `BENTO_SECRET_KEY` (wrangler `.dev.vars` or Alchemy stage env). Sends use `POST /api/v1/batch/emails` with `transactional: true`.
- Preview templates with `pnpm email:dev`.

## Drizzle 1.0 RC

Pinned to `drizzle-orm` / `drizzle-kit` `1.0.0-rc.*`. App queries use `drizzle-orm/effect-postgres` + `@effect/sql-pg`. Better Auth keeps the promise `node-postgres` driver until it supports Effect.

After `pnpm --filter @zstack/api auth:generate`, strip any RQBv1 `relations(...)` helpers from `auth-schema.ts` (tables only). RQB lives in `src/platform/db/relations.ts` via `defineRelations`.

When drizzle-kit says the migrations folder format is outdated, run `pnpm --filter @zstack/api db:up` once, then generate/migrate as usual.

`drizzle-orm@1.0.0-rc.1` still calls `Schema.TaggedErrorClass`, which Effect `4.0.0-beta.106` renamed to `Schema.TaggedError`. Keep:

- `patches/effect@4.0.0-beta.106.patch` — restores `Schema.TaggedErrorClass` and `Command.withHidden` (Alchemy still uses both names; Effect renamed the latter to `unlisted`)
- `patches/drizzle-orm@1.0.0-rc.1.patch` — drizzle → `TaggedError`
- `patches/alchemy@2.0.0-beta.70.patch` — alchemy → `TaggedError` (redundant with the Effect alias, kept until Alchemy catches up)

Without the Effect/Alchemy patches the CLI dies at import with `(void 0) is not a function` / missing `withHidden`. Without the drizzle patch the Worker fails the same way at startup.
