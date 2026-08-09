import type { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import { createAuth } from "../modules/auth/server";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import { schema } from "../platform/db/schema";
import type { ApiVariables, RequestContext } from "./context";

function requireAuthEnv(env: ApiBindings): { BETTER_AUTH_URL: string; BETTER_AUTH_SECRET: string } {
  const { BETTER_AUTH_URL, BETTER_AUTH_SECRET } = env;
  if (!BETTER_AUTH_URL || !BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_URL and BETTER_AUTH_SECRET are required");
  }
  return { BETTER_AUTH_URL, BETTER_AUTH_SECRET };
}

function createAuthDb(client: Client) {
  return drizzle({ client });
}

export async function mountAuthRoutes(
  c: Context<{ Bindings: ApiBindings; Variables: ApiVariables }>,
) {
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    const db = createAuthDb(client);
    const auth = createAuth(db, requireAuthEnv(c.env), schema);
    return await auth.handler(c.req.raw);
  } finally {
    await client.end();
  }
}

/**
 * Resolve Better Auth session into request context after the base context exists.
 */
export async function attachAuthSession(
  c: Context<{ Bindings: ApiBindings; Variables: ApiVariables }>,
  next: Next,
) {
  if (c.req.path.startsWith("/api/auth")) {
    await next();
    return;
  }

  const requestContext = c.get("requestContext");
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  await client.connect();

  try {
    const db = createAuthDb(client);
    const auth = createAuth(db, requireAuthEnv(c.env), schema);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (session) {
      const nextContext: RequestContext = {
        ...requestContext,
        actor: session.session.impersonatedBy
          ? { type: "user", userId: session.session.impersonatedBy }
          : { type: "user", userId: session.user.id },
        effectiveUserId: session.user.id,
        ...(session.session.activeOrganizationId
          ? { organizationId: session.session.activeOrganizationId }
          : {}),
      };

      c.set("requestContext", nextContext);
      c.set("user", session.user);
      c.set("session", session.session);
    }

    await next();
  } finally {
    await client.end();
  }
}
