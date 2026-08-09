import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

/**
 * Smoke: Vitest pool loads wrangler bindings in workerd.
 * Full /health needs Compose Postgres — keep that out of CI.
 */
describe("worker bindings", () => {
  it("exposes Hyperdrive and auth vars", () => {
    expect(env.HYPERDRIVE).toBeDefined();
    expect(typeof env.HYPERDRIVE.connectionString).toBe("string");
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThan(8);
  });
});
