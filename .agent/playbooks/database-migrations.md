# Playbook: database and Better Auth schema

Drizzle ORM / Kit are pinned to `1.0.0-rc.*`. App queries use `drizzle-orm/effect-postgres`.

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

## Patches

Do not remove `patches/effect@*`, `patches/drizzle-orm@*`, or `patches/alchemy@*`. Without them the Alchemy CLI or Worker fails at import/startup on renamed Effect APIs.
