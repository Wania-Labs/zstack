# zstack docs

Standalone TanStack Start + Fumadocs site for the **zstack authoring repository**.

Not part of the product monorepo workspace, Alchemy stack, Turborepo product tasks, or `create-zstack` clones. Own lockfile and CI (`.github/workflows/docs.yml`). Production is a Cloudflare Worker (`zstack`), not Alchemy. Deploy is Workers Builds in the dashboard, not GitHub Actions.

```bash
pnpm install
pnpm dev          # http://localhost:4000
pnpm check:docs   # required teaching pages present
pnpm typecheck
pnpm lint
pnpm build
```

Workers Builds settings: root `docs`, build `pnpm build`, deploy `npx wrangler deploy`, production branch `main`. Worker name in the dashboard must match `wrangler.jsonc` (`zstack`).

`pnpm build` writes `public/llms.txt` and `public/llms-full.txt` from the MDX tree so Cloudflare can serve them as static assets. Browser navigations to those paths otherwise hit the SPA shell, which has no page component and looks empty. Markdown twins (`/docs/*.md`) still go through the Worker (`assets.run_worker_first`).

## Agent ingest

| URL                                    | Purpose                      |
| -------------------------------------- | ---------------------------- |
| `/llms.txt`                            | Index + reading order        |
| `/llms-full.txt`                       | Full markdown dump           |
| `/docs/<slug>.md`                      | Per-page markdown            |
| `Accept: text/markdown` on `/docs/...` | Negotiated redirect to `.md` |

See [For agents](./content/docs/for-agents.mdx).
