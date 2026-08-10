# packages/contracts

Client-safe Zod schemas + oRPC contract. Frontends and the API both depend on this package.

## Contract-first

When adding an RPC:

1. Define input/output Zod in this package
2. Wire it on `appContract` / router export
3. Implement in `apps/api` (`http/orpc.ts` + module)
4. Call from web/admin

Never put server-only code, env access, or Effect Layers here.
