import { describe, expect, it } from "vitest";

import { parseSampleRate } from "./sample-rate";

describe("parseSampleRate", () => {
  it("honors 0 instead of falling back", () => {
    expect(parseSampleRate("0", 0.1)).toBe(0);
  });

  it("falls back on blank or non-numeric input", () => {
    expect(parseSampleRate(undefined, 0.1)).toBe(0.1);
    expect(parseSampleRate("  ", 0.1)).toBe(0.1);
    expect(parseSampleRate("all", 0.1)).toBe(0.1);
  });

  it("clamps out-of-range values", () => {
    expect(parseSampleRate("2", 0.1)).toBe(1);
    expect(parseSampleRate("-1", 0.1)).toBe(0);
    expect(parseSampleRate("0.25", 0.1)).toBe(0.25);
  });
});
