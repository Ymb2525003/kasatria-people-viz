"use client";

import { useEffect, useRef } from "react";
import { formatNetWorth } from "@/lib/netWorth";
import { TIER_LABEL } from "@/scene/tile";
import type { Person } from "@/types/person";

/**
 * Detail panel shown when a tile is clicked.
 *
 * Implements the accessibility contract a dialog owes the user: focus moves
 * in on open, Escape closes, and focus is restored to where it was. Most
 * submissions ship a div that traps keyboard users.
 */
export function PersonDetail({ person, onClose }: { person: Person; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    /**
     * Click-outside. Bound on `pointerdown` rather than `click` so it fires
     * before the scene's own tile handler -- with `click`, selecting a second
     * tile would close the panel that the new selection just opened.
     */
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target) === false) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // Deferred a tick so the click that opened the panel does not immediately
    // close it.
    const timer = window.setTimeout(
      () => document.addEventListener("pointerdown", onPointerDown),
      0,
    );

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-name"
      data-tier={person.netWorthTier}
    >
      <button ref={closeRef} type="button" className="detail__close" onClick={onClose}>
        Close
      </button>
      <h2 id="detail-name" className="detail__name">
        {person.name}
      </h2>
      <dl className="detail__list">
        <div>
          <dt>Country</dt>
          <dd>{person.countryCode}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{person.age}</dd>
        </div>
        <div>
          <dt>Interest</dt>
          <dd>{person.interest}</dd>
        </div>
        <div>
          <dt>Net worth</dt>
          <dd>
            {formatNetWorth(person.netWorth)}
            <span className="detail__tier">{TIER_LABEL[person.netWorthTier]}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
