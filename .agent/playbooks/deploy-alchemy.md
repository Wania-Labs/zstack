# Playbook: Alchemy deploy and environments

Alchemy v2 is the only provisioned deploy path.

## Local

```bash
pnpm dev:services
pnpm alchemy:dev
```

Under `ALCHEMY_DEV`, PlanetScale resources are skipped. Hyperdrive points at Compose.

## Deploy

```bash
alchemy login
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
# plus any vendor secrets you intend to enable
pnpm alchemy:deploy
```

Deploy provisions PlanetScale + cloud Hyperdrive. Run migrations with drizzle-kit against `DATABASE_URL` (`pnpm db:migrate`). Alchemy `migrationsDir` is not wired for Drizzle 1.0 folders.

## Do not

- `wrangler deploy` as production (local escape hatch only)
- Add `@cloudflare/vite-plugin` to web/admin
- Assume `product.config.ts` alone flips Alchemy resources (intent file today)
