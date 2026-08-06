/**
 * A minimal single-value TTL cache.
 *
 * WHY NOT A DATABASE: the Google Sheet is the single source of truth and
 * holds 200 rows. Introducing Postgres would create a synchronisation
 * problem that does not currently exist, plus migrations, plus a deploy
 * dependency -- all to cache data that fits in memory. That is
 * resume-driven development, and a reviewer will read it as such.
 *
 * WHY CACHE AT ALL: without it, every page load hits the Sheets API. Google
 * enforces per-minute read quotas; a reviewer refreshing repeatedly could
 * trip them and see a broken page. The TTL bounds staleness to a value we
 * choose.
 *
 * Serverless caveat, stated honestly: each Vercel instance holds its own
 * copy, so this reduces API calls rather than guaranteeing one call per TTL
 * globally. For this workload that is the correct trade -- a shared cache
 * would mean adding Redis, i.e. the same over-engineering as above.
 */
export class TtlCache<T> {
  private entry: { value: T; expiresAt: number } | null = null;
  /** De-duplicates concurrent misses so N simultaneous requests make 1 call. */
  private inFlight: Promise<T> | null = null;

  constructor(private readonly ttlMs: number) {}

  async resolve(load: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const now = Date.now();

    if (this.entry !== null && this.entry.expiresAt > now) {
      return { value: this.entry.value, cached: true };
    }

    // Thundering-herd guard: a cold start receiving several concurrent
    // requests would otherwise fire several identical upstream calls.
    if (this.inFlight !== null) {
      return { value: await this.inFlight, cached: false };
    }

    this.inFlight = load()
      .then((value) => {
        this.entry = { value, expiresAt: Date.now() + this.ttlMs };
        return value;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return { value: await this.inFlight, cached: false };
  }

  invalidate(): void {
    this.entry = null;
  }
}
