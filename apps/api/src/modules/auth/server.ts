import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { schema } from "../../platform/db/schema";
import { betterAuthOptions } from "./options";

export type AuthEnv = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
};

/**
 * Better Auth still uses the promise-based node-postgres driver.
 * App domain code uses drizzle-orm/effect-postgres via Database.
 */
export function createAuth(db: NodePgDatabase, env: AuthEnv, schemaTables: typeof schema) {
  return betterAuth({
    ...betterAuthOptions,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schemaTables,
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      // Direct API curls during local development.
      "http://localhost:8787",
      "http://127.0.0.1:8787",
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
