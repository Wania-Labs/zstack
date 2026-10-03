/**
 * Serialize JSON the way the clone's formatter (oxfmt, Prettier-compatible)
 * prints it, so files the CLI writes pass `pnpm format:check` untouched.
 *
 * - Non-empty objects are always expanded, one key per line. (Prettier keeps
 *   objects expanded when the source has a newline after `{`.)
 * - Arrays of primitives stay on one line when that line fits the print width;
 *   otherwise, and for arrays holding objects/arrays, one element per line.
 *
 * `JSON.stringify(value, null, 2)` always expands arrays, which oxfmt collapses.
 * Exception: oxfmt prints `package.json` with sort-package-json, which expands
 * every array, so keep `JSON.stringify(value, null, 2)` for manifests.
 */
export const PRINT_WIDTH = 100;

const INDENT = "  ";

export function formatJson(value: unknown): string {
  return `${printValue(value, 0, 0, false)}\n`;
}

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

function printValue(value: unknown, depth: number, prefixWidth: number, trailing: boolean): string {
  if (isPrimitive(value)) {
    return JSON.stringify(value) ?? "null";
  }

  const pad = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    if (value.every(isPrimitive)) {
      const inline = `[${value.map((item) => JSON.stringify(item) ?? "null").join(", ")}]`;
      if (prefixWidth + inline.length + (trailing ? 1 : 0) <= PRINT_WIDTH) {
        return inline;
      }
    }
    const items = value.map(
      (item, index) =>
        `${inner}${printValue(item, depth + 1, inner.length, index < value.length - 1)}`,
    );
    return `[\n${items.join(",\n")}\n${pad}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, item]) => item !== undefined,
  );
  if (entries.length === 0) {
    return "{}";
  }
  const lines = entries.map(([key, item], index) => {
    const head = `${inner}${JSON.stringify(key)}: `;
    return `${head}${printValue(item, depth + 1, head.length, index < entries.length - 1)}`;
  });
  return `{\n${lines.join(",\n")}\n${pad}}`;
}
