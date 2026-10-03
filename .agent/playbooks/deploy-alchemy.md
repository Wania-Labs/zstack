# Playbook: Alchemy deploy and environments

Alchemy v2 is the only provisioned deploy path.

## Env files Alchemy reads

The Alchemy CLI reads the shell environment plus the **root `.env`** (shell wins), or the file passed with `--env-file` (that file wins over the shell). It never reads `.env.local`, `.env.development`, or `apps/api/.dev.vars`. Put `BETTER_AUTH_SECRET` and any vendor keys for `alchemy:dev` in root `.env` (gitignored) or export them; use a stage file for deploys (see below). `.env.example` lists the keys.

## Local

```bash
pnpm dev:services
pnpm alchemy:dev
```

Under `ALCHEMY_DEV`, PlanetScale resources are skipped. Hyperdrive points at Compose via `composeDevOrigin` in `infra/database.ts` (port 5432; change it there if you set `POSTGRES_PORT`). `BETTER_AUTH_URL` / `ADMIN_URL` default to `http://localhost:3000` / `http://localhost:3001`.

## Deploy

```bash
alchemy login
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
export BETTER_AUTH_URL="https://app.example.com"     # public web origin
export ADMIN_URL="https://admin.example.com"         # public staff console origin
# plus any vendor secrets you intend to enable
pnpm alchemy:deploy
```

Deploy provisions PlanetScale + cloud Hyperdrive. Alchemy `migrationsDir` is not wired for Drizzle 1.0 folders, so migrate with drizzle-kit yourself (see [Migrate the deployed database](#migrate-the-deployed-database)).

### Public origins (`BETTER_AUTH_URL`, `ADMIN_URL`)

Both are **required and must be `https://`** outside `alchemy dev`; deploy fails with a `ConfigError` naming the missing variable otherwise. `BETTER_AUTH_URL` is Better Auth's `baseURL` (Secure cookies, email links). Both origins are Better Auth `trustedOrigins`; localhost is trusted only while `BETTER_AUTH_URL` is `http://localhost`.

They are not derived from `web.url` / `admin.url`: web and admin bind the API Worker (`API` service binding), so the API cannot also take their URLs as inputs without a resource cycle.

- **Custom domains (recommended):** attach them with the Worker `domain` prop in `infra/web.ts` / `infra/admin.ts` and set the two variables to those origins.
- **workers.dev only:** the generated Worker names include a random suffix, so the first deploy cannot know them. Deploy once with placeholders (`BETTER_AUTH_URL=https://placeholder.invalid ADMIN_URL=https://placeholder.invalid`), copy the `webUrl` / `adminUrl` stack outputs, then redeploy with the real values.

Do not reuse `.env` from local dev for deploy (it holds `http://localhost` values). Use a stage file: `pnpm alchemy:deploy --stage prod --env-file .env.prod`.

### Same-origin `/api`

Browsers only ever call `/api/*` on the web/admin origin. Deployed, the TanStack Start server route `src/routes/api/$.ts` forwards those requests (method, headers/cookies, streamed body, redirects untouched) to the API Worker through the `API` service binding. SSR route guards use the same binding and forward the incoming Cookie header, so hard refreshes of protected pages see the session.

### Preview stages

`pr-*` stages reuse the `staging` stage's PlanetScale database and create their own branch. Deploy `--stage staging` before any preview stage.

### Database role

The Hyperdrive `AppRole` inherits `pg_read_all_data` + `pg_write_all_data` (DML only). Schema changes go through drizzle-kit with a schema-owning `DATABASE_URL`.

## Migrate the deployed database

Plain `pnpm db:migrate` targets local Compose (`DATABASE_URL` from `.env.local` / `.env.development`). For PlanetScale:

1. In the PlanetScale dashboard open the stage's database and select its branch (Alchemy creates one per stage off `main`; `pr-*` stages branch the `staging` database).
2. **Connect** → create a role (or reset a password) that owns the schema / can run DDL. The Alchemy `AppRole` is DML-only and its credentials stay off stack outputs on purpose. Copy the **direct** Postgres URL (port 5432, `sslmode=verify-full`), not the PSBouncer pooled URL on 6432.
3. Run:

```bash
DATABASE_URL='postgresql://<role>:<password>@<host>:5432/postgres?sslmode=verify-full' pnpm db:migrate:remote
```

`db:migrate:remote` refuses to run without `DATABASE_URL` in the shell, so it never falls back to Compose. A shell `DATABASE_URL` also beats the dotenv files for `pnpm db:migrate` / `db:seed`.

## Worker env keys under Alchemy

Alchemy binds only the keys listed in `infra/api.ts` `env`. Code reads any `POLAR_PRODUCT_<SLUG>` or `FEATURE_FLAG_<KEY>`, but a new key reaches the deployed or `alchemy:dev` Worker only after you add a matching `Config.String(...)` entry there. Today: `POLAR_PRODUCT_PRO`, `POLAR_PRODUCT_ENTERPRISE`, `FEATURE_FLAG_EXAMPLE_READY`.

## Do not

- `wrangler deploy` as production (local escape hatch only)
- Add `@cloudflare/vite-plugin` to web/admin
- Assume `product.config.ts` alone flips Alchemy resources (intent file today)
