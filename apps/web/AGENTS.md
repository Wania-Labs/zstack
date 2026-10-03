# apps/web

Customer TanStack Start shell (shadcn base-nova).

## Do

- Talk to the API through `@zstack/contracts` / oRPC client helpers
- Copy through `@zstack/i18n` message functions; catalogs live in `packages/i18n`
- Add UI with `pnpm --filter @zstack/web exec shadcn add <component>`
- Call the API only through `authClient` / `orpcClient` (both use `apiFetch` from `src/lib/api-fetch.ts`)
- Browser `/api/*`: Vite proxy locally; deployed, `src/routes/api/$.ts` forwards to the `API` service binding
- SSR (`beforeLoad`): `apiFetch` forwards the incoming Cookie header through the binding, or `API_ORIGIN` (default `http://127.0.0.1:8787`) under plain `vite dev`
- Keep `cloudflare:workers` / `@tanstack/react-start/server` imports in `*.server.ts` files

## Do not

- Import `apps/api` source, or workspace packages beyond `@zstack/contracts`, `@zstack/i18n`, `@zstack/analytics`, and `@zstack/auth-access`
- Add `@cloudflare/vite-plugin` (Alchemy owns that under `alchemy:dev` / deploy)
