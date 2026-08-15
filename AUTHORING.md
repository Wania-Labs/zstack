# Authoring notes

This file is for people building zstack itself. `create-zstack` must exclude it from consumer clones.

## Consumer ignore contract

When `create-zstack` downloads this template with giget, skip at least:

```text
tech-stack-architecture-guide/**
AUTHORING.md
.cursor/**
create-zstack/**
docs/**
agent-transcripts/**
.audit/**
.github/workflows/publish-create-zstack.yml
.github/workflows/generate-clone.yml
.github/workflows/docs.yml
scripts/smoke-create-zstack
apps/*/.cta.json
repos/**
```

Also exclude any future authoring-only paths (internal plans, draft CLIs, unpublished create-package sources that are not part of the product template). The ignore list is encoded in `create-zstack/src/cli.ts` (`CONSUMER_IGNORE`) — keep both in sync.

After download, `create-zstack/src/prepare-consumer.ts` (`stripAuthoringManifest`) rewrites the clone so install works without authoring paths: drop the `create-zstack` workspace member and the `create-zstack` / `smoke:create` root scripts, remove the `create-zstack` importer from `pnpm-lock.yaml`, remove `.github/workflows/docs.yml` and `.github/workflows/generate-clone.yml`, remove `scripts/smoke-create-zstack`, remove `repos/` (vendored Effect source), and scrub authoring-only README lines.

Then, unless `--keep-identity` is set, `personalizeClone` rewrites product identity from `--name` / `--scope` (or the target directory basename): root package name, `@scope/*` workspace packages, Compose/Postgres/Hyperdrive locals, Alchemy stack, Worker names, brand strings, and related filters/imports.

Optional coding-agent packs are **not** taken from the authoring tree's `.cursor/` (that path is ignored). They live in `create-zstack/packs/` and are written by `applyAgentPacks` when the user passes `--agent-tools` (or answers the TTY prompt). Skills under `.agent/skills/` can be **copied** or **symlinked** into tool dirs (`--skills=copy|symlink|none`).

## What consumers get

The product monorepo: `apps/`, `packages/`, root toolchain configs, root + nested `AGENTS.md`, `.agent/playbooks/`, and `.agent/skills/`. `pnpm-workspace.yaml` sets `allowBuilds.sharp: false` so clone `pnpm install` does not compile sharp against a system libvips.

Optional at init (`--agent-tools` / `--mcp` / `--skills`): thin tool adapters (`CLAUDE.md`, `.cursor/rules`, `opencode.json`), MCP servers, and skill install mode. Docs group by default (`cloudflare-docs`, `context7`, `shadcn`); account group (`sentry`, `planetscale`, Cloudflare bindings/observability) via `--mcp=account` or `--mcp=all`. These are coding-environment files, not `product.config.ts` capabilities.

Optional Effect source for agents: `pnpm agent:vendor-effect` (git subtree into `repos/effect/` by default; `--submodule` available). See `.agent/playbooks/vendor-effect.md`.

Human architecture docs live on the separate zstack website, not in cloned products. Coding-agent walkthrough: `docs/content/docs/guides/coding-agents.mdx`.

## Packaging stack

- **citty** — `@wanialabs/create-zstack` CLI (`create-zstack/` in this repo; published; excluded from clones). `--version` is read from `create-zstack/package.json` so the trusted-publisher bump stays in sync. Install sets `SHARP_IGNORE_GLOBAL_LIBVIPS=1` (nypm has no `env` on `installDependencies`).
- **giget** — template download without git history (`ignore` for the paths above)
- **nypm** — install with the user's chosen package manager (`--package-manager`)

Published consumers:

```bash
npm create @wanialabs/zstack@latest my-app
pnpm create @wanialabs/zstack@latest my-app
yarn create @wanialabs/zstack@latest my-app
bunx @wanialabs/create-zstack@latest my-app
```

Local smoke against this tree (giget local provider is `git:`, not `file:`):

```bash
pnpm smoke:create
ZSTACK_TEMPLATE=git:$(pwd) pnpm create-zstack /tmp/zstack-smoke-agents --force --yes --agent-tools=all
```

Default remote template: `gh:Wania-Labs/zstack` (public; override with `--template` or `ZSTACK_TEMPLATE`). CLI requires Node `>=22.5`.

## Releasing create-zstack

npm trusted publisher is already set for `.github/workflows/publish-create-zstack.yml`. Do not use `NPM_TOKEN`. Do not `npm publish` from a laptop.

From `main` with a clean tree:

```bash
.cursor/skills/release-create-zstack/release patch
```

That dispatches the workflow. CI bumps `create-zstack/package.json`, publishes `@wanialabs/create-zstack`, pushes `create-zstack@x.y.z`, and opens a GitHub release. The published CLI still clones `gh:Wania-Labs/zstack` at runtime (usually `main`); the tag is the CLI version, not a frozen template snapshot.

- Agent pack flags:
  - `--package-manager` / `-p` — `pnpm` (default with `--yes`) \| `npm` \| `yarn` \| `bun`
  - `--agent-tools=none|all|claude,cursor,opencode,codex` — omit to prompt on a TTY; non-TTY / `--yes` defaults to none
  - `--mcp=defaults|docs|account|all|none|<ids>` — public docs MCPs by default when tools selected
  - `--skills=copy|symlink|none` — how to install `.agent/skills` into Cursor/Claude skill dirs (default `copy`)
  - `--yes` / `-y` — skip the agent-tools prompt

Docs walkthrough: `docs/content/docs/guides/coding-agents.mdx`.

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

| Capability          | State today | Live default                                                                                                                                                                                                                    |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres            | core        | Compose locally; PlanetScale only on `alchemy:deploy` (consumer chooses)                                                                                                                                                        |
| Auth / orgs / staff | core        | Better Auth + Compose                                                                                                                                                                                                           |
| i18n                | core        | Always-on Paraglide in `packages/i18n`. No vendor secret                                                                                                                                                                        |
| Email               | configured  | Console until `EMAIL_FROM` + `BENTO_*`                                                                                                                                                                                          |
| Observability       | configured  | Off until `SENTRY_DSN` / `VITE_SENTRY_DSN*`                                                                                                                                                                                     |
| Object storage (R2) | configured  | In-memory fake until Worker binding `OBJECTS`. Presigned S3 URLs when `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` are set; otherwise Worker `/api/objects/*`. Alchemy local R2 under `alchemy:dev`; cloud bucket only on deploy |
| Feature flags       | configured  | In-memory map. `FEATURE_FLAG_*` env overlays. Missing keys return the call-site default. No PostHog                                                                                                                             |
| Billing             | configured  | Fake until `POLAR_ACCESS_TOKEN`. Token set: Polar checkout/portal, verified webhooks, entitlement projection, usage outbox                                                                                                      |
| Workflows / queues  | configured  | In-memory fakes until `JOBS` / `EXAMPLE_WORKFLOW` are bound. Alchemy Queue + example Cloudflare Workflow on the API Worker                                                                                                      |
| Analytics           | configured  | No-op until `POSTHOG_API_KEY` / `VITE_PUBLIC_POSTHOG_KEY`. Typed events in `@zstack/analytics`. PostHog flags stay off                                                                                                          |
| AI                  | configured  | Fake models until `AI_GATEWAY_API_KEY`                                                                                                                                                                                          |

## Deploy authority

Alchemy v2 (`alchemy@2.0.0-beta.*`) is the sole owner of provisioned Cloudflare resources, secret bindings, and production deploys. Entry: `alchemy.run.ts` + `infra/*`. Pin the exact beta and upgrade with Effect. Current pin is `2.0.0-beta.72`. beta.70 dies on Effect `4.0.0-rc.108` (`Schema.TaggedErrorClass` was renamed to `Schema.TaggedError`).

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

Docs gate: `.github/workflows/docs.yml` — install/typecheck/lint/format/Worker build **inside `docs/` only** (separate lockfile). Never fold docs into the product job. Production deploy is Workers Builds in the Cloudflare dashboard (root `docs`), not this workflow.

`pnpm test` runs API unit tests plus deterministic `vitest-evals` (fake models). Workerd pool tests (`pnpm test:workers`) stay local/optional. Depot runners, DB/integration jobs, Playwright, Alchemy plan/deploy, and cloud previews come later.

## Docs site (authoring only)

`docs/` is a standalone TanStack Start + Fumadocs site. Not in `pnpm-workspace.yaml`, not in Alchemy, not in product turbo tasks, excluded from `create-zstack`. Production target is a Cloudflare Worker via `@cloudflare/vite-plugin` and `docs/wrangler.jsonc`. That is authoring-only. It is not a second product deploy path.

```bash
cd docs && pnpm install && pnpm dev   # :4000
```

Product `pnpm lint` uses `--disable-nested-config` so the isolated `docs/.oxlintrc.json` / `docs/tsconfig.json` are never loaded (they require docs' own `node_modules`, which product CI does not install).

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

## Object storage

`ObjectStore` in `apps/api/src/platform/object-store/` is the Effect boundary. Keys are opaque strings, not filenames.

- Default: in-memory fake when the Worker `OBJECTS` R2 binding is missing (wrangler without r2).
- Sign intents: Worker `/api/objects/*` unless `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, account id, and bucket name are set. Then aws4fetch signs an S3 URL. The Worker binding cannot presign.
- Alchemy: `infra/storage.ts` declares `Cloudflare.R2.Bucket("Objects")` and binds it on the API Worker. `alchemy:dev` uses Alchemy local R2 (no cloud bucket on the author's account). `alchemy:deploy` provisions a real bucket named from the stack.
- Clones do not inherit an author account bucket. Physical names come from the personalized Alchemy stack.

## Feature flags

`FeatureFlags` in `apps/api/src/platform/flags/` is the Effect boundary. Callers pass the safe default at the call site.

- Default: in-memory map (`FakeFeatureFlagsLive`). Missing keys and empty config return the caller default with reason `default`. They do not throw.
- `featureFlagsLiveFromEnv` overlays `FEATURE_FLAG_*` bindings onto that map (`FEATURE_FLAG_EXAMPLE_READY=true` → `example.ready`).
- No PostHog, OpenFeature npm package, KV snapshot, or admin authoring.

## Billing

`BillingService` in `apps/api/src/platform/billing/` is the Effect boundary. The billable customer is the Better Auth organization id. Callers ask `canUse(capability)` and `limit(name)`, not Polar subscription status. The client may pass a product slug, never a Polar product id.

- Default: `FakeBillingLive` when `POLAR_ACCESS_TOKEN` is empty. Checkout and portal return `{ kind: "unconfigured" }`. Entitlements deny (`canUse` false, `limit` 0). Empty Polar env does not throw.
- Live: `PolarBillingLive` when `POLAR_ACCESS_TOKEN` is non-empty. Checkout and portal call Polar HTTP and return `{ kind: "url", url }` when successful. Requires product catalog via `POLAR_PRODUCT_<SLUG>=<product_id>` env vars.
- Webhooks: `POST /api/webhooks/polar` verifies Standard Webhooks (`POLAR_WEBHOOK_SECRET`). Events land in `billing_webhook_event` (Polar event id is the primary key). Entitlements recompute into `billing_entitlement`. Duplicates recompute, they do not double-capture analytics.
- Usage: `reportUsage` writes `billing_usage_outbox`, flushes Polar ingest in-process (so wrangler without `JOBS` still delivers), then publishes `billing.usage` for retries. `ai.complete` checks `canUse("ai.<capability>")` when Polar is configured and reports `ai.generation` after success. Empty Polar does not block the fake AI path.
- Product `canUse` / `limit` / `remaining` / `entitlement` read the projection first, then Polar customer state.
- Do not register the Better Auth Polar plugin while credentials can be empty. Empty-token customer creation breaks sign-up. Association is `external_customer_id` = organization id on checkout.
- Clones bind their own Polar token. No Polar org or product ids in source.

## Analytics

`@zstack/analytics` is the PostHog setup: typed events and Capture API adapters. There is no `posthog-js` and no `apps/api` analytics module. `Analytics` in `apps/api` is the Effect port. The customer app identifies after session load and sends `$pageview` on route changes.

- Default: no-op when `POSTHOG_API_KEY` / `VITE_PUBLIC_POSTHOG_KEY` are empty. Clones create their own PostHog US Cloud project, same as Sentry.
- Live: PostHog Capture API (`/capture/`). No session replay, no PostHog feature flags.
- Server events: `account_signed_up`, `checkout_completed`, `subscription_changed`, `ai_generation_completed`. Browser: `page_viewed` (sent as `$pageview`) plus `$identify` with `$anon_distinct_id`.
- Staff capture is skipped (server `isStaff`, browser staff roles).
- Analytics failure never fails the calling feature.

## Drizzle 1.0 RC

Pinned to `drizzle-orm` / `drizzle-kit` `1.0.0-rc.5-ab785fc` (Alchemy 72's exact peer; `1.0.0-rc.4` crashes at import against Effect `>=4.0.0-beta.105`). App queries use `drizzle-orm/effect-postgres` + `@effect/sql-pg`. Better Auth keeps the promise `node-postgres` driver until it supports Effect. Do not widen the range until drizzle publishes a real `1.0.0-rc.5`.

After `pnpm --filter @zstack/api auth:generate`, strip any RQBv1 `relations(...)` helpers from `auth-schema.ts` (tables only). RQB lives in `src/platform/db/relations.ts` via `defineRelations`.

When drizzle-kit says the migrations folder format is outdated, run `pnpm --filter @zstack/api db:up` once, then generate/migrate as usual.
