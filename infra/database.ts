import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Planetscale from "alchemy/Planetscale";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

/**
 * Local Compose Postgres — Hyperdrive origin under `alchemy:dev`, and
 * Hyperdrive `dev` override under deploy so local still hits Compose.
 */
export const composeDevOrigin = {
  scheme: "postgres" as const,
  host: "127.0.0.1",
  port: 5432,
  database: "zstack",
  user: "zstack",
  password: Redacted.make("zstack"),
  sslmode: "disable" as const,
};

/**
 * PlanetScale Postgres database + stage branch + app role.
 *
 * Only used outside `alchemy:dev`. Migrations stay on drizzle-kit
 * (`pnpm db:migrate`) — Alchemy's `migrationsDir` expects flat
 * numeric-prefixed `.sql`, not Drizzle 1.0 folder snapshots.
 */
export const PlanetscaleDb = Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;
  const regionSlug = yield* Config.String("PLANETSCALE_REGION").pipe(Config.withDefault("us-east"));

  // Preview stages (`pr-*`) reuse the `staging` stage's database and get their
  // own branch below; personal/prod stages own a database. Deploy `staging`
  // before any preview stage.
  const database = stage.startsWith("pr-")
    ? yield* Planetscale.PostgresDatabase.ref("Database", {
        stage: "staging",
      })
    : yield* Planetscale.PostgresDatabase("Database", {
        region: { slug: regionSlug },
        clusterSize: "PS_DEV",
        majorVersion: "18",
      });

  const branch = yield* Planetscale.PostgresBranch("Branch", {
    database,
    parentBranch: "main",
  });

  // Least privilege for the Worker runtime (via Hyperdrive): DML on all
  // tables/sequences, no DDL or role management. Migrations run separately
  // with drizzle-kit against `DATABASE_URL` (a schema-owning credential).
  const role = yield* Planetscale.PostgresRole("AppRole", {
    database,
    branch,
    inheritedRoles: ["pg_read_all_data", "pg_write_all_data"],
  });

  return { database, branch, role };
});

export const composeHyperdrive = () =>
  Cloudflare.Hyperdrive.Connection("Hyperdrive", {
    origin: composeDevOrigin,
    caching: { disabled: true },
    dev: composeDevOrigin,
  });

export const planetscaleHyperdrive = (role: Planetscale.PostgresRole) =>
  Cloudflare.Hyperdrive.Connection("Hyperdrive", {
    origin: role.origin,
    caching: { disabled: true },
    dev: composeDevOrigin,
  });

/**
 * Local (`alchemy:dev`): Compose-only Hyperdrive, no PlanetScale create.
 * Deploy/plan: PlanetScale DB/branch/role + Hyperdrive origin from AppRole.
 */
export const Database = Effect.gen(function* () {
  if (yield* Alchemy.ALCHEMY_DEV) {
    return {
      kind: "compose" as const,
      hyperdrive: yield* composeHyperdrive(),
    };
  }

  const { database, branch, role } = yield* PlanetscaleDb;
  return {
    kind: "planetscale" as const,
    hyperdrive: yield* planetscaleHyperdrive(role),
    database,
    branch,
    role,
  };
});
