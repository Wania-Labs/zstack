import { PgClient } from "@effect/sql-pg";
import { sql } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer, Redacted, Schema } from "effect";

import { relations } from "./relations";

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  message: Schema.String,
}) {}

export type AppDatabase = PgDrizzle.EffectPgDatabase<typeof relations>;

/**
 * Effect-native Drizzle database. Yield and query: `const db = yield* Database`.
 */
export class Database extends Context.Service<Database, AppDatabase>()(
  "@zstack/api/platform/db/Database",
) {
  static readonly Live = Layer.effect(Database, PgDrizzle.makeWithDefaults({ relations }));
}

/**
 * `@effect/sql-pg` 4 speaks the Postgres wire protocol itself (no `pg`), so
 * there is no node-postgres type parser to override. Drizzle's
 * `effect-postgres` codecs cast date / timestamp / interval columns to text in
 * the query, which is what the old raw-date parser override used to fake.
 * `sslmode=prefer` (Hyperdrive's local origin passthrough) is handled natively.
 */
export function pgClientLayer(connectionString: string) {
  return PgClient.layerFrom(PgClient.makeClient({ url: Redacted.make(connectionString) }));
}

export function databaseLayer(connectionString: string) {
  return Database.Live.pipe(Layer.provide(pgClientLayer(connectionString)));
}

export const ping = Effect.fn("Database.ping")(function* () {
  const db = yield* Database;
  yield* db.execute(sql`select 1`).pipe(
    Effect.mapError(
      () =>
        new DatabaseError({
          message: "database ping failed",
        }),
    ),
    Effect.asVoid,
  );
});
