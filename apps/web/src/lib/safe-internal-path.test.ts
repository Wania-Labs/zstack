import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-internal-path";

describe("safeInternalPath", () => {
  it.each([
    "/",
    "/app",
    "/t/acme",
    "/t/acme/members?tab=invites#top",
    "/onboarding?next=%2Ft%2Facme",
  ])("accepts same-origin path %s", (value) => {
    expect(safeInternalPath(value)).toBe(value);
  });

  it.each([
    ["non-string", 42],
    ["undefined", undefined],
    ["empty", ""],
    ["relative", "app"],
    ["absolute URL", "https://evil.com"],
    ["javascript URL", "javascript:alert(1)"],
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["raw tab", "/\t/evil.com"],
    ["raw newline", "/\n/evil.com"],
    ["raw NUL", "/\u0000/evil.com"],
    ["encoded tab", "/%09/evil.com"],
    ["encoded newline", "/%0a/evil.com"],
    ["encoded CR", "/%0D/evil.com"],
    ["encoded slash", "/%2F/evil.com"],
    ["encoded backslash", "/%5C/evil.com"],
    ["malformed encoding", "/%E0%A4%A"],
  ])("rejects %s", (_label, value) => {
    expect(safeInternalPath(value)).toBeUndefined();
  });
});
