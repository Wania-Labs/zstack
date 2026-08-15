import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Planetscale from "alchemy/Planetscale";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Admin } from "./infra/admin.ts";
import { Api } from "./infra/api.ts";
import { Database } from "./infra/database.ts";
import { Jobs } from "./infra/jobs.ts";
import { Objects } from "./infra/storage.ts";
import { Web } from "./infra/web.ts";

/**
 * Alchemy v2 stack — sole deploy / provision authority.
 * Local escape hatch: `pnpm --filter @zstack/api dev` (wrangler) + web/admin Vite.
 *
 * `alchemy:dev` skips PlanetScale and binds Hyperdrive to Compose
 * (`pnpm dev:services`). `alchemy:deploy` provisions PlanetScale + cloud Hyperdrive.
 * PlanetScale auth: `alchemy login` / profile credentials (or token env).
 */
export default Alchemy.Stack(
  "zstack",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Planetscale.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const db = yield* Database;
    const objects = yield* Objects;
    const jobs = yield* Jobs;
    const api = yield* Api(db.hyperdrive, objects, jobs);
    yield* Cloudflare.Queues.Consumer("JobsConsumer", {
      queueId: jobs.queueId,
      scriptName: api.workerName,
    });
    const web = yield* Web(api);
    const admin = yield* Admin(api);

    const shared = {
      apiUrl: api.url.as<string>(),
      webUrl: web.url.as<string>(),
      adminUrl: admin.url.as<string>(),
      hyperdriveId: db.hyperdrive.hyperdriveId,
    };

    if (db.kind === "compose") {
      return { ...shared, database: "compose" as const };
    }

    return {
      ...shared,
      database: "planetscale" as const,
      databaseId: db.database.id,
      databaseName: db.database.name,
      branchName: db.branch.name,
      // Role credentials stay off stack outputs — use PlanetScale dashboard / migrate jobs.
      roleName: db.role.name,
    };
  }),
);
