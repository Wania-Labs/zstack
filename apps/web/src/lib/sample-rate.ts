/**
 * Parse a 0–1 Sentry sample rate from env. Blank or non-numeric falls back;
 * out-of-range values clamp. `"0"` is a real rate (off), not a fallback trigger.
 */
export function parseSampleRate(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }
  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}
