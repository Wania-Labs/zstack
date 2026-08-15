import { describe, expect, it, vi } from "vitest";

import {
  analyticsClientFromEnv,
  createNoopAnalytics,
  createPostHogAnalytics,
} from "@zstack/analytics";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fetchJsonBody(init: unknown): Record<string, unknown> {
  if (!isRecord(init) || typeof init.body !== "string") {
    throw new Error("missing fetch body");
  }
  const parsed: unknown = JSON.parse(init.body);
  if (!isRecord(parsed)) {
    throw new Error("fetch body is not an object");
  }
  return parsed;
}

describe("createNoopAnalytics", () => {
  it("swallows capture and identify", async () => {
    const client = createNoopAnalytics();
    await expect(
      client.capture(
        { name: "account_signed_up", properties: { source: "web" } },
        { distinctId: "user_1" },
      ),
    ).resolves.toBeUndefined();
    await expect(client.identify({ distinctId: "user_1" })).resolves.toBeUndefined();
  });
});

describe("analyticsClientFromEnv", () => {
  it("uses the no-op client when the key is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = analyticsClientFromEnv({});
    await client.capture(
      { name: "account_signed_up", properties: { source: "web" } },
      { distinctId: "user_1" },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("createPostHogAnalytics", () => {
  it("posts named events and skips staff", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPostHogAnalytics({
      apiKey: "phc_test",
      host: "https://us.i.posthog.com",
    });

    await client.capture(
      { name: "account_signed_up", properties: { source: "web" } },
      { distinctId: "user_1", environment: "test" },
    );
    await client.capture(
      { name: "ai_generation_completed", properties: { capability: "chat.fast", route: "fake" } },
      { distinctId: "staff_1", isStaff: true, environment: "test" },
    );
    await client.capture(
      { name: "page_viewed", properties: { path: "/app" } },
      { distinctId: "user_1", environment: "test" },
    );
    await client.identify({ distinctId: "user_1", organizationId: "org_1", anonymousId: "anon_1" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const captureCall = fetchMock.mock.calls[0];
    const pageViewCall = fetchMock.mock.calls[1];
    const identifyCall = fetchMock.mock.calls[2];
    if (!captureCall || !pageViewCall || !identifyCall) {
      throw new Error("expected capture, pageview, and identify fetch calls");
    }
    expect(captureCall[0]).toBe("https://us.i.posthog.com/capture/");
    expect(fetchJsonBody(captureCall[1]).event).toBe("account_signed_up");
    expect(fetchJsonBody(pageViewCall[1]).event).toBe("$pageview");
    const identifyBody = fetchJsonBody(identifyCall[1]);
    expect(identifyBody.event).toBe("$identify");
    const identifyProperties = identifyBody.properties;
    expect(identifyProperties).toMatchObject({ $anon_distinct_id: "anon_1" });

    vi.unstubAllGlobals();
  });
});
