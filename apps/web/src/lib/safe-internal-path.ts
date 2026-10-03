// C0 controls + DEL. Browsers strip tab/CR/LF from URLs, so `/\t/evil.com`
// navigates to `//evil.com`.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const PROBE_ORIGIN = "http://internal.invalid";

function isUnsafe(path: string): boolean {
  return (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    CONTROL_CHARS.test(path) ||
    new URL(path, PROBE_ORIGIN).origin !== PROBE_ORIGIN
  );
}

/**
 * Accept only same-origin absolute paths for post-auth redirects. Rejects
 * protocol-relative (`//host`), backslash, and control-character tricks, in
 * raw or percent-decoded form (`/%09/evil.com`, `/%2F/evil.com`), and anything
 * the WHATWG URL parser resolves to another origin.
 */
export function safeInternalPath(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    if (isUnsafe(value) || isUnsafe(decodeURIComponent(value))) {
      return undefined;
    }
  } catch {
    // Malformed percent-encoding or an unparsable URL.
    return undefined;
  }

  return value;
}
