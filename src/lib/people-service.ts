import "server-only";
import { env } from "@/lib/env";
import { TtlCache } from "@/lib/cache";
import { fetchSheetRows, type SheetsError } from "@/lib/sheets/client";
import { normalizeRows } from "@/lib/sheets/normalize";
import type { PeoplePayload } from "@/types/person";

/**
 * The single data-loading path, shared by the server component (initial page
 * render) and the API route (client-side refresh).
 *
 * Having one implementation is the point: two call sites that each fetch and
 * normalise independently will drift, and the drift shows up as the page and
 * a refresh disagreeing about the data.
 *
 * Module scope, so the cache is shared between both call sites and survives
 * across requests within a warm serverless instance.
 */
const cache = new TtlCache<PeoplePayload>(env.SHEETS_CACHE_TTL_MS);

/** Sentinel so a Sheets failure stays typed as it passes through the cache. */
export class SheetsFailure extends Error {
  constructor(readonly detail: SheetsError) {
    super(detail.message);
    this.name = "SheetsFailure";
  }
}

export type LoadPeopleResult =
  | { readonly ok: true; readonly payload: PeoplePayload; readonly cached: boolean }
  | { readonly ok: false; readonly error: SheetsError };

export async function loadPeople(): Promise<LoadPeopleResult> {
  try {
    const { value, cached } = await cache.resolve(async () => {
      const result = await fetchSheetRows();

      if (!result.ok) {
        // Thrown rather than returned, so the cache never stores a failure.
        // Caching an outage would keep the page broken for the full TTL after
        // Google has already recovered.
        throw new SheetsFailure(result.error);
      }

      const { people, skipped } = normalizeRows(result.rows);
      return { people, skipped, fetchedAt: new Date().toISOString() };
    });

    return { ok: true, payload: value, cached };
  } catch (error) {
    if (error instanceof SheetsFailure) {
      return { ok: false, error: error.detail };
    }

    console.error("[loadPeople] Unhandled failure", error);
    return {
      ok: false,
      error: { kind: "unknown", message: "Something went wrong loading the data." },
    };
  }
}
