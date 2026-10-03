import * as Sentry from "@sentry/cloudflare";
import type { RequestLogger } from "evlog";

type ErrorLogger = Pick<RequestLogger, "error">;

function asError(error: unknown, operation: string): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(`${operation} failed`, { cause: error });
}

/**
 * Record an unexpected failure on the request wide event (evlog) and in Sentry.
 * Callers still return a generic response; internals never reach the client.
 * Sentry is a no-op when no DSN is bound.
 */
export function reportError(log: ErrorLogger | undefined, error: unknown, operation: string): void {
  log?.error(asError(error, operation), { operation });
  Sentry.captureException(error, { tags: { operation } });
}
