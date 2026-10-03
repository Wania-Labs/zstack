import { Effect, Layer } from "effect";

import type { RequestContext } from "../../http/context";
import { AiLive } from "../ai/ai-service";
import { analyticsLiveFromEnv, type BackgroundTaskRunner } from "../analytics/analytics-service";
import { BillingLive } from "../billing/billing-service";
import type { ApiBindings } from "../cloudflare/bindings";
import { databaseLayer } from "../db/database";
import { emailLiveFromEnv } from "../email/email-service";
import { featureFlagsLiveFromEnv } from "../flags/feature-flags";
import { objectStoreLiveFromEnv } from "../object-store/object-store-service";
import { jobQueueLiveFromEnv } from "../queue/job-queue";
import { durableWorkflowLiveFromEnv } from "../workflow/durable-workflow";
import { CurrentRequestContext } from "./request-context";

export { CurrentRequestContext } from "./request-context";

/**
 * Optional Worker execution hooks. `waitUntil` lets fire-and-forget work
 * (analytics) outlive the response instead of blocking it.
 */
export type RequestExecution = {
  waitUntil?: BackgroundTaskRunner;
};

export function platformLayer(env: ApiBindings, execution: RequestExecution = {}) {
  return Layer.mergeAll(
    emailLiveFromEnv(env),
    AiLive(env),
    BillingLive(env),
    analyticsLiveFromEnv(env, execution.waitUntil),
    featureFlagsLiveFromEnv(env),
    objectStoreLiveFromEnv(env),
    jobQueueLiveFromEnv(env),
    durableWorkflowLiveFromEnv(env),
  );
}

export function requestLayer(
  requestContext: RequestContext,
  env: ApiBindings,
  execution: RequestExecution = {},
) {
  return Layer.mergeAll(
    Layer.succeed(CurrentRequestContext, requestContext),
    databaseLayer(env.HYPERDRIVE.connectionString),
    platformLayer(env, execution),
  );
}

/** Every service a request-scoped effect may depend on. */
export type RequestServices = Layer.Success<ReturnType<typeof requestLayer>>;

/** Services available without a request (no Database / CurrentRequestContext). */
export type PlatformServices = Layer.Success<ReturnType<typeof platformLayer>>;

export type RequestLayerFactory = (
  requestContext: RequestContext,
  env: ApiBindings,
  execution: RequestExecution,
) => Layer.Layer<RequestServices, unknown>;

export type RequestRunner = <A, E>(
  effect: Effect.Effect<A, E, RequestServices>,
  requestContext: RequestContext,
  env: ApiBindings,
  execution?: RequestExecution,
) => Promise<A>;

/**
 * Build a runner over a request layer. Tests inject a layer with fakes;
 * production uses `requestLayer`. `R` must be satisfied by the layer — an
 * effect that needs a service the layer does not provide will not compile.
 */
export function makeRequestRunner(factory: RequestLayerFactory = requestLayer): RequestRunner {
  return (effect, requestContext, env, execution = {}) =>
    Effect.runPromise(effect.pipe(Effect.provide(factory(requestContext, env, execution))));
}

export const runRequestEffect: RequestRunner = makeRequestRunner(requestLayer);

export async function runPlatformEffect<A, E>(
  effect: Effect.Effect<A, E, PlatformServices>,
  env: ApiBindings,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(platformLayer(env))));
}
