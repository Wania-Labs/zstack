import type { Context, Next } from "hono";

import type { Auth } from "../modules/auth/server";

/**
 * Transport request context. Impersonation never overwrites `actor`.
 */
export type RequestContext = {
  requestId: string;
  traceId?: string;
  releaseId: string;
  actor: { type: "user"; userId: string } | { type: "apiKey"; keyId: string } | { type: "system" };
  effectiveUserId?: string;
  organizationId?: string;
  memberId?: string;
  organizationRoles?: ReadonlySet<string>;
  staffCapabilities?: ReadonlySet<string>;
  locale: string;
  idempotencyKey?: string;
  syntheticProductionTest?: boolean;
};

type SessionUser = Auth["$Infer"]["Session"]["user"];
type SessionRecord = Auth["$Infer"]["Session"]["session"];

export type ApiVariables = {
  requestContext: RequestContext;
  user: SessionUser | null;
  session: SessionRecord | null;
};

function createRequestId(): string {
  return crypto.randomUUID();
}

export function systemRequestContext(): RequestContext {
  return {
    requestId: createRequestId(),
    releaseId: "local",
    actor: { type: "system" },
    locale: "en",
  };
}

export async function attachRequestContext(c: Context<{ Variables: ApiVariables }>, next: Next) {
  const requestId = c.req.header("x-request-id")?.trim() || createRequestId();

  const requestContext: RequestContext = {
    requestId,
    releaseId: "local",
    actor: { type: "system" },
    locale: c.req.header("accept-language")?.split(",")[0]?.trim() || "en",
  };

  c.set("requestContext", requestContext);
  c.set("user", null);
  c.set("session", null);
  c.header("x-request-id", requestId);
  await next();
}
