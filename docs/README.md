# zstack docs

Standalone TanStack Start + Fumadocs site for the **zstack authoring repository**.

Not part of the product monorepo workspace, Alchemy stack, Turborepo product tasks, or `create-zstack` clones. Own lockfile and CI (`.github/workflows/docs.yml`).

```bash
pnpm install
pnpm dev          # http://localhost:4000
pnpm check:docs   # required teaching pages present
pnpm typecheck
pnpm lint
pnpm build
```

## Agent ingest

| URL                                    | Purpose                      |
| -------------------------------------- | ---------------------------- |
| `/llms.txt`                            | Index + reading order        |
| `/llms-full.txt`                       | Full markdown dump           |
| `/docs/<slug>.md`                      | Per-page markdown            |
| `Accept: text/markdown` on `/docs/...` | Negotiated redirect to `.md` |

See [For agents](./content/docs/for-agents.mdx).
