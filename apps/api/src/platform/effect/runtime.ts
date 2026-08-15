import { Effect, Layer } from "effect";

import type { RequestContext } from "../../http/context";
import { AiLive } from "../ai/ai-service";
import { analyticsLiveFromEnv } from "../analytics/analytics-service";
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

export function platformLayer(env: ApiBindings) {
  return Layer.mergeAll(
    emailLiveFromEnv(env),
    AiLive(env),
    BillingLive(env),
    analyticsLiveFromEnv(env),
    featureFlagsLiveFromEnv(env),
    objectStoreLiveFromEnv(env),
    jobQueueLiveFromEnv(env),
    durableWorkflowLiveFromEnv(env),
  );
}

export function requestLayer(requestContext: RequestContext, env: ApiBindings) {
  return Layer.mergeAll(
    Layer.succeed(CurrentRequestContext, requestContext),
    databaseLayer(env.HYPERDRIVE.connectionString),
    platformLayer(env),
  );
}

export async function runRequestEffect<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  requestContext: RequestContext,
  env: ApiBindings,
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(requestLayer(requestContext, env))) as Effect.Effect<A, E>,
  );
}

export async function runPlatformEffect<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  env: ApiBindings,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(platformLayer(env))) as Effect.Effect<A, E>);
}
