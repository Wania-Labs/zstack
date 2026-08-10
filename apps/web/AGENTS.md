# apps/web

Customer TanStack Start shell (shadcn base-nova).

## Do

- Talk to the API through `@zstack/contracts` / oRPC client helpers
- Add UI with `pnpm --filter @zstack/web exec shadcn add <component>`
- Rely on Vite `/api` proxy locally; SSR may need `ORPC_URL` → `http://127.0.0.1:8787/api/rpc`

## Do not

- Import `apps/api` source
- Add `@cloudflare/vite-plugin` (Alchemy owns that under `alchemy:dev` / deploy)
