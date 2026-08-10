# create-zstack

Authoring-only CLI. `create-zstack` is **excluded** from consumer clones (see root `AUTHORING.md`).

Scaffold a product with citty + giget + nypm:

```bash
pnpm --filter create-zstack start my-app
# or locally against this tree:
ZSTACK_TEMPLATE=file:$(pwd) pnpm --filter create-zstack start /tmp/zstack-smoke --force --yes
ZSTACK_TEMPLATE=file:$(pwd) pnpm --filter create-zstack start /tmp/zstack-agents --force --yes --agent-tools=cursor,claude
```

Defaults to `gh:Wania-Labs/zstack` (override with `--template` or `ZSTACK_TEMPLATE`). Always strips authoring paths via giget `ignore` (guide, AUTHORING, create-zstack, docs, …).

Template always includes `AGENTS.md` + `.agent/playbooks/`. Optional packs from `packs/` (written after download so they survive `.cursor/**` ignore):

| Flag                                              | Effect                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--agent-tools=none\|all\|claude,cursor,…`        | Tool adapters (`CLAUDE.md`, `.cursor/rules`, `opencode.json`). Omit → TTY prompt; `--yes` / non-TTY → none         |
| `--mcp=defaults\|docs\|account\|all\|none\|id,id` | Docs MCPs by default (Cloudflare docs, Context7, shadcn). Account = Sentry, PlanetScale, CF bindings/observability |
| `--skills=copy\|symlink\|none`                    | Install `.agent/skills` into tool skill dirs (default `copy`; `symlink` keeps one source of truth)                 |
| `--yes` / `-y`                                    | Skip prompts                                                                                                       |
