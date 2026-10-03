import { describe, expect, it } from "vitest";

import { resolveTrustedOrigins } from "../../src/modules/auth/trusted-origins";

describe("resolveTrustedOrigins", () => {
  it("trusts web + admin and local dev ports on http://localhost", () => {
    const origins = resolveTrustedOrigins({
      BETTER_AUTH_URL: "http://localhost:3000",
      ADMIN_URL: "http://localhost:3001",
    });
    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://localhost:3001");
    expect(origins).toContain("http://127.0.0.1:3001");
    expect(origins).toContain("http://127.0.0.1:8787");
  });

  it("never trusts localhost when deployed over https", () => {
    const origins = resolveTrustedOrigins({
      BETTER_AUTH_URL: "https://app.example.com/",
      ADMIN_URL: "https://admin.example.com/some/path",
    });
    expect(origins).toEqual(["https://app.example.com", "https://admin.example.com"]);
  });

  it("omits an empty or invalid ADMIN_URL", () => {
    expect(
      resolveTrustedOrigins({ BETTER_AUTH_URL: "https://app.example.com", ADMIN_URL: "" }),
    ).toEqual(["https://app.example.com"]);
    expect(
      resolveTrustedOrigins({ BETTER_AUTH_URL: "https://app.example.com", ADMIN_URL: "not a url" }),
    ).toEqual(["https://app.example.com"]);
  });

  it("does not add dev ports for a non-local http origin", () => {
    expect(resolveTrustedOrigins({ BETTER_AUTH_URL: "http://staging.internal:3000" })).toEqual([
      "http://staging.internal:3000",
    ]);
  });
});
