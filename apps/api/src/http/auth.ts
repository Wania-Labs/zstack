import { getSessionCookie } from "better-auth/cookies";
import { and, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Context, Next } from "hono";
import { Client } from "pg";

import { createAuth, type Auth } from "../modules/auth/server";
import { staffCapabilitiesForRole } from "../modules/auth/staff";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import { member, schema } from "../platform/db/schema";
import { waitUntilOf, type ApiVariables, type RequestContext } from "./context";

type AuthSession = Auth["$Infer"]["Session"];

export type OrganizationMembership = {
  memberId: string;
  roles: ReadonlySet<string>;
};

export type ResolvedSession = {
  user: AuthSession["user"];
  session: AuthSession["session"];
  /** Membership in `session.activeOrganizationId`, when the user still belongs to it. */
  membership?: OrganizationMembership;
};

/**
 * Resolve the caller's session from request headers. Injectable so HTTP tests
 * can run the real Hono app without Postgres or Better Auth.
 */
export type SessionResolver = (input: {
  headers: Headers;
  env: ApiBindings;
}) => Promise<ResolvedSession | null>;

function requireAuthEnv(env: ApiBindings): {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  EMAIL_FROM?: string;
  BENTO_SITE_UUID?: string;
  BENTO_PUBLISHABLE_KEY?: string;
  BENTO_SECRET_KEY?: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
  SENTRY_ENVIRONMENT?: string;
} {
  const { BETTER_AUTH_URL, BETTER_AUTH_SECRET } = env;
  if (!BETTER_AUTH_URL || !BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_URL and BETTER_AUTH_SECRET are required");
  }
  return {
    BETTER_AUTH_URL,
    BETTER_AUTH_SECRET,
    ...(env.EMAIL_FROM ? { EMAIL_FROM: env.EMAIL_FROM } : {}),
    ...(env.BENTO_SITE_UUID ? { BENTO_SITE_UUID: env.BENTO_SITE_UUID } : {}),
    ...(env.BENTO_PUBLISHABLE_KEY ? { BENTO_PUBLISHABLE_KEY: env.BENTO_PUBLISHABLE_KEY } : {}),
    ...(env.BENTO_SECRET_KEY ? { BENTO_SECRET_KEY: env.BENTO_SECRET_KEY } : {}),
    ...(env.POSTHOG_API_KEY ? { POSTHOG_API_KEY: env.POSTHOG_API_KEY } : {}),
    ...(env.POSTHOG_HOST ? { POSTHOG_HOST: env.POSTHOG_HOST } : {}),
    ...(env.SENTRY_ENVIRONMENT ? { SENTRY_ENVIRONMENT: env.SENTRY_ENVIRONMENT } : {}),
  };
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
    const waitUntil = waitUntilOf(c);
    const auth = createAuth(db, requireAuthEnv(c.env), schema, waitUntil ? { waitUntil } : {});
    return await auth.handler(c.req.raw);
  } finally {
    await client.end();
  }
}

/** Better Auth stores multiple organization roles comma-separated (`"admin,member"`). */
export function parseOrganizationRoles(role: string | null | undefined): ReadonlySet<string> {
  return new Set(
    (role ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

async function loadMembership(
  db: NodePgDatabase,
  organizationId: string,
  userId: string,
): Promise<OrganizationMembership | undefined> {
  const rows = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return { memberId: row.id, roles: parseOrganizationRoles(row.role) };
}

/**
 * True when the request carries a Better Auth session token cookie
 * (`better-auth.session_token`, including the `__Secure-` variant used on HTTPS).
 */
export function hasSessionCookie(headers: Headers): boolean {
  return getSessionCookie(headers) !== null;
}

/**
 * Default resolver: Better Auth session + member row for the active organization.
 * Skips Postgres and Better Auth entirely when no session cookie is present.
 */
export const resolveBetterAuthSession: SessionResolver = async ({ headers, env }) => {
  if (!hasSessionCookie(headers)) {
    return null;
  }

  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    const db = createAuthDb(client);
    const auth = createAuth(db, requireAuthEnv(env), schema);
    const session = await auth.api.getSession({ headers });
    if (!session) {
      return null;
    }

    const activeOrganizationId = session.session.activeOrganizationId;
    const membership = activeOrganizationId
      ? await loadMembership(db, activeOrganizationId, session.user.id)
      : undefined;

    return {
      user: session.user,
      session: session.session,
      ...(membership ? { membership } : {}),
    };
  } finally {
    await client.end();
  }
};

/**
 * Project a resolved session onto the transport context. The active
 * organization is only trusted when a membership row backs it.
 */
export function requestContextForSession(
  base: RequestContext,
  resolved: ResolvedSession,
): RequestContext {
  const staffCapabilities = staffCapabilitiesForRole(resolved.user.role);
  const activeOrganizationId = resolved.session.activeOrganizationId;
  const membership = activeOrganizationId ? resolved.membership : undefined;

  return {
    ...base,
    actor: resolved.session.impersonatedBy
      ? { type: "user", userId: resolved.session.impersonatedBy }
      : { type: "user", userId: resolved.user.id },
    effectiveUserId: resolved.user.id,
    ...(activeOrganizationId && membership
      ? {
          organizationId: activeOrganizationId,
          memberId: membership.memberId,
          organizationRoles: membership.roles,
        }
      : {}),
    ...(staffCapabilities.size > 0 ? { staffCapabilities } : {}),
  };
}

/**
 * Resolve the session into request context after the base context exists.
 */
export function attachAuthSession(resolveSession: SessionResolver = resolveBetterAuthSession) {
  return async function attachAuthSessionMiddleware(
    c: Context<{ Bindings: ApiBindings; Variables: ApiVariables }>,
    next: Next,
  ) {
    if (c.req.path.startsWith("/api/auth") || c.req.path.startsWith("/api/webhooks")) {
      await next();
      return;
    }

    const resolved = await resolveSession({ headers: c.req.raw.headers, env: c.env });
    if (resolved) {
      c.set("requestContext", requestContextForSession(c.get("requestContext"), resolved));
      c.set("user", resolved.user);
      c.set("session", resolved.session);
    }

    await next();
  };
}
