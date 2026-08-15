import {
  analyticsClientFromEnv,
  createNoopAnalytics,
  type AnalyticsClient,
  type AnalyticsContext,
  type AnalyticsIdentity,
  type ProductEvent,
} from "@zstack/analytics";
import { Context, Effect, Layer, Schema } from "effect";

export class AnalyticsError extends Schema.TaggedError<AnalyticsError>()("AnalyticsError", {
  message: Schema.String,
}) {}

/**
 * Product analytics boundary. Capture is fire-and-forget: failures never
 * fail the calling feature.
 */
export class Analytics extends Context.Service<
  Analytics,
  {
    capture(event: ProductEvent, context: AnalyticsContext): Effect.Effect<void>;
    identify(identity: AnalyticsIdentity): Effect.Effect<void>;
  }
>()("@zstack/api/platform/analytics/Analytics") {}

function swallow(run: () => Promise<void>): Effect.Effect<void> {
  return Effect.promise(async () => {
    try {
      await run();
    } catch {
      return;
    }
  });
}

function makeAnalytics(client: AnalyticsClient): Analytics["Service"] {
  return Analytics.of({
    capture: (event, context) => swallow(() => client.capture(event, context)),
    identify: (identity) => swallow(() => client.identify(identity)),
  });
}

export const FakeAnalyticsLive = Layer.succeed(Analytics, makeAnalytics(createNoopAnalytics()));

export function analyticsLiveFromEnv(env: {
  POSTHOG_API_KEY?: string | undefined;
  POSTHOG_HOST?: string | undefined;
}): Layer.Layer<Analytics> {
  return Layer.succeed(Analytics, makeAnalytics(analyticsClientFromEnv(env)));
}

export async function runAnalyticsEffect<A>(
  effect: Effect.Effect<A, never, Analytics>,
  live: Layer.Layer<Analytics> = FakeAnalyticsLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
