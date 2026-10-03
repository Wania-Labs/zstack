import * as Sentry from "@sentry/tanstackstart-react";
import type { AnyRouter } from "@tanstack/react-router";

/**
 * Sentry `service` tag per browser app. One name per line so renamed clones
 * stay inside the formatter's print width.
 */
export const sentryServices = {
  web: "zstack-web",
  admin: "zstack-admin",
} as const;

export type SentryService = (typeof sentryServices)[keyof typeof sentryServices];

/**
 * Browser Sentry init. No-op when `VITE_SENTRY_DSN` is unset (template default).
 */
export function initBrowserSentry(router: AnyRouter, service: SentryService) {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || router.isServer) {
    return;
  }

  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "1") || 1;
  const replaysSessionSampleRate =
    Number(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0.1") || 0.1;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || "development",
    ...(import.meta.env.VITE_SENTRY_RELEASE?.trim()
      ? { release: import.meta.env.VITE_SENTRY_RELEASE.trim() }
      : {}),
    integrations: [
      Sentry.tanstackRouterBrowserTracingIntegration(router),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate: 1.0,
    initialScope: {
      tags: { service },
    },
  });
}
