# @wanialabs/create-zstack

Scaffold a zstack product with citty + giget + nypm. The CLI package lives in the authoring monorepo and is **excluded** from consumer clones (see root `AUTHORING.md`).

## Install / run

```bash
npm create @wanialabs/zstack@latest my-app
pnpm create @wanialabs/zstack my-app
yarn create @wanialabs/zstack my-app
bunx @wanialabs/create-zstack my-app
```

Authoring smoke against this tree:

```bash
pnpm --filter @wanialabs/create-zstack start my-app
ZSTACK_TEMPLATE=git:$(pwd) pnpm create-zstack /tmp/zstack-smoke --force --yes
ZSTACK_TEMPLATE=git:$(pwd) pnpm create-zstack /tmp/zstack-agents --force --yes --agent-tools=cursor,claude
```

Defaults to `gh:Wania-Labs/zstack` (override with `--template` or `ZSTACK_TEMPLATE`). Local paths use giget's `git:` provider (`git:$(pwd)` or `git:./`), not `file:`. Always strips authoring paths via giget `ignore` (guide, AUTHORING, create-zstack, docs, …).

Requires Node.js `>=22.5` (giget ignore uses `path.matchesGlob`).

## Flags

| Flag                                              | Effect                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--package-manager` / `-p`                        | `pnpm` (default with `--yes`) \| `npm` \| `yarn` \| `bun`. TTY prompts when omitted                                |
| `--agent-tools=none\|all\|claude,cursor,…`        | Tool adapters (`CLAUDE.md`, `.cursor/rules`, `opencode.json`). Omit → TTY prompt; `--yes` / non-TTY → none         |
| `--mcp=defaults\|docs\|account\|all\|none\|id,id` | Docs MCPs by default (Cloudflare docs, Context7, shadcn). Account = Sentry, PlanetScale, CF bindings/observability |
| `--skills=copy\|symlink\|none`                    | Install `.agent/skills` into tool skill dirs (default `copy`; `symlink` keeps one source of truth)                 |
| `--yes` / `-y`                                    | Skip prompts                                                                                                       |

The product template is a **pnpm workspace**. Non-pnpm choices still run install via nypm and rewrite `packageManager`, but filter-style scripts may need adjusting.
