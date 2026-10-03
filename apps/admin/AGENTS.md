# apps/admin

Staff TanStack Start console. Same UI stack as web.

## Auth

- Better Auth admin roles map to product `staffCapabilities` in the API
- `staff.me` rejects non-staff; UI gates are UX only
- Promote: `STAFF_EMAIL=you@example.com pnpm db:seed` after customer sign-up
- Local: http://localhost:3001 with API on `:8787`
- API access mirrors web: `/api/$` server route → `API` binding when deployed; SSR guards forward cookies via `apiFetch`
- Deployed admin origin must be set as `ADMIN_URL` on the API (Better Auth `trustedOrigins`)

## Do / do not

Same as web: import only `@zstack/contracts`, `@zstack/i18n`, `@zstack/analytics`, and `@zstack/auth-access` (admin roles for the Better Auth client), no `@cloudflare/vite-plugin`, shadcn via `pnpm --filter @zstack/admin exec shadcn add …`.
