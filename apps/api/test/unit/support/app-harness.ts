import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { Effect, Layer } from "effect";

import { createApp } from "../../../src/http/app";
import type { ResolvedSession, SessionResolver } from "../../../src/http/auth";
import { parseOrganizationRoles } from "../../../src/http/auth";
import type { AppRouter } from "../../../src/http/orpc";
import type { ApiBindings } from "../../../src/platform/cloudflare/bindings";
import { Database } from "../../../src/platform/db/database";
import { CurrentRequestContext } from "../../../src/platform/effect/request-context";
import {
  makeRequestRunner,
  platformLayer,
  type RequestRunner,
} from "../../../src/platform/effect/runtime";

/** Worker env with no optional vendors bound: every adapter falls back to its fake. */
export const testEnv = {
  HYPERDRIVE: { connectionString: "postgres://unused.invalid:5432/unused" },
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-test-secret",
} as unknown as ApiBindings;

export function fakeSession(input: {
  userId: string;
  activeOrganizationId?: string;
  /** Member role(s) in the active organization. Omit to simulate a missing member row. */
  memberRole?: string;
  impersonatedBy?: string;
}): ResolvedSession {
  const user = {
    id: input.userId,
    email: `${input.userId}@example.com`,
    name: input.userId,
    emailVerified: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    role: "user",
  } as ResolvedSession["user"];
  const session = {
    id: `session_${input.userId}`,
    userId: input.userId,
    token: `token_${input.userId}`,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(0),
    updatedAt: new Date(0),
    activeOrganizationId: input.activeOrganizationId ?? null,
    impersonatedBy: input.impersonatedBy ?? null,
  } as ResolvedSession["session"];
  return {
    user,
    session,
    ...(input.activeOrganizationId && input.memberRole !== undefined
      ? {
          membership: {
            memberId: `member_${input.userId}`,
            roles: parseOrganizationRoles(input.memberRole),
          },
        }
      : {}),
  };
}

type DatabaseStub = Partial<Record<"execute", (...args: ReadonlyArray<unknown>) => unknown>>;

/** A Database whose methods throw unless stubbed: proves a code path never touched SQL. */
export function databaseLayerStub(stub: DatabaseStub = {}): Layer.Layer<Database> {
  const service = new Proxy(stub, {
    get(target, property) {
      if (property in target) {
        return target[property as keyof DatabaseStub];
      }
      throw new Error(`Database.${String(property)} is not available in this test`);
    },
  });
  return Layer.succeed(Database, service as unknown as Database["Service"]);
}

export const failingDatabase = databaseLayerStub({
  execute: () => Effect.fail(new Error("connection refused")),
});

export const healthyDatabase = databaseLayerStub({
  execute: () => Effect.succeed([]),
});

export function testRunner(database: Layer.Layer<Database> = databaseLayerStub()): RequestRunner {
  return makeRequestRunner((requestContext, env, execution) =>
    Layer.mergeAll(
      Layer.succeed(CurrentRequestContext, requestContext),
      database,
      platformLayer(env, execution),
    ),
  );
}

export function testApp(
  input: {
    session?: ResolvedSession | null;
    database?: Layer.Layer<Database>;
    runRequest?: RequestRunner;
  } = {},
) {
  const resolveSession: SessionResolver = async () => input.session ?? null;
  return createApp({
    resolveSession,
    runRequest: input.runRequest ?? testRunner(input.database),
  });
}

export function rpcClient(app: ReturnType<typeof createApp>): RouterClient<AppRouter> {
  return createORPCClient(
    new RPCLink({
      url: "http://localhost/api/rpc",
      fetch: (request) => Promise.resolve(app.fetch(request, testEnv)),
    }),
  );
}
