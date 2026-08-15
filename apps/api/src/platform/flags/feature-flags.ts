import { Context, Effect, Layer } from "effect";

export type FlagValue = boolean | string | number;

export type FlagReason = "static" | "default" | "error";

export type FlagEvaluation<T extends FlagValue> = {
  value: T;
  reason: FlagReason;
};

export type FlagEvaluationContext = {
  targetingKey: string;
  organizationId?: string;
  userId?: string;
  environment: string;
};

export type FlagRequest<T extends FlagValue> = {
  key: string;
  defaultValue: T;
  context?: FlagEvaluationContext;
};

export type FlagOverrides = Readonly<Record<string, FlagValue>>;

/**
 * Application feature-flag boundary. Callers pass the safe default at the
 * call site. Adapters own the override map. Missing keys do not throw.
 */
export class FeatureFlags extends Context.Service<
  FeatureFlags,
  {
    boolean(input: FlagRequest<boolean>): Effect.Effect<FlagEvaluation<boolean>>;
    string(input: FlagRequest<string>): Effect.Effect<FlagEvaluation<string>>;
    number(input: FlagRequest<number>): Effect.Effect<FlagEvaluation<number>>;
  }
>()("@zstack/api/platform/flags/FeatureFlags") {}

function isSameType<T extends FlagValue>(value: FlagValue, sample: T): value is T {
  return typeof value === typeof sample;
}

function evaluateFlag<T extends FlagValue>(
  overrides: FlagOverrides,
  key: string,
  defaultValue: T,
): FlagEvaluation<T> {
  if (!Object.hasOwn(overrides, key)) {
    return { value: defaultValue, reason: "default" };
  }
  const stored = overrides[key];
  if (stored === undefined || !isSameType(stored, defaultValue)) {
    return { value: defaultValue, reason: "error" };
  }
  return { value: stored, reason: "static" };
}

function makeFeatureFlags(overrides: FlagOverrides): FeatureFlags["Service"] {
  return FeatureFlags.of({
    boolean: (input) => Effect.sync(() => evaluateFlag(overrides, input.key, input.defaultValue)),
    string: (input) => Effect.sync(() => evaluateFlag(overrides, input.key, input.defaultValue)),
    number: (input) => Effect.sync(() => evaluateFlag(overrides, input.key, input.defaultValue)),
  });
}

export function makeFakeFeatureFlagsLive(overrides: FlagOverrides = {}): Layer.Layer<FeatureFlags> {
  return Layer.succeed(FeatureFlags, makeFeatureFlags(overrides));
}

export const DEFAULT_FLAG_OVERRIDES: FlagOverrides = {
  "example.ready": true,
};

export const FakeFeatureFlagsLive = makeFakeFeatureFlagsLive(DEFAULT_FLAG_OVERRIDES);

function parseFlagValue(raw: string): FlagValue {
  const trimmed = raw.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

function flagKeyFromEnvName(name: string): string {
  return name.slice("FEATURE_FLAG_".length).toLowerCase().replaceAll("_", ".");
}

/**
 * Read `FEATURE_FLAG_<KEY>` string bindings into the in-memory map.
 * Example: FEATURE_FLAG_EXAMPLE_READY=true → example.ready.
 */
export function readFlagOverrides(env: Record<string, unknown>): FlagOverrides {
  const overrides: Record<string, FlagValue> = {};
  const prefix = "FEATURE_FLAG_";

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(prefix) || typeof value !== "string" || !value.trim()) {
      continue;
    }
    overrides[flagKeyFromEnvName(key)] = parseFlagValue(value);
  }

  return overrides;
}

export function featureFlagsLiveFromEnv(env: Record<string, unknown>): Layer.Layer<FeatureFlags> {
  return makeFakeFeatureFlagsLive({
    ...DEFAULT_FLAG_OVERRIDES,
    ...readFlagOverrides(env),
  });
}

export async function runFeatureFlagsEffect<A>(
  effect: Effect.Effect<A, never, FeatureFlags>,
  live: Layer.Layer<FeatureFlags> = FakeFeatureFlagsLive,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(live)));
}
