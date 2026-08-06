import { describe, expect, it } from "vitest";
import { normalizeRows } from "@/lib/sheets/normalize";

const validRow = [
  "Lee Siew Suan",
  "https://static.kasatria.com/pivot-img/photo/019.jpg",
  "25",
  "CN",
  "Writing",
  "$251,260.80",
];

describe("normalizeRows — happy path", () => {
  it("maps a well-formed row onto the domain type", () => {
    const { people, skipped } = normalizeRows([validRow]);

    expect(skipped).toHaveLength(0);
    expect(people[0]).toEqual({
      id: "row-2",
      name: "Lee Siew Suan",
      photoUrl: "https://static.kasatria.com/pivot-img/photo/019.jpg",
      age: 25,
      countryCode: "CN",
      interest: "Writing",
      netWorth: 251260.8,
      netWorthTier: "high",
    });
  });

  it("numbers rows as they appear in the Sheets UI, accounting for the header", () => {
    // Range starts at A2, so the first data row is sheet row 2 — not 1.
    const { people } = normalizeRows([validRow, validRow]);
    expect(people.map((p) => p.id)).toEqual(["row-2", "row-3"]);
  });
});

describe("normalizeRows — real defects present in the supplied dataset", () => {
  it("strips the U+00A0 non-breaking space found on two names", () => {
    // "Mohd Hanafi Azhar\u00a0" and "Nursyamimi Atiqah\u00a0" ship with a
    // trailing NBSP. String.prototype.trim() does not remove it in every
    // engine, and it renders as a visibly off-centre name.
    const row = [...validRow];
    row[0] = "Mohd Hanafi Azhar\u00a0";

    const { people } = normalizeRows([row]);
    expect(people[0]?.name).toBe("Mohd Hanafi Azhar");
  });

  it("tolerates the padded header format without misreading columns", () => {
    // The CSV header is literally " Net Worth " with surrounding spaces.
    // Reading by position rather than name makes that irrelevant — this test
    // exists to lock that decision in.
    const { people } = normalizeRows([validRow]);
    expect(people[0]?.netWorth).toBe(251260.8);
  });

  it("normalises country codes to uppercase", () => {
    const row = [...validRow];
    row[3] = "my";
    expect(normalizeRows([row]).people[0]?.countryCode).toBe("MY");
  });
});

describe("normalizeRows — partial failure", () => {
  it("keeps good rows when a bad row sits among them", () => {
    const bad = [...validRow];
    bad[5] = "N/A";

    const { people, skipped } = normalizeRows([validRow, bad, validRow]);

    // The defining behaviour: one bad row must not blank the whole page.
    expect(people).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.row).toBe(3);
  });

  it("reports a locatable row number and a human reason", () => {
    const bad = [...validRow];
    bad[0] = "";
    const { skipped } = normalizeRows([bad]);
    expect(skipped[0]).toEqual({ row: 2, reason: "Missing name" });
  });

  it("rejects javascript: and data: photo URLs", () => {
    // The sheet is editable by anyone it is shared with, and this string is
    // written into an <img src>. Treat it as untrusted input.
    for (const hostile of ["javascript:alert(1)", "data:text/html,<script>"]) {
      const row = [...validRow];
      row[1] = hostile;
      const { people, skipped } = normalizeRows([row]);
      expect(people).toHaveLength(0);
      expect(skipped[0]?.reason).toContain("photo URL");
    }
  });

  it("rejects impossible ages rather than rendering them", () => {
    for (const age of ["-4", "999", "abc", "25.5", ""]) {
      const row = [...validRow];
      row[2] = age;
      expect(normalizeRows([row]).people).toHaveLength(0);
    }
  });

  it("survives short rows without throwing", () => {
    // Google Sheets truncates trailing empty cells, so a row can arrive with
    // fewer than 6 entries. noUncheckedIndexedAccess forces this to be handled.
    expect(() => normalizeRows([["Name only"]])).not.toThrow();
    expect(normalizeRows([["Name only"]]).skipped).toHaveLength(1);
  });

  it("returns empty results for an empty sheet", () => {
    expect(normalizeRows([])).toEqual({ people: [], skipped: [] });
  });
});
