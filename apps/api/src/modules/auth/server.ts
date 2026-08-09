import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { ApiBindings } from "../../platform/cloudflare/bindings";
import { schema } from "../../platform/db/schema";
import { emailLiveFromEnv } from "../../platform/email/email-service";
import { createBetterAuthOptions } from "./options";

export type AuthEnv = Pick<
  ApiBindings,
  | "BETTER_AUTH_URL"
  | "BETTER_AUTH_SECRET"
  | "EMAIL_FROM"
  | "BENTO_SITE_UUID"
  | "BENTO_PUBLISHABLE_KEY"
  | "BENTO_SECRET_KEY"
>;

/**
 * Better Auth still uses the promise-based node-postgres driver.
 * App domain code uses drizzle-orm/effect-postgres via Database.
 */
export function createAuth(db: NodePgDatabase, env: AuthEnv, schemaTables: typeof schema) {
  return betterAuth({
    ...createBetterAuthOptions({
      baseURL: env.BETTER_AUTH_URL,
      emailLive: emailLiveFromEnv(env),
    }),
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
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      // Direct API curls during local development.
      "http://localhost:8787",
      "http://127.0.0.1:8787",
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
