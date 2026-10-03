# Playbook: Alchemy deploy and environments

Alchemy v2 is the only provisioned deploy path.

## Local

```bash
pnpm dev:services
pnpm alchemy:dev
```

Under `ALCHEMY_DEV`, PlanetScale resources are skipped. Hyperdrive points at Compose. `BETTER_AUTH_URL` / `ADMIN_URL` default to `http://localhost:3000` / `http://localhost:3001`.

## Deploy

```bash
alchemy login
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
export BETTER_AUTH_URL="https://app.example.com"     # public web origin
export ADMIN_URL="https://admin.example.com"         # public staff console origin
# plus any vendor secrets you intend to enable
pnpm alchemy:deploy
```

Deploy provisions PlanetScale + cloud Hyperdrive. Run migrations with drizzle-kit against `DATABASE_URL` (`pnpm db:migrate`). Alchemy `migrationsDir` is not wired for Drizzle 1.0 folders.

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

## Do not

- `wrangler deploy` as production (local escape hatch only)
- Add `@cloudflare/vite-plugin` to web/admin
- Assume `product.config.ts` alone flips Alchemy resources (intent file today)
