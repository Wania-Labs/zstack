import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  hasSessionCookie,
  parseOrganizationRoles,
  requestContextForSession,
  resolveBetterAuthSession,
} from "../../src/http/auth";
import { resolveRequestId, type RequestContext } from "../../src/http/context";
import { canManageBilling } from "../../src/http/orpc";
import {
  failingDatabase,
  fakeSession,
  healthyDatabase,
  rpcClient,
  testApp,
  testEnv,
} from "./support/app-harness";

const baseContext: RequestContext = {
  requestId: "req",
  releaseId: "local",
  actor: { type: "system" },
  locale: "en",
};

async function rpcErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    if (error instanceof ORPCError) {
      return error.code;
    }
    throw error;
  }
}

describe("session cookie short-circuit", () => {
  it("detects Better Auth session cookies, including the __Secure- variant", () => {
    expect(hasSessionCookie(new Headers())).toBe(false);
    expect(hasSessionCookie(new Headers({ cookie: "theme=dark" }))).toBe(false);
    expect(hasSessionCookie(new Headers({ cookie: "better-auth.session_token=abc" }))).toBe(true);
    expect(
      hasSessionCookie(
        new Headers({ cookie: "theme=dark; __Secure-better-auth.session_token=abc" }),
      ),
    ).toBe(true);
  });

  it("resolves no session without touching Postgres when no cookie is sent", async () => {
    // The connection string points nowhere: connecting would reject.
    await expect(
      resolveBetterAuthSession({ headers: new Headers(), env: testEnv }),
    ).resolves.toBeNull();
  });
});

describe("requestContextForSession", () => {
  it("populates organization, member id, and roles from the member row", () => {
    const context = requestContextForSession(
      baseContext,
      fakeSession({ userId: "u1", activeOrganizationId: "org_1", memberRole: "admin,member" }),
    );
    expect(context.organizationId).toBe("org_1");
    expect(context.memberId).toBe("member_u1");
    expect([...(context.organizationRoles ?? [])]).toEqual(["admin", "member"]);
    expect(context.effectiveUserId).toBe("u1");
  });

  it("drops a stale active organization that has no membership", () => {
    const context = requestContextForSession(
      baseContext,
      fakeSession({ userId: "u1", activeOrganizationId: "org_1" }),
    );
    expect(context.organizationId).toBeUndefined();
    expect(context.organizationRoles).toBeUndefined();
  });

  it("keeps the impersonator as actor", () => {
    const context = requestContextForSession(
      baseContext,
      fakeSession({ userId: "u1", impersonatedBy: "staff_1" }),
    );
    expect(context.actor).toEqual({ type: "user", userId: "staff_1" });
    expect(context.effectiveUserId).toBe("u1");
  });

  it("parses comma-separated roles", () => {
    expect([...parseOrganizationRoles(" owner , ,admin")]).toEqual(["owner", "admin"]);
    expect(parseOrganizationRoles(null).size).toBe(0);
  });
});

describe("canManageBilling", () => {
  it("requires owner or admin", () => {
    expect(canManageBilling({ ...baseContext, organizationRoles: new Set(["owner"]) })).toBe(true);
    expect(canManageBilling({ ...baseContext, organizationRoles: new Set(["admin"]) })).toBe(true);
    expect(canManageBilling({ ...baseContext, organizationRoles: new Set(["member"]) })).toBe(
      false,
    );
    expect(canManageBilling(baseContext)).toBe(false);
  });
});

describe("billing checkout / portal authorization over oRPC", () => {
  const member = fakeSession({ userId: "m1", activeOrganizationId: "org_1", memberRole: "member" });
  const admin = fakeSession({ userId: "a1", activeOrganizationId: "org_1", memberRole: "admin" });
  const owner = fakeSession({ userId: "o1", activeOrganizationId: "org_1", memberRole: "owner" });

  it("forbids plain members", async () => {
    const client = rpcClient(testApp({ session: member }));
    expect(await rpcErrorCode(client.billing.createCheckout({ productSlug: "pro" }))).toBe(
      "FORBIDDEN",
    );
    expect(await rpcErrorCode(client.billing.customerPortal({}))).toBe("FORBIDDEN");
  });

  it("allows owners and admins", async () => {
    for (const session of [owner, admin]) {
      const client = rpcClient(testApp({ session }));
      await expect(client.billing.createCheckout({ productSlug: "pro" })).resolves.toEqual({
        kind: "unconfigured",
      });
      await expect(client.billing.customerPortal({})).resolves.toEqual({ kind: "unconfigured" });
    }
  });

  it("forbids a user whose membership no longer backs the active org", async () => {
    const client = rpcClient(
      testApp({ session: fakeSession({ userId: "x1", activeOrganizationId: "org_1" }) }),
    );
    expect(await rpcErrorCode(client.billing.createCheckout({ productSlug: "pro" }))).toBe(
      "BAD_REQUEST",
    );
  });

  it("requires a session", async () => {
    const client = rpcClient(testApp());
    expect(await rpcErrorCode(client.billing.createCheckout({ productSlug: "pro" }))).toBe(
      "UNAUTHORIZED",
    );
  });
});

describe("request id", () => {
  const headers = (values: Record<string, string>) => (name: string) => values[name];

  it("accepts a well-formed x-request-id", () => {
    expect(resolveRequestId(headers({ "x-request-id": "abc-123_.X" }))).toBe("abc-123_.X");
  });

  it("falls back to cf-ray, then a UUID, for unsafe values", () => {
    expect(
      resolveRequestId(headers({ "x-request-id": "<script>", "cf-ray": "8a1b2c3d4e5f-SJC" })),
    ).toBe("8a1b2c3d4e5f-SJC");
    const generated = resolveRequestId(headers({ "x-request-id": "a".repeat(129) }));
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not echo an unsafe header back", async () => {
    const response = await testApp({ database: healthyDatabase }).request(
      "http://localhost/health",
      { headers: { "x-request-id": "bad id\twith spaces" } },
      testEnv,
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("/health", () => {
  it("reports up with 200", async () => {
    const response = await testApp({ database: healthyDatabase }).request(
      "http://localhost/health",
      {},
      testEnv,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: "up" });
  });

  it("reports a failed ping as 503 database down", async () => {
    const response = await testApp({ database: failingDatabase }).request(
      "http://localhost/health",
      {},
      testEnv,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, database: "down" });
  });

  it("reports an unreachable database (layer build failure) as 503", async () => {
    const response = await testApp({
      runRequest: () => Promise.reject(new Error("connect ECONNREFUSED")),
    }).request("http://localhost/health", {}, testEnv);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, database: "down" });
  });

  it("maps database down to SERVICE_UNAVAILABLE over oRPC", async () => {
    const client = rpcClient(testApp({ database: failingDatabase }));
    expect(await rpcErrorCode(client.health())).toBe("SERVICE_UNAVAILABLE");
  });
});
