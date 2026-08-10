# Playbook: add a capability end to end

Use when adding a new oRPC procedure or vertical that spans contracts, API, and UI.

## Order (required)

1. **Contract** — Zod schemas + procedure on `appContract` in `packages/contracts`.
2. **Export** — ensure the router / package export surfaces the new procedure.
3. **Module** — implement the use case under `apps/api/src/modules/<name>/`. Call platform ports only.
4. **Wire oRPC** — `implement(appContract)` path in `apps/api/src/http/orpc.ts`.
5. **UI** — query/mutation from `apps/web` or `apps/admin` via the contracts client.
6. **Verify** — `pnpm typecheck`, targeted tests, manual hit through `alchemy:dev`.

## Common mistakes

- Implementing the module before the contract (frontends cannot type against it)
- Importing `apps/api` from a frontend
- Dropping vendor SDK calls into the module instead of a platform adapter
