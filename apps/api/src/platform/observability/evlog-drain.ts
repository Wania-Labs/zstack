import type { DrainContext } from "evlog";
import { createSentryDrain } from "evlog/sentry";

import type { ApiBindings } from "../cloudflare/bindings";
import { sentryEnabled } from "./sentry";

/**
 * Per-request drain: no-op without DSN; Sentry Logs when configured.
 * Callers must run under `withRequestEnv` so Worker bindings are visible.
 */
export function createRequestDrain(getEnv: () => ApiBindings | undefined) {
  return async (ctx: DrainContext | DrainContext[]) => {
    const env = getEnv();
    if (!env || !sentryEnabled(env)) {
      return;
    }

    const dsn = env.SENTRY_DSN!.trim();
    await createSentryDrain({
      dsn,
      environment: env.SENTRY_ENVIRONMENT?.trim() || "development",
      ...(env.SENTRY_RELEASE?.trim() ? { release: env.SENTRY_RELEASE.trim() } : {}),
    })(ctx);
  };
}
