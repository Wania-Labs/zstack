import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { ApiBindings } from "../../platform/cloudflare/bindings";
import { schema } from "../../platform/db/schema";
import {
  analyticsLiveFromEnv,
  type BackgroundTaskRunner,
} from "../../platform/analytics/analytics-service";
import { emailLiveFromEnv } from "../../platform/email/email-service";
import { createBetterAuthOptions } from "./options";
import { resolveTrustedOrigins } from "./trusted-origins";

export type AuthEnv = Pick<
  ApiBindings,
  | "BETTER_AUTH_URL"
  | "ADMIN_URL"
  | "BETTER_AUTH_SECRET"
  | "EMAIL_FROM"
  | "BENTO_SITE_UUID"
  | "BENTO_PUBLISHABLE_KEY"
  | "BENTO_SECRET_KEY"
  | "POSTHOG_API_KEY"
  | "POSTHOG_HOST"
  | "SENTRY_ENVIRONMENT"
>;

export type CreateAuthOptions = {
  /** Worker `ctx.waitUntil` so sign-up analytics does not block the auth response. */
  waitUntil?: BackgroundTaskRunner;
};

/**
 * Better Auth still uses the promise-based node-postgres driver.
 * App domain code uses drizzle-orm/effect-postgres via Database.
 * There is no official Effect / @effect/sql adapter
 * (better-auth#7234: the Drizzle adapter is Promise-only).
 */
export function createAuth(
  db: NodePgDatabase,
  env: AuthEnv,
  schemaTables: typeof schema,
  options: CreateAuthOptions = {},
) {
  return betterAuth({
    ...createBetterAuthOptions({
      baseURL: env.BETTER_AUTH_URL,
      emailLive: emailLiveFromEnv(env),
      analyticsLive: analyticsLiveFromEnv(env, options.waitUntil),
    }),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schemaTables,
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: resolveTrustedOrigins(env),
  });
}

export type Auth = ReturnType<typeof createAuth>;
