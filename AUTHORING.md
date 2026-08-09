# Authoring notes

This file is for people building zstack itself. `create-zstack` must exclude it from consumer clones.

## Consumer ignore contract

When `create-zstack` downloads this template with giget, skip at least:

```text
tech-stack-architecture-guide/**
AUTHORING.md
.cursor/
.cursor/plans/
```

Also exclude any future authoring-only paths (internal plans, draft CLIs, unpublished create-package sources that are not part of the product template).

## What consumers get

The product monorepo: `apps/`, `packages/`, root toolchain configs, and later `AGENTS.md` files that teach agents how to work in the tree.

Human architecture docs live on the separate zstack website, not in cloned products.

## Packaging stack (later)

- **citty** — `create-zstack` CLI
- **giget** — template download without git history (`ignore` for the paths above)
- **nypm** — install with the user's package manager

## Notes from scaffolding

`create-hono` with an absolute target path under this monorepo wrote into a relative `Users/...` tree inside the workspace. Prefer scaffolding into a temp directory (or use the official `honojs/starter` template via giget) and copy into `apps/*`.

## Deploy authority

Alchemy is the sole owner of provisioned Cloudflare/PlanetScale resources, secret bindings, and production deploys. `wrangler` in `apps/api` is a local development / dry-run tool only until Alchemy is wired. Do not grow a parallel Wrangler deploy path.

The Hyperdrive binding id in `apps/api/wrangler.jsonc` is a local placeholder (`localConnectionString` points at Compose Postgres). Alchemy will replace that with a real Hyperdrive resource against PlanetScale.

`BETTER_AUTH_SECRET` lives in ignored `apps/api/.dev.vars`. Regenerate with `openssl rand -base64 32` or `pnpm dlx auth@latest secret` before sharing a machine.

`BETTER_AUTH_SECRET` lives in ignored `apps/api/.dev.vars`. Regenerate with `openssl rand -base64 32` or `pnpm dlx auth@latest secret` before sharing a machine.

Local web is the public origin: set `BETTER_AUTH_URL=http://localhost:3000` in `.dev.vars`. Vite proxies `/api/*` to the API Worker on `:8787`.

## Frontend UI

`apps/web` uses shadcn **base-nova** (Base UI primitives + default neutral theme, light/dark via `.dark`). Add components with:

```bash
pnpm --filter @zstack/web exec shadcn add button
```

## Frontend UI

`apps/web` uses shadcn **base-nova** (Base UI primitives + default neutral theme, light/dark via `.dark`). Add components with:

```bash
pnpm --filter @zstack/web exec shadcn add button
```

Interactive `shadcn init` prompts are flaky under TanStack Start; `components.json` is committed so `add` works non-interactively.

## Email

`@zstack/email` owns React Email templates. `EmailService` in `apps/api` is the Effect boundary; local transport logs to the Worker console. Bento lands with Alchemy secrets. Preview templates with `pnpm email:dev`.

## Drizzle 1.0 RC

Pinned to `drizzle-orm` / `drizzle-kit` `1.0.0-rc.*`. App queries use `drizzle-orm/effect-postgres` + `@effect/sql-pg`. Better Auth keeps the promise `node-postgres` driver until it supports Effect.

After `pnpm --filter @zstack/api auth:generate`, strip any RQBv1 `relations(...)` helpers from `auth-schema.ts` (tables only). RQB lives in `src/platform/db/relations.ts` via `defineRelations`.

When drizzle-kit says the migrations folder format is outdated, run `pnpm --filter @zstack/api db:up` once, then generate/migrate as usual.

`drizzle-orm@1.0.0-rc.1` still calls `Schema.TaggedErrorClass`, which Effect `4.0.0-beta.106` renamed to `Schema.TaggedError`. Keep the pnpm patch in `patches/drizzle-orm@1.0.0-rc.1.patch` until Drizzle catches up — without it the Worker fails at startup with `(void 0) is not a function`.
