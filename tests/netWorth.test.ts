import { describe, expect, it } from "vitest";
import { formatNetWorth, parseNetWorth, toNetWorthTier } from "@/lib/netWorth";

describe("parseNetWorth", () => {
  it("parses the exact format used in the supplied dataset", () => {
    expect(parseNetWorth("$251,260.80")).toBe(251260.8);
    expect(parseNetWorth("$60,393.60")).toBe(60393.6);
    expect(parseNetWorth("$212,140.80")).toBe(212140.8);
  });

  it("survives the variants a human editor will introduce", () => {
    expect(parseNetWorth("60393.6")).toBe(60393.6);
    expect(parseNetWorth("$1,234")).toBe(1234);
    expect(parseNetWorth("  $1,234.00  ")).toBe(1234);
    expect(parseNetWorth("$1,234.00 USD")).toBe(1234);
    expect(parseNetWorth("US$1,234")).toBe(1234);
    expect(parseNetWorth("1,000,000")).toBe(1_000_000);
  });

  it("handles both negative conventions", () => {
    expect(parseNetWorth("-$500")).toBe(-500);
    expect(parseNetWorth("($500)")).toBe(-500);
  });

  it("returns null — never 0 — for unusable input", () => {
    // A silent 0 would render as a legitimate-looking red tile.
    expect(parseNetWorth("")).toBeNull();
    expect(parseNetWorth("   ")).toBeNull();
    expect(parseNetWorth("N/A")).toBeNull();
    expect(parseNetWorth("unknown")).toBeNull();
    expect(parseNetWorth("$")).toBeNull();
    expect(parseNetWorth("1.2.3")).toBeNull();
  });

  it("parses zero as zero, distinctly from null", () => {
    expect(parseNetWorth("$0")).toBe(0);
    expect(parseNetWorth("0")).toBe(0);
  });
});

describe("toNetWorthTier — the colour rule", () => {
  it("assigns red/low below 100K", () => {
    expect(toNetWorthTier(0)).toBe("low");
    expect(toNetWorthTier(60_393.6)).toBe("low");
    expect(toNetWorthTier(99_999.99)).toBe("low");
  });

  it("assigns orange/mid between 100K and 200K", () => {
    expect(toNetWorthTier(100_000.01)).toBe("mid");
    expect(toNetWorthTier(150_000)).toBe("mid");
    expect(toNetWorthTier(199_999.99)).toBe("mid");
  });

  it("assigns green/high at or above 200K", () => {
    expect(toNetWorthTier(200_000.01)).toBe("high");
    expect(toNetWorthTier(251_260.8)).toBe("high");
  });

  it("resolves the boundaries the spec leaves undefined", () => {
    // The brief says "< 100K", "> 100K", "> 200K" — the exact boundary
    // values belong to no stated bucket. Documented resolution: round up.
    expect(toNetWorthTier(100_000)).toBe("mid");
    expect(toNetWorthTier(200_000)).toBe("high");
  });

  it("handles negative net worth without falling through", () => {
    expect(toNetWorthTier(-5_000)).toBe("low");
  });

  it("rejects non-finite input loudly rather than mis-bucketing", () => {
    expect(() => toNetWorthTier(Number.NaN)).toThrow(RangeError);
    expect(() => toNetWorthTier(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatNetWorth", () => {
  it("renders a readable currency string", () => {
    expect(formatNetWorth(251260.8)).toBe("$251,261");
    expect(formatNetWorth(0)).toBe("$0");
  });
});
