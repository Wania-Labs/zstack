import type { Effect } from "effect";
import type { EvlogVariables } from "evlog/hono";
import type { Context, Next } from "hono";

import type { Auth } from "../modules/auth/server";
import type { BackgroundTaskRunner } from "../platform/analytics/analytics-service";
import type { ApiBindings } from "../platform/cloudflare/bindings";
import type { RequestRunner, RequestServices } from "../platform/effect/runtime";

/**
 * Transport request context. Impersonation never overwrites `actor`.
 */
export type RequestContext = {
  requestId: string;
  traceId?: string;
  releaseId: string;
  actor: { type: "user"; userId: string } | { type: "apiKey"; keyId: string } | { type: "system" };
  effectiveUserId?: string;
  /** Active organization. Only set once membership in it has been confirmed. */
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

/** Runs a request-scoped effect with the current request context, env, and execution hooks. */
export type BoundRequestRunner = <A, E>(effect: Effect.Effect<A, E, RequestServices>) => Promise<A>;

export type ApiVariables = {
  requestContext: RequestContext;
  user: SessionUser | null;
  session: SessionRecord | null;
  runEffect: BoundRequestRunner;
};

/** Hono env for the API app: Worker bindings plus request variables and the evlog logger. */
export type ApiEnv = {
  Bindings: ApiBindings;
  Variables: ApiVariables & EvlogVariables["Variables"];
};

/** Client-supplied ids end up in logs and response headers: keep them short and inert. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function createRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Prefer a well-formed `x-request-id`, then Cloudflare's `cf-ray`, else a fresh UUID.
 */
export function resolveRequestId(header: (name: string) => string | undefined): string {
  for (const name of ["x-request-id", "cf-ray"]) {
    const candidate = header(name)?.trim();
    if (candidate && REQUEST_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }
  return createRequestId();
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
  const requestId = resolveRequestId((name) => c.req.header(name));

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

/**
 * `ctx.waitUntil` when the runtime supplied an ExecutionContext (Workers),
 * undefined otherwise (tests, `app.request` without a context).
 */
export function waitUntilOf(c: Context): BackgroundTaskRunner | undefined {
  try {
    const executionCtx = c.executionCtx;
    return (promise) => executionCtx.waitUntil(promise);
  } catch {
    return undefined;
  }
}

/**
 * Expose `c.get("runEffect")`. The request context is read at call time so it
 * reflects the session attached by later middleware.
 */
export function bindRequestRunner(runner: RequestRunner) {
  return async function bindRequestRunnerMiddleware(
    c: Context<{ Bindings: ApiBindings; Variables: ApiVariables }>,
    next: Next,
  ) {
    const waitUntil = waitUntilOf(c);
    c.set("runEffect", (effect) =>
      runner(effect, c.get("requestContext"), c.env, waitUntil ? { waitUntil } : {}),
    );
    await next();
  };
}
