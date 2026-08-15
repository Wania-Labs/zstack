---
name: effect-ts
description: Idiomatic Effect v4 usage in this monorepo. Read before writing Effect, Layer, Schema, or @effect/sql code.
---

# Effect in zstack

This product uses Effect `4.0.0-rc.*` with `@effect/sql-pg`, platform ports under `apps/api/src/platform/`, and modules that call those ports.

## Before writing Effect code

1. If `repos/effect/LLMS.md` exists, read it **completely**.
2. Read `node_modules/effect/AGENTS.md` **completely** (pnpm path may be under `node_modules/.pnpm/effect@…/node_modules/effect/AGENTS.md`).
3. Follow links from those files when needed.
4. Prefer searching `repos/effect/` when present, else `node_modules/effect/src` (and `@effect/sql-pg`, `@effect/vitest`), over web search.
5. Treat `repos/effect/` as read-only. Do not import from `repos/`. Do not edit `repos/` unless asked.

## Project rules

- Use `Effect.gen` and `Effect.fn("name")`. Avoid bare `Effect.gen` wrappers as named exports.
- Define errors with `Schema.TaggedError` (or the patched `TaggedErrorClass` alias only where patches require it).
- Feature modules call Effect services from `apps/api/src/platform/`. Do not construct vendor clients inside modules.
- Select Layers at the Worker edge from env (empty credential → safe default).
- Prefer `@effect/vitest` patterns for Effect unit tests.

## Optional deeper source

To vendor the full Effect git tree for agents (Effect’s recommended workflow), run:

```bash
pnpm agent:vendor-effect
```

See `.agent/playbooks/vendor-effect.md`. That uses **git subtree** by default (Effect’s preference). Submodule is available via `--submodule` if you want a pointer instead of nested history.
