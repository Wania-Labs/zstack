import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { Api } from "./infra/api";
import { Hyperdrive } from "./infra/database";
import { Web } from "./infra/web";

/**
 * Alchemy v2 stack — sole deploy / provision authority.
 * Local escape hatch: `pnpm --filter @zstack/api dev` (wrangler) + web Vite.
 */
export default Alchemy.Stack(
  "zstack",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const hyperdrive = yield* Hyperdrive;
    const api = yield* Api(hyperdrive);
    const web = yield* Web(api);

    return {
      apiUrl: api.url.as<string>(),
      webUrl: web.url.as<string>(),
      hyperdriveId: hyperdrive.hyperdriveId,
    };
  }),
);
