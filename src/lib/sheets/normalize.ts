import { parseNetWorth, toNetWorthTier } from "@/lib/netWorth";
import type { Person, RowIssue } from "@/types/person";

/**
 * Column order in the sheet. We read by POSITION, not by header name.
 *
 * Why: the supplied CSV's header is literally `" Net Worth "` — with a
 * leading AND trailing space. Any header-name lookup silently returns
 * undefined and every tile renders red. Position is also stable if someone
 * renames a header while editing the shared sheet.
 */
const COLUMN = {
  name: 0,
  photo: 1,
  age: 2,
  country: 3,
  interest: 4,
  netWorth: 5,
} as const;

/** Leading rows skipped by the configured range (the header row). */
const HEADER_OFFSET = 1;

/**
 * Trims ASCII whitespace AND the Unicode separators that `.trim()` misses
 * in some engines.
 *
 * This is not hypothetical: two names in the supplied dataset end with
 * U+00A0 (non-breaking space) — "Mohd Hanafi Azhar\u00a0" and
 * "Nursyamimi Atiqah\u00a0". Left in, they produce a visibly off-centre
 * name in the tile and break exact-match search.
 */
function clean(value: string | undefined): string {
  return (value ?? "").replace(/^[\s\u00a0\u200b\ufeff]+|[\s\u00a0\u200b\ufeff]+$/g, "");
}

function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // http(s) only. Blocks `javascript:` and `data:` URLs — the sheet is
    // editable by everyone it is shared with, so its contents are untrusted
    // input, and this string ends up in an <img src>.
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export interface NormalizeResult {
  readonly people: readonly Person[];
  readonly skipped: readonly RowIssue[];
}

/**
 * Converts raw sheet rows into validated domain objects.
 *
 * PARTIAL-FAILURE STRATEGY: one malformed row must never blank out the other
 * 199 people. The sheet is shared and human-editable, so bad data is a matter
 * of when, not if. Invalid rows are collected and reported; valid rows still
 * render. The alternative — Zod-parsing the whole array and throwing — turns
 * one typo into a fully broken page.
 */
export function normalizeRows(rows: readonly (readonly string[])[]): NormalizeResult {
  const people: Person[] = [];
  const skipped: RowIssue[] = [];

  rows.forEach((row, index) => {
    // 1-based, matching what the user sees in the Google Sheets UI, so a
    // reported issue can be located instantly.
    const sheetRow = index + 1 + HEADER_OFFSET;

    const name = clean(row[COLUMN.name]);
    const photoUrl = clean(row[COLUMN.photo]);
    const rawAge = clean(row[COLUMN.age]);
    const countryCode = clean(row[COLUMN.country]).toUpperCase();
    const interest = clean(row[COLUMN.interest]);
    const rawNetWorth = clean(row[COLUMN.netWorth]);

    if (name === "") {
      skipped.push({ row: sheetRow, reason: "Missing name" });
      return;
    }

    const netWorth = parseNetWorth(rawNetWorth);
    if (netWorth === null) {
      skipped.push({ row: sheetRow, reason: `Unreadable net worth: "${rawNetWorth}"` });
      return;
    }

    // `Number("")` is 0, not NaN — so an empty age cell would silently become
    // a person aged 0 and render as real data. The explicit emptiness check
    // must come first.
    const age = rawAge === "" ? Number.NaN : Number(rawAge);
    if (!Number.isInteger(age) || age < 0 || age > 150) {
      skipped.push({ row: sheetRow, reason: `Invalid age: "${rawAge}"` });
      return;
    }

    if (!isSafeImageUrl(photoUrl)) {
      skipped.push({ row: sheetRow, reason: "Missing or unsafe photo URL" });
      return;
    }

    people.push({
      // Row-derived id: stable across refetches, unlike an array index that
      // shifts the moment someone inserts a row above.
      id: `row-${sheetRow}`,
      name,
      photoUrl,
      age,
      countryCode,
      interest,
      netWorth,
      netWorthTier: toNetWorthTier(netWorth),
    });
  });

  return { people, skipped };
}
