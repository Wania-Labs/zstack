# @wanialabs/create-zstack

Scaffold a zstack product with citty + giget + nypm. The CLI package lives in the authoring monorepo and is **excluded** from consumer clones (see root `AUTHORING.md`).

## Install / run

```bash
pnpm create @wanialabs/zstack@latest my-app
npm create @wanialabs/zstack@latest my-app
```

Any launcher works, but the clone is a pnpm workspace and always installs with pnpm. If `pnpm` is missing, the CLI skips install and tells you to run `corepack enable pnpm` (or `npm install -g pnpm`).

Authoring smoke against this tree:

```bash
pnpm --filter @wanialabs/create-zstack start my-app
pnpm smoke:create
ZSTACK_TEMPLATE=git:$(pwd) pnpm create-zstack /tmp/zstack-agents --force --yes --agent-tools=cursor,claude
```

Defaults to `gh:Wania-Labs/zstack` (override with `--template` or `ZSTACK_TEMPLATE`). Local paths use giget's `git:` provider (`git:$(pwd)` or `git:./`), not `file:`, and read committed HEAD. Always strips authoring paths (guide, AUTHORING, create-zstack, docs, …, including their dotfiles) via a giget `ignore` predicate plus a post-download sweep.

`pnpm smoke:create` generates three clones (Acme Cloud / `@acme`; default identity + `--agent-tools=all`; `zstack-demo`) and runs each clone's install, typecheck, lint, format:check, and test.

Requires Node.js `>=22.5`.

## Flags

| Flag                                              | Effect                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--name`                                          | Display name: letters, digits, spaces, `. ' & -`, max 32 (default: title-cased target directory basename)          |
| `--scope`                                         | npm scope for workspace packages (`@acme` or `acme`; default `@<slug>`)                                            |
| `--keep-identity`                                 | Skip personalization; keep template `zstack` / `@zstack` names                                                     |
| `--package-manager` / `-p`                        | `pnpm` only. Clones are pnpm workspaces; other values fail with an explanation                                     |
| `--agent-tools=none\|all\|claude,cursor,…`        | Tool adapters (`CLAUDE.md`, `.cursor/rules`, `opencode.json`). Omit → TTY prompt; `--yes` / non-TTY → none         |
| `--mcp=defaults\|docs\|account\|all\|none\|id,id` | Docs MCPs by default (Cloudflare docs, Context7, shadcn). Account = Sentry, PlanetScale, CF bindings/observability |
| `--skills=copy\|symlink\|none`                    | Install `.agent/skills` into tool skill dirs (default `copy`; `symlink` keeps one source of truth)                 |
| `--yes` / `-y`                                    | Skip prompts                                                                                                       |

Identity is validated before the template download. When `--name` is given the target directory name is not validated, so `create-zstack 2026-app --name Acme` works. After download, the clone is rewritten to the chosen name/scope (packages, Compose/Postgres, Alchemy stack, workers, queue/workflow names, brand strings) unless `--keep-identity` is set. If that fails, a directory the CLI created is removed again.

The target may be missing or an empty directory; a non-empty directory needs `--force`.
