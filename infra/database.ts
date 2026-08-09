import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

/**
 * Hyperdrive in front of Postgres.
 *
 * Local Compose defaults keep `alchemy dev` pointed at `pnpm dev:services`.
 * For deploy, set `DATABASE_*` to a publicly reachable origin (PlanetScale
 * Postgres arrives in a later slice and replaces these Config knobs).
 */
export const Hyperdrive = Effect.gen(function* () {
  const host = yield* Config.string("DATABASE_HOST").pipe(
    Config.withDefault("127.0.0.1"),
  );
  const port = yield* Config.number("DATABASE_PORT").pipe(
    Config.withDefault(5432),
  );
  const database = yield* Config.string("DATABASE_NAME").pipe(
    Config.withDefault("zstack"),
  );
  const user = yield* Config.string("DATABASE_USER").pipe(
    Config.withDefault("zstack"),
  );
  const passwordPlain = yield* Config.string("DATABASE_PASSWORD").pipe(
    Config.withDefault("zstack"),
  );
  const password = Redacted.make(passwordPlain);

  const origin = {
    scheme: "postgres" as const,
    host,
    port,
    database,
    user,
    password,
  };

  return yield* Cloudflare.Hyperdrive.Connection("Hyperdrive", {
    origin,
    caching: { disabled: true },
    dev: {
      scheme: "postgres",
      host: "127.0.0.1",
      port: 5432,
      database: "zstack",
      user: "zstack",
      password: Redacted.make("zstack"),
      sslmode: "disable",
    },
  });
});
