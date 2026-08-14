# apps/admin

Staff TanStack Start console. Same UI stack as web.

## Auth

- Better Auth admin roles map to product `staffCapabilities` in the API
- `staff.me` rejects non-staff; UI gates are UX only
- Promote: `STAFF_EMAIL=you@example.com pnpm db:seed` after customer sign-up
- Local: http://localhost:3001 with API on `:8787`

## Do / do not

Same as web: contracts and `@zstack/i18n` only, no `@cloudflare/vite-plugin`, shadcn via `pnpm --filter @zstack/admin exec shadcn add …`.
