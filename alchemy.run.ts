import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Planetscale from "alchemy/Planetscale";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Api } from "./infra/api";
import { Hyperdrive, PlanetscaleDb } from "./infra/database";
import { Web } from "./infra/web";

/**
 * Alchemy v2 stack — sole deploy / provision authority.
 * Local escape hatch: `pnpm --filter @zstack/api dev` (wrangler) + web Vite.
 *
 * PlanetScale auth: `alchemy login` / profile credentials (or token env).
 * Hyperdrive `dev` still targets Compose Postgres from `pnpm dev:services`.
 */
export default Alchemy.Stack(
  "zstack",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Planetscale.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { database, branch, role } = yield* PlanetscaleDb;
    const hyperdrive = yield* Hyperdrive(role);
    const api = yield* Api(hyperdrive);
    const web = yield* Web(api);

    return {
      apiUrl: api.url.as<string>(),
      webUrl: web.url.as<string>(),
      hyperdriveId: hyperdrive.hyperdriveId,
      databaseId: database.id,
      databaseName: database.name,
      branchName: branch.name,
      // Role credentials stay off stack outputs — use PlanetScale dashboard / migrate jobs.
      roleName: role.name,
    };
  }),
);
