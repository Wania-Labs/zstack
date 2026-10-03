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

/** Worker `ctx.waitUntil`: keeps a promise alive after the response is sent. */
export type BackgroundTaskRunner = (promise: Promise<unknown>) => void;

export type AnalyticsLiveOptions = {
  /** Applied when a capture does not set `environment` explicitly. */
  environment?: string;
  /** When set, PostHog requests run after the response instead of inline. */
  waitUntil?: BackgroundTaskRunner;
};

function reportAnalyticsFailure(error: unknown): void {
  console.warn("[analytics] capture failed", error instanceof Error ? error.message : error);
}

function dispatch(run: () => Promise<void>, waitUntil: BackgroundTaskRunner | undefined) {
  if (waitUntil) {
    return Effect.sync(() => {
      waitUntil(run().catch(reportAnalyticsFailure));
    });
  }
  return Effect.promise(() => run().catch(reportAnalyticsFailure));
}

export function makeAnalytics(
  client: AnalyticsClient,
  options: AnalyticsLiveOptions = {},
): Analytics["Service"] {
  return Analytics.of({
    capture: (event, context) =>
      dispatch(
        () =>
          client.capture(event, {
            ...(options.environment ? { environment: options.environment } : {}),
            ...context,
          }),
        options.waitUntil,
      ),
    identify: (identity) => dispatch(() => client.identify(identity), options.waitUntil),
  });
}

export const FakeAnalyticsLive = Layer.succeed(Analytics, makeAnalytics(createNoopAnalytics()));

/**
 * Deployment environment label for analytics/observability. Reuses
 * SENTRY_ENVIRONMENT (set per Alchemy stage) instead of a second variable.
 */
export function deploymentEnvironment(env: { SENTRY_ENVIRONMENT?: string | undefined }): string {
  return env.SENTRY_ENVIRONMENT?.trim() || "development";
}

export function analyticsLiveFromEnv(
  env: {
    POSTHOG_API_KEY?: string | undefined;
    POSTHOG_HOST?: string | undefined;
    SENTRY_ENVIRONMENT?: string | undefined;
  },
  waitUntil?: BackgroundTaskRunner,
): Layer.Layer<Analytics> {
  return Layer.succeed(
    Analytics,
    makeAnalytics(analyticsClientFromEnv(env), {
      environment: deploymentEnvironment(env),
      ...(waitUntil ? { waitUntil } : {}),
    }),
  );
}

export async function runAnalyticsEffect<A>(
  effect: Effect.Effect<A, never, Analytics>,
  live: Layer.Layer<Analytics> = FakeAnalyticsLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
