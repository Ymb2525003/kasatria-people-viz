/**
 * Domain vocabulary for the application.
 *
 * Everything downstream — the BFF route, the scene layer, the React shell,
 * the tests — speaks in these types. There is no second, competing shape
 * for "a person" anywhere in the codebase.
 */

export const NET_WORTH_TIERS = ["low", "mid", "high"] as const;
export type NetWorthTier = (typeof NET_WORTH_TIERS)[number];

export const LAYOUTS = ["table", "sphere", "helix", "grid"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

/**
 * A single person, fully normalized.
 *
 * Invariants guaranteed by the ingestion boundary (src/lib/sheets):
 *  - `netWorth` is a finite number. The raw "$251,260.80" string is parsed
 *    exactly once, on the server, and never re-parsed downstream.
 *  - `netWorthTier` is already derived, so the tile renderer and the legend
 *    can never disagree about which bucket a person falls into.
 *  - `photoUrl` is a syntactically valid http(s) URL. It is NOT guaranteed
 *    to resolve — the client still needs an onerror fallback.
 */
export interface Person {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string;
  readonly age: number;
  readonly countryCode: string;
  readonly interest: string;
  readonly netWorth: number;
  readonly netWorthTier: NetWorthTier;
}

/**
 * What the BFF returns.
 *
 * `skipped` is deliberately part of the success contract rather than an
 * error: one malformed row in a shared, human-editable spreadsheet must
 * not blank out the other 199 people. We degrade, and we stay honest
 * about having degraded.
 */
export interface PeoplePayload {
  readonly people: readonly Person[];
  readonly skipped: readonly RowIssue[];
  readonly fetchedAt: string;
}

export interface RowIssue {
  /** 1-based row number as it appears in the Google Sheet UI, for debuggability. */
  readonly row: number;
  readonly reason: string;
}
