import type { AnalyticsClient } from "@zstack/analytics";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Analytics,
  deploymentEnvironment,
  makeAnalytics,
} from "../../src/platform/analytics/analytics-service";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Analytics service", () => {
  function recordingClient() {
    const captured: Array<{ environment?: string }> = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client: AnalyticsClient = {
      capture: async (_event, context) => {
        await gate;
        captured.push(context);
      },
      identify: async () => undefined,
    };
    return { client, captured, release };
  }

  it("hands capture to waitUntil instead of awaiting it inline", async () => {
    const { client, captured, release } = recordingClient();
    const pending: Array<Promise<unknown>> = [];
    const analytics = makeAnalytics(client, {
      environment: "production",
      waitUntil: (promise) => pending.push(promise),
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* analytics.capture(
          { name: "account_signed_up", properties: { source: "web" } },
          { distinctId: "u1" },
        );
      }),
    );
    // The effect finished while the PostHog request is still in flight.
    expect(pending).toHaveLength(1);
    expect(captured).toHaveLength(0);

    release();
    await Promise.all(pending);
    expect(captured).toEqual([{ distinctId: "u1", environment: "production" }]);
  });

  it("never fails the caller when capture rejects", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const analytics = makeAnalytics({
      capture: async () => {
        throw new Error("posthog down");
      },
      identify: async () => undefined,
    });
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          yield* analytics.capture(
            { name: "account_signed_up", properties: { source: "web" } },
            { distinctId: "u1" },
          );
        }).pipe(Effect.provideService(Analytics, analytics)),
      ),
    ).resolves.toBeUndefined();
  });

  it("derives the environment from the deployment env", () => {
    expect(deploymentEnvironment({})).toBe("development");
    expect(deploymentEnvironment({ SENTRY_ENVIRONMENT: " production " })).toBe("production");
  });
});
