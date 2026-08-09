import { PgClient } from "@effect/sql-pg";
import { sql } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { types } from "pg";

import { relations } from "./relations";

/**
 * pg returns Date objects for these OIDs by default; Drizzle wants raw strings.
 * @see https://orm.drizzle.team/docs/connect-effect-postgres
 */
const DRIZZLE_RAW_DATE_OIDS = new Set([
  1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182,
]);

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
  static readonly Live = Layer.effect(
    Database,
    PgDrizzle.makeWithDefaults({ relations }),
  );
}

export function pgClientLayer(connectionString: string) {
  return PgClient.layerFrom(
    PgClient.makeClient({
      url: Redacted.make(connectionString),
      types: {
        getTypeParser: (typeId, format) => {
          if (DRIZZLE_RAW_DATE_OIDS.has(typeId)) {
            return (val: unknown) => val;
          }
          return types.getTypeParser(typeId, format);
        },
      },
    }),
  );
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
