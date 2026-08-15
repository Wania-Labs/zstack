import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  FeatureFlags,
  featureFlagsLiveFromEnv,
  makeFakeFeatureFlagsLive,
  runFeatureFlagsEffect,
} from "../../src/platform/flags/feature-flags";

const sampleContext = {
  targetingKey: "org_1:user_1",
  organizationId: "org_1",
  userId: "user_1",
  environment: "local",
} as const;

describe("FakeFeatureFlagsLive", () => {
  it("returns the caller default when the key is missing", async () => {
    const live = makeFakeFeatureFlagsLive();
    await runFeatureFlagsEffect(
      Effect.gen(function* () {
        const flags = yield* FeatureFlags;
        const ready = yield* flags.boolean({
          key: "missing.ready",
          defaultValue: false,
        });
        expect(ready).toEqual({ value: false, reason: "default" });

        const label = yield* flags.string({
          key: "missing.label",
          defaultValue: "off",
        });
        expect(label).toEqual({ value: "off", reason: "default" });

        const limit = yield* flags.number({
          key: "missing.limit",
          defaultValue: 0,
        });
        expect(limit).toEqual({ value: 0, reason: "default" });
      }),
      live,
    );
  });

  it("returns the mapped override when the key is present", async () => {
    const live = makeFakeFeatureFlagsLive({
      "example.ready": true,
      "example.label": "beta",
      "example.limit": 3,
    });
    await runFeatureFlagsEffect(
      Effect.gen(function* () {
        const flags = yield* FeatureFlags;
        expect(
          yield* flags.boolean({
            key: "example.ready",
            defaultValue: false,
          }),
        ).toEqual({ value: true, reason: "static" });
        expect(
          yield* flags.string({
            key: "example.label",
            defaultValue: "ga",
          }),
        ).toEqual({ value: "beta", reason: "static" });
        expect(
          yield* flags.number({
            key: "example.limit",
            defaultValue: 1,
          }),
        ).toEqual({ value: 3, reason: "static" });
      }),
      live,
    );
  });

  it("accepts evaluation context without requiring it", async () => {
    const live = makeFakeFeatureFlagsLive({
      "example.ready": true,
    });
    await runFeatureFlagsEffect(
      Effect.gen(function* () {
        const flags = yield* FeatureFlags;
        const withContext = yield* flags.boolean({
          key: "example.ready",
          defaultValue: false,
          context: sampleContext,
        });
        expect(withContext).toEqual({ value: true, reason: "static" });

        const missingWithContext = yield* flags.boolean({
          key: "missing.ready",
          defaultValue: false,
          context: sampleContext,
        });
        expect(missingWithContext).toEqual({ value: false, reason: "default" });
      }),
      live,
    );
  });

  it("returns the default with reason error when the override type does not match", async () => {
    const live = makeFakeFeatureFlagsLive({
      "example.ready": "yes",
    });
    await runFeatureFlagsEffect(
      Effect.gen(function* () {
        const flags = yield* FeatureFlags;
        const ready = yield* flags.boolean({
          key: "example.ready",
          defaultValue: false,
        });
        expect(ready).toEqual({ value: false, reason: "error" });
      }),
      live,
    );
  });
});

describe("featureFlagsLiveFromEnv", () => {
  it("keeps the starter default when no flag env is set", async () => {
    await runFeatureFlagsEffect(
      Effect.gen(function* () {
        const flags = yield* FeatureFlags;
        const ready = yield* flags.boolean({
          key: "example.ready",
          defaultValue: false,
        });
        expect(ready).toEqual({ value: true, reason: "static" });
      }),
      featureFlagsLiveFromEnv({}),
    );
  });

  it("overlays FEATURE_FLAG_* bindings", async () => {
    await runFeatureFlagsEffect(
      Effect.gen(function* () {
        const flags = yield* FeatureFlags;
        expect(
          yield* flags.boolean({
            key: "example.ready",
            defaultValue: true,
          }),
        ).toEqual({ value: false, reason: "static" });
        expect(
          yield* flags.number({
            key: "example.limit",
            defaultValue: 0,
          }),
        ).toEqual({ value: 3, reason: "static" });
      }),
      featureFlagsLiveFromEnv({
        FEATURE_FLAG_EXAMPLE_READY: "false",
        FEATURE_FLAG_EXAMPLE_LIMIT: "3",
      }),
    );
  });
});
