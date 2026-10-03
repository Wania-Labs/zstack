/** Local dev origins: web :3000, admin :3001, direct API curls :8787. */
const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
];

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function toOrigin(value: string | undefined): URL | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/**
 * Better Auth `trustedOrigins`: the web origin (`BETTER_AUTH_URL`), the staff
 * console origin (`ADMIN_URL`), and — only when `BETTER_AUTH_URL` is a plain
 * HTTP localhost origin — the fixed local dev ports. Deployed (HTTPS) stages
 * never trust localhost.
 */
export function resolveTrustedOrigins(env: {
  BETTER_AUTH_URL: string;
  ADMIN_URL?: string;
}): string[] {
  const origins = new Set<string>();
  const base = toOrigin(env.BETTER_AUTH_URL);
  if (base) {
    origins.add(base.origin);
  }
  const admin = toOrigin(env.ADMIN_URL);
  if (admin) {
    origins.add(admin.origin);
  }

  if (base && base.protocol === "http:" && LOCAL_HOSTNAMES.has(base.hostname)) {
    for (const origin of LOCAL_DEV_ORIGINS) {
      origins.add(origin);
    }
  }

  return [...origins];
}
