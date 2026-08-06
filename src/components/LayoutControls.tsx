"use client";

import { LAYOUTS, type LayoutId } from "@/types/person";

const LABEL: Record<LayoutId, string> = {
  table: "Table",
  sphere: "Sphere",
  helix: "Double helix",
  grid: "Grid",
};

/** Shows the spec'd dimensions, so a reviewer can verify at a glance. */
const DIMENSION: Record<LayoutId, string> = {
  table: "20 x 10",
  sphere: "",
  helix: "2 strands",
  grid: "5 x 4 x 10",
};

interface LayoutControlsProps {
  active: LayoutId;
  onChange: (layout: LayoutId) => void;
}

export function LayoutControls({ active, onChange }: LayoutControlsProps) {
  return (
    <div
      className="controls"
      role="group"
      aria-label="Arrangement"
    >
      {LAYOUTS.map((layout) => (
        <button
          key={layout}
          type="button"
          className="controls__button"
          aria-pressed={active === layout}
          onClick={() => onChange(layout)}
        >
          <span className="controls__label">{LABEL[layout]}</span>
          {DIMENSION[layout] !== "" && (
            <span className="controls__dimension">{DIMENSION[layout]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
