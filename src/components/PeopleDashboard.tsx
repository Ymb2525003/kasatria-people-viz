"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { SceneCanvas, type SceneHandle } from "./SceneCanvas";
import { LayoutControls } from "./LayoutControls";
import { NetWorthLegend } from "./NetWorthLegend";
import { SearchFilter } from "./SearchFilter";
import { PersonDetail } from "./PersonDetail";
import { EmptyState, NoMatchesState } from "./states/StateViews";
import type { LayoutId, NetWorthTier, PeoplePayload, Person } from "@/types/person";

interface PeopleDashboardProps {
  /**
   * Loaded on the server and passed in, so the first paint already has data.
   * No loading spinner on arrival, no client round trip to our own server.
   */
  initialPayload: PeoplePayload;
}

export function PeopleDashboard({ initialPayload }: PeopleDashboardProps) {
  const [payload, setPayload] = useState<PeoplePayload>(initialPayload);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const [layout, setLayout] = useState<LayoutId>("table");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);

  const sceneRef = useRef<SceneHandle>(null);

  const people = payload.people;

  /**
   * Manual refresh against the BFF.
   *
   * The only client-side fetch in the app, and it is user-initiated -- which
   * is why it does not belong in an effect. The sheet is editable, so a
   * reviewer who changes a value and presses Refresh should see it.
   */
  const refresh = useCallback(() => {
    startRefresh(async () => {
      setRefreshError(null);
      try {
        const response = await fetch("/api/people");
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const message =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : "The server returned an unexpected response.";
          setRefreshError(message);
          return;
        }
        setPayload((await response.json()) as PeoplePayload);
      } catch {
        setRefreshError("Could not reach the server.");
      }
    });
  }, []);

  /**
   * Search matching.
   *
   * Normalised to lowercase and stripped of diacritics, so a query matches
   * regardless of how it is typed. Recomputed only when the query or dataset
   * changes -- not on every render, and not once per tile.
   */
  const visibleIds = useMemo(() => {
    const needle = normalise(query);
    if (needle === "") return new Set(people.map((p) => p.id));

    return new Set(
      people
        .filter((person) =>
          [person.name, person.countryCode, person.interest]
            .map(normalise)
            .some((field) => field.includes(needle)),
        )
        .map((person) => person.id),
    );
  }, [people, query]);

  const tierCounts = useMemo(() => {
    const counts: Record<NetWorthTier, number> = { low: 0, mid: 0, high: 0 };
    for (const person of people) counts[person.netWorthTier] += 1;
    return counts;
  }, [people]);

  if (people.length === 0) return <EmptyState />;

  const hasQuery = query.trim() !== "";

  return (
    <div className="dashboard">
      <SceneCanvas
        ref={sceneRef}
        people={people}
        layout={layout}
        visibleIds={visibleIds}
        onSelect={setSelected}
      />

      <header className="dashboard__header">
        <SearchFilter
          value={query}
          matchCount={visibleIds.size}
          totalCount={people.length}
          onChange={setQuery}
        />
        <NetWorthLegend counts={tierCounts} />
      </header>

      <footer className="dashboard__footer">
        <LayoutControls active={layout} onChange={setLayout} />
        {/* Free orbiting has no natural way back — see PeriodicScene.resetView. */}
        <button
          type="button"
          className="reset-view"
          onClick={() => sceneRef.current?.resetView()}
        >
          Reset view
        </button>
      </footer>

      {hasQuery && visibleIds.size === 0 && <NoMatchesState query={query.trim()} />}

      {selected !== null && (
        <PersonDetail person={selected} onClose={() => setSelected(null)} />
      )}

      <div className="dashboard__notice">
        <button
          type="button"
          className="dashboard__refresh"
          onClick={refresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh from sheet"}
        </button>
        {payload.skipped.length > 0 && (
          <span role="status">
            {payload.skipped.length} row
            {payload.skipped.length === 1 ? " was" : "s were"} skipped as unreadable.
          </span>
        )}
        {refreshError !== null && (
          <span role="alert" className="dashboard__notice-error">
            {refreshError}
          </span>
        )}
      </div>
    </div>
  );
}

/** Lowercase and strip diacritics for accent-insensitive matching. */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
