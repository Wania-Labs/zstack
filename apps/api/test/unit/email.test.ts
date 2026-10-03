import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EmailService,
  emailLiveFromEnv,
  readBentoConfig,
  redactEmailLinks,
  runEmailEffect,
} from "../../src/platform/email/email-service";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Bento config", () => {
  const complete = {
    EMAIL_FROM: "noreply@example.com",
    BENTO_SITE_UUID: "site",
    BENTO_PUBLISHABLE_KEY: "pub",
    BENTO_SECRET_KEY: "secret",
  };

  it("classifies unset, partial, and complete", () => {
    expect(readBentoConfig({}).kind).toBe("unset");
    expect(readBentoConfig(complete).kind).toBe("complete");
    expect(readBentoConfig({ ...complete, BENTO_SECRET_KEY: " " })).toEqual({
      kind: "partial",
      missing: ["BENTO_SECRET_KEY"],
    });
  });

  it("warns loudly when only some Bento vars are set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    emailLiveFromEnv({ EMAIL_FROM: "noreply@example.com", BENTO_SITE_UUID: "site-only" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("partially configured");
    expect(String(warn.mock.calls[0]?.[0])).toContain("BENTO_SECRET_KEY");
  });

  it("stays quiet when Bento is fully unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    emailLiveFromEnv({});
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("console email transport", () => {
  const sendReset = (env: Parameters<typeof emailLiveFromEnv>[0]) =>
    runEmailEffect(
      Effect.gen(function* () {
        const email = yield* EmailService;
        yield* email.sendPasswordResetEmail({
          to: "user@example.com",
          name: "User",
          url: "https://app.example.com/reset-password/tok_secret123?callbackURL=/",
        });
      }),
      emailLiveFromEnv(env),
    );

  function loggedText(info: ReturnType<typeof vi.spyOn>): string {
    const payload = info.mock.calls[0]?.[1] as { text?: string } | undefined;
    return payload?.text ?? "";
  }

  it("redacts links on HTTPS (production-like) stages", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await sendReset({ BETTER_AUTH_URL: "https://app.example.com" });
    expect(loggedText(info)).not.toContain("tok_secret123");
    expect(loggedText(info)).toContain("[link redacted]");
  });

  it("keeps links for local HTTP development", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await sendReset({ BETTER_AUTH_URL: "http://localhost:3000" });
    expect(loggedText(info)).toContain("tok_secret123");
  });

  it("redactEmailLinks strips every URL", () => {
    expect(redactEmailLinks("a http://x/y b https://z/w?t=1 c")).toBe(
      "a [link redacted] b [link redacted] c",
    );
  });
});
