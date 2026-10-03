import type { RequestContext } from "../../http/context";

/** R2 rejects keys longer than 1024 bytes; keep the same ceiling for the fake. */
export const MAX_OBJECT_KEY_LENGTH = 1024;

/**
 * Key prefixes the caller may read and write. Objects are tenant-scoped on the
 * server: `org/<activeOrganizationId>/…` for the active (membership-checked)
 * organization and `user/<effectiveUserId>/…` for the caller's own objects.
 */
export function objectKeyPrefixes(request: RequestContext): string[] {
  const prefixes: string[] = [];
  if (request.organizationId) {
    prefixes.push(`org/${request.organizationId}/`);
  }
  if (request.effectiveUserId) {
    prefixes.push(`user/${request.effectiveUserId}/`);
  }
  return prefixes;
}

function hasControlOrBackslash(key: string): boolean {
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    if (code < 0x20 || code === 0x7f || code === 0x5c) {
      return true;
    }
  }
  return false;
}

/**
 * Keys are opaque to R2, but we still reject shapes that would make the prefix
 * check ambiguous (empty, `.`/`..` segments, control characters, backslashes).
 */
export function isWellFormedObjectKey(key: string): boolean {
  if (key.length === 0 || key.length > MAX_OBJECT_KEY_LENGTH || hasControlOrBackslash(key)) {
    return false;
  }
  return key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export type ObjectKeyDecision = "allowed" | "invalid" | "forbidden";

export function authorizeObjectKey(key: string, request: RequestContext): ObjectKeyDecision {
  if (!isWellFormedObjectKey(key)) {
    return "invalid";
  }
  const allowed = objectKeyPrefixes(request).some(
    (prefix) => key.startsWith(prefix) && key.length > prefix.length,
  );
  return allowed ? "allowed" : "forbidden";
}
