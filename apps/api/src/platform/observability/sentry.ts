import type { ApiBindings } from "../cloudflare/bindings";

/** True when a consumer has bound a real Sentry DSN (template stays quiet otherwise). */
export function sentryEnabled(env: Pick<ApiBindings, "SENTRY_DSN">): boolean {
  return Boolean(env.SENTRY_DSN?.trim());
}

export function sentryOptions(env: ApiBindings) {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    return {
      dsn: undefined,
      tracesSampleRate: 0,
      enableLogs: false,
    };
  }

  return {
    dsn,
    tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE ?? "1") || 1,
    enableLogs: true,
    environment: env.SENTRY_ENVIRONMENT?.trim() || "development",
    ...(env.SENTRY_RELEASE?.trim() ? { release: env.SENTRY_RELEASE.trim() } : {}),
  };
}
