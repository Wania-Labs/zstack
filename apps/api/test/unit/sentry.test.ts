import { describe, expect, it } from "vitest";

import type { ApiBindings } from "../../src/platform/cloudflare/bindings";
import {
  DEFAULT_TRACES_SAMPLE_RATE,
  parseTracesSampleRate,
  sentryOptions,
} from "../../src/platform/observability/sentry";

describe("parseTracesSampleRate", () => {
  it("honours an explicit 0", () => {
    expect(parseTracesSampleRate("0")).toBe(0);
  });

  it("defaults when unset, blank, or not a number", () => {
    expect(parseTracesSampleRate(undefined)).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    expect(parseTracesSampleRate("  ")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    expect(parseTracesSampleRate("abc")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    expect(DEFAULT_TRACES_SAMPLE_RATE).toBe(0.1);
  });

  it("clamps to [0, 1]", () => {
    expect(parseTracesSampleRate("0.25")).toBe(0.25);
    expect(parseTracesSampleRate("5")).toBe(1);
    expect(parseTracesSampleRate("-1")).toBe(0);
  });

  it("feeds sentryOptions when a DSN is bound", () => {
    const options = sentryOptions({
      HYPERDRIVE: { connectionString: "postgres://unused" },
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret",
      SENTRY_DSN: "https://public@o0.ingest.sentry.io/0",
      SENTRY_TRACES_SAMPLE_RATE: "0",
    } as ApiBindings);
    expect(options.tracesSampleRate).toBe(0);
  });
});
