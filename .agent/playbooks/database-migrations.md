# Playbook: database and Better Auth schema

Drizzle ORM / Kit are pinned to `1.0.0-rc.*`. App queries use `drizzle-orm/effect-postgres`.

Postgres schema changes go through drizzle-kit only (`pnpm db:generate` then `pnpm db:migrate`). Do not add Alchemy `migrationsDir` — it expects flat numeric-prefixed `.sql`, not Drizzle 1.0 folders.

## Usual path

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

If drizzle-kit says the migrations folder format is outdated:

```bash
pnpm --filter @zstack/api db:up
```

Then generate/migrate again.

## After `auth:generate`

```bash
pnpm auth:generate
```

1. Keep **tables only** in the generated auth schema file.
2. Strip any RQBv1 `relations(...)` helpers from that file.
3. Put relational query config in `apps/api/src/platform/db/relations.ts` via `defineRelations`.

## Dual Postgres drivers

Better Auth has no Effect adapter. Auth routes keep `pg.Client` + `drizzle-orm/node-postgres`. Product modules keep `@effect/sql-pg` via `Database`. Do not invent a bridge.
