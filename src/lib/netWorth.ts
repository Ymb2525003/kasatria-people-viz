import type { NetWorthTier } from "@/types/person";

/**
 * Thresholds, in USD.
 *
 * SPEC AMBIGUITY (documented, not silently guessed):
 * The brief states "Red < $100K, Orange > $100K, Green > $200K", which
 * leaves *exactly* 100,000 and *exactly* 200,000 undefined — they belong
 * to no stated bucket. We close the gap upward so that the ranges are
 * contiguous and total:
 *
 *   low  : netWorth <  100_000
 *   mid  : 100_000 <= netWorth < 200_000
 *   high : netWorth >= 200_000
 *
 * Contiguous-and-total matters because the alternative (leaving the
 * boundaries undefined) means a person at exactly $200,000.00 renders
 * with no colour at all.
 */
export const NET_WORTH_THRESHOLDS = {
  mid: 100_000,
  high: 200_000,
} as const;

/**
 * Buckets a numeric net worth into its colour tier.
 * Pure, total, and exhaustively tested — this is the rule the entire
 * visual encoding rests on.
 */
export function toNetWorthTier(netWorth: number): NetWorthTier {
  if (!Number.isFinite(netWorth)) {
    throw new RangeError(`netWorth must be finite, received: ${netWorth}`);
  }
  if (netWorth >= NET_WORTH_THRESHOLDS.high) return "high";
  if (netWorth >= NET_WORTH_THRESHOLDS.mid) return "mid";
  return "low";
}

/**
 * Parses the spreadsheet's currency strings into a number.
 *
 * Real values in the supplied data look like: `"$251,260.80"`.
 * Because the sheet is human-editable and shared, we must also survive
 * the variants a person will inevitably introduce by hand:
 *
 *   "$60,393.60"      standard
 *   "60393.6"         someone stripped the formatting
 *   "$1,234"          no decimals
 *   " $1,234.00 "     stray whitespace (the CSV header itself has some)
 *   "$1,234.00 USD"   trailing currency code
 *   "-$500"           negative, leading sign
 *   "($500)"          negative, accountant's parentheses
 *   "US$1,234"        currency prefix
 *
 * Returns `null` rather than NaN or 0 for unparseable input. `null` forces
 * the caller to make an explicit decision; a silent 0 would quietly render
 * a person as red and look like real data.
 */
export function parseNetWorth(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Accountant's negative: (500) === -500
  const isParenNegative = /^\(.*\)$/.test(trimmed);
  const unwrapped = isParenNegative ? trimmed.slice(1, -1) : trimmed;

  // Strip everything that is not a digit, separator, or sign.
  const cleaned = unwrapped.replace(/[^0-9.,\-+]/g, "");
  if (cleaned === "") return null;

  const isNegative = isParenNegative || cleaned.startsWith("-");

  // Remove thousands separators and any sign; keep the decimal point.
  const digitsOnly = cleaned.replace(/[,\-+]/g, "");
  if (digitsOnly === "" || digitsOnly === ".") return null;

  // Reject multiple decimal points ("1.2.3") — that is corrupt, not a format.
  if ((digitsOnly.match(/\./g) ?? []).length > 1) return null;

  const value = Number(digitsOnly);
  if (!Number.isFinite(value)) return null;

  return isNegative ? -value : value;
}

/** Display formatting. Kept beside the parser so the round-trip is obvious. */
export function formatNetWorth(netWorth: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(netWorth);
}
