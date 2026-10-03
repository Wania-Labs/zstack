import type { ApiBindings } from "../cloudflare/bindings";

/** True when a consumer has bound a real Sentry DSN (template stays quiet otherwise). */
export function sentryEnabled(env: Pick<ApiBindings, "SENTRY_DSN">): boolean {
  return Boolean(env.SENTRY_DSN?.trim());
}

/** Default trace sampling when SENTRY_TRACES_SAMPLE_RATE is unset or invalid. */
export const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

/**
 * Parse a 0–1 sample rate. Unset/blank/non-numeric → default; out of range is
 * clamped. `"0"` is a valid rate (tracing off), not a fallback trigger.
 */
export function parseTracesSampleRate(
  raw: string | undefined,
  fallback: number = DEFAULT_TRACES_SAMPLE_RATE,
): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }
  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

export function sentryOptions(env: ApiBindings) {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    return {
      dsn: undefined,
      tracesSampleRate: 0,
    };
  }

  return {
    dsn,
    tracesSampleRate: parseTracesSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    environment: env.SENTRY_ENVIRONMENT?.trim() || "development",
    ...(env.SENTRY_RELEASE?.trim() ? { release: env.SENTRY_RELEASE.trim() } : {}),
  };
}
