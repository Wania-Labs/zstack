# zstack docs

Standalone TanStack Start + Fumadocs site for the **zstack authoring repository**.

Not part of the product monorepo workspace, Alchemy stack, Turborepo product tasks, or `create-zstack` clones. Own lockfile and CI (`.github/workflows/docs.yml`). Production is a Cloudflare Worker (`zstack-docs`), not Alchemy. Deploy is Workers Builds in the dashboard, not GitHub Actions.

```bash
pnpm install
pnpm dev          # http://localhost:4000
pnpm check:docs   # required teaching pages present
pnpm typecheck
pnpm lint
pnpm build
```

Workers Builds settings: root `docs`, build `pnpm build`, deploy `npx wrangler deploy`, production branch `main`. Worker name in the dashboard must match `wrangler.jsonc` (`zstack-docs`).

## Agent ingest

| URL                                    | Purpose                      |
| -------------------------------------- | ---------------------------- |
| `/llms.txt`                            | Index + reading order        |
| `/llms-full.txt`                       | Full markdown dump           |
| `/docs/<slug>.md`                      | Per-page markdown            |
| `Accept: text/markdown` on `/docs/...` | Negotiated redirect to `.md` |

See [For agents](./content/docs/for-agents.mdx).
