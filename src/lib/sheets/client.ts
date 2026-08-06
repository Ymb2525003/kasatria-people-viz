import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Shape of the Google Sheets `values.get` response.
 *
 * We validate the upstream response rather than trusting it. Google's API is
 * reliable, but "reliable" is not "typed" — an auth failure or a bad range
 * returns a differently-shaped body with HTTP 200 in some cases, and
 * `data.values.map(...)` on a missing field is a runtime crash.
 *
 * `.default([])` is deliberate: Sheets OMITS `values` entirely for an empty
 * range rather than returning an empty array. Without the default, an empty
 * sheet is a crash instead of an empty state.
 */
const sheetsResponseSchema = z.object({
  range: z.string().optional(),
  majorDimension: z.string().optional(),
  values: z.array(z.array(z.string())).default([]),
});

/** Discriminated union so callers must handle failure — no thrown strings. */
export type SheetsResult =
  | { readonly ok: true; readonly rows: readonly (readonly string[])[] }
  | { readonly ok: false; readonly error: SheetsError };

export interface SheetsError {
  readonly kind: "network" | "auth" | "not-found" | "rate-limit" | "malformed" | "unknown";
  /** Safe to show a user. Never contains the API key. */
  readonly message: string;
  readonly status?: number;
}

function classify(status: number): SheetsError["kind"] {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limit";
  return "unknown";
}

function friendlyMessage(kind: SheetsError["kind"]): string {
  switch (kind) {
    case "auth":
      return "The spreadsheet could not be accessed. Check that the API key is valid and the sheet is shared.";
    case "not-found":
      return "The spreadsheet or the requested range was not found.";
    case "rate-limit":
      return "Google's rate limit was reached. Try again shortly.";
    case "network":
      return "Could not reach Google Sheets.";
    case "malformed":
      return "Google Sheets returned an unexpected response.";
    default:
      return "The spreadsheet could not be loaded.";
  }
}

/**
 * Fetches raw rows from the Google Sheet.
 *
 * This runs ONLY on the server. That is the whole point of the BFF: the API
 * key never reaches the browser, so it cannot be lifted from DevTools and
 * used to exhaust the project's quota.
 */
export async function fetchSheetRows(signal?: AbortSignal): Promise<SheetsResult> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      env.GOOGLE_SHEET_ID,
    )}/values/${encodeURIComponent(env.GOOGLE_SHEET_RANGE)}`,
  );
  url.searchParams.set("key", env.GOOGLE_SHEETS_API_KEY);
  // Return every cell as a string; we own all parsing so that behaviour is
  // identical regardless of how a cell happens to be formatted in the sheet.
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");

  let response: Response;
  try {
    response = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(10_000),
      // We run our own TTL cache; Next's fetch cache would be a second,
      // competing caching layer with different invalidation semantics.
      cache: "no-store",
    });
  } catch (cause) {
    const isTimeout = cause instanceof DOMException && cause.name === "TimeoutError";
    return {
      ok: false,
      error: {
        kind: "network",
        message: isTimeout ? "Google Sheets took too long to respond." : friendlyMessage("network"),
      },
    };
  }

  if (!response.ok) {
    const kind = classify(response.status);
    // NOTE: Google's error body can echo the request URL, which contains the
    // API key. We deliberately do not forward it to the client.
    return { ok: false, error: { kind, message: friendlyMessage(kind), status: response.status } };
  }

  const parsed = sheetsResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return { ok: false, error: { kind: "malformed", message: friendlyMessage("malformed") } };
  }

  return { ok: true, rows: parsed.data.values };
}
