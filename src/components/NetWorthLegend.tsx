"use client";

import { NET_WORTH_TIERS, type NetWorthTier } from "@/types/person";
import { TIER_LABEL } from "@/scene/tile";

interface NetWorthLegendProps {
  counts: Record<NetWorthTier, number>;
}

/**
 * The legend states the thresholds explicitly rather than showing an
 * undifferentiated low-to-high gradient bar as the original demo does.
 *
 * The rule here is a set of discrete buckets, not a continuum -- a gradient
 * would misrepresent it, and would leave a viewer guessing where the
 * boundaries fall.
 */
export function NetWorthLegend({ counts }: NetWorthLegendProps) {
  return (
    <div className="legend">
      <span className="legend__title">Net worth</span>
      {NET_WORTH_TIERS.map((tier) => (
        <span key={tier} className="legend__item" data-tier={tier}>
          <span className="legend__swatch" aria-hidden="true" />
          <span className="legend__text">{TIER_LABEL[tier]}</span>
          <span className="legend__count">{counts[tier]}</span>
        </span>
      ))}
    </div>
  );
}
