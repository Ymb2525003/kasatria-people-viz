import { describe, expect, it } from "vitest";
import { tableLayout } from "@/scene/layouts/table";
import { gridLayout } from "@/scene/layouts/grid";
import { doubleHelixLayout } from "@/scene/layouts/doubleHelix";
import { sphereLayout } from "@/scene/layouts/sphere";
import { GRID_LAYOUT, HELIX_LAYOUT, SPHERE_LAYOUT, TABLE_LAYOUT } from "@/scene/layouts/types";

const DATASET_SIZE = 200;

/** Floating point comparisons need a tolerance; positions are large so 1e-6 is generous. */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe("table layout — spec: exactly 20 x 10", () => {
  const placements = tableLayout(DATASET_SIZE);

  it("emits one placement per person", () => {
    expect(placements).toHaveLength(DATASET_SIZE);
  });

  it("occupies exactly 20 distinct columns", () => {
    const columns = new Set(placements.map((p) => p.x));
    expect(columns.size).toBe(20);
  });

  it("occupies exactly 10 distinct rows", () => {
    const rows = new Set(placements.map((p) => p.y));
    expect(rows.size).toBe(10);
  });

  it("fills row-major: the first 20 tiles share one row", () => {
    const firstRowY = placements.slice(0, 20).map((p) => p.y);
    expect(new Set(firstRowY).size).toBe(1);
    // ...and tile 20 starts a new row.
    expect(placements[20]!.y).not.toBe(placements[19]!.y);
  });

  it("is centred on the origin", () => {
    const xs = placements.map((p) => p.x);
    const ys = placements.map((p) => p.y);
    expect(near(Math.min(...xs), -Math.max(...xs))).toBe(true);
    expect(near(Math.min(...ys), -Math.max(...ys))).toBe(true);
  });

  it("is planar — table is a flat arrangement", () => {
    expect(placements.every((p) => p.z === 0)).toBe(true);
  });

  it("spaces columns by exactly the configured pitch", () => {
    expect(near(placements[1]!.x - placements[0]!.x, TABLE_LAYOUT.spacingX)).toBe(true);
  });
});

describe("grid layout — spec: exactly 5 x 4 x 10", () => {
  const placements = gridLayout(DATASET_SIZE);

  it("emits one placement per person", () => {
    expect(placements).toHaveLength(DATASET_SIZE);
  });

  it("is 5 wide", () => {
    expect(new Set(placements.map((p) => p.x)).size).toBe(5);
  });

  it("is 4 tall", () => {
    expect(new Set(placements.map((p) => p.y)).size).toBe(4);
  });

  it("is 10 deep", () => {
    expect(new Set(placements.map((p) => p.z)).size).toBe(10);
  });

  it("places exactly 20 tiles in every layer", () => {
    const byLayer = new Map<number, number>();
    for (const p of placements) {
      byLayer.set(p.z, (byLayer.get(p.z) ?? 0) + 1);
    }
    expect([...byLayer.values()].every((n) => n === GRID_LAYOUT.columns * GRID_LAYOUT.rows)).toBe(
      true,
    );
  });

  it("every (x, y, z) coordinate is unique — no two tiles overlap", () => {
    const keys = new Set(placements.map((p) => `${p.x}|${p.y}|${p.z}`));
    expect(keys.size).toBe(DATASET_SIZE);
  });

  it("advances to a new layer only after 20 tiles, not 25", () => {
    // Guards the specific off-by-one the original demo's `floor(i / 25)` invites.
    expect(placements[19]!.z).toBe(placements[0]!.z);
    expect(placements[20]!.z).not.toBe(placements[19]!.z);
  });
});

describe("double helix layout — spec: double, not single", () => {
  const placements = doubleHelixLayout(DATASET_SIZE);

  it("emits one placement per person", () => {
    expect(placements).toHaveLength(DATASET_SIZE);
  });

  it("splits the dataset evenly across two strands", () => {
    const strandA = placements.filter((_, i) => i % 2 === 0);
    const strandB = placements.filter((_, i) => i % 2 === 1);
    expect(strandA).toHaveLength(100);
    expect(strandB).toHaveLength(100);
  });

  it("places paired tiles at the same height", () => {
    // The defining property of a double helix: two strands rising in lockstep.
    for (let i = 0; i < DATASET_SIZE; i += 2) {
      expect(near(placements[i]!.y, placements[i + 1]!.y)).toBe(true);
    }
  });

  it("places paired tiles diametrically opposite each other", () => {
    // 180 degrees out of phase => x and z both negate.
    for (let i = 0; i < DATASET_SIZE; i += 2) {
      const a = placements[i]!;
      const b = placements[i + 1]!;
      expect(near(a.x, -b.x)).toBe(true);
      expect(near(a.z, -b.z)).toBe(true);
    }
  });

  it("keeps every tile on the cylinder surface", () => {
    for (const p of placements) {
      const r = Math.hypot(p.x, p.z);
      expect(near(r, HELIX_LAYOUT.radius)).toBe(true);
    }
  });

  it("descends monotonically within a strand", () => {
    for (let i = 2; i < DATASET_SIZE; i += 2) {
      expect(placements[i]!.y).toBeLessThan(placements[i - 2]!.y);
    }
  });

  it("is centred vertically on the origin", () => {
    const ys = placements.map((p) => p.y);
    expect(near(Math.min(...ys), -Math.max(...ys))).toBe(true);
  });

  it("handles an odd count without dropping a tile", () => {
    expect(doubleHelixLayout(199)).toHaveLength(199);
  });
});

describe("sphere layout", () => {
  const placements = sphereLayout(DATASET_SIZE);

  it("emits one placement per person", () => {
    expect(placements).toHaveLength(DATASET_SIZE);
  });

  it("places every tile on the sphere surface", () => {
    for (const p of placements) {
      const r = Math.hypot(p.x, p.y, p.z);
      expect(near(r, SPHERE_LAYOUT.radius)).toBe(true);
    }
  });

  it("gives every tile an outward orientation", () => {
    expect(placements.every((p) => p.lookAt !== undefined)).toBe(true);
  });
});

describe("all layouts — shared invariants", () => {
  const all = {
    table: tableLayout(DATASET_SIZE),
    grid: gridLayout(DATASET_SIZE),
    helix: doubleHelixLayout(DATASET_SIZE),
    sphere: sphereLayout(DATASET_SIZE),
  };

  it("produce matching lengths so tiles can transition between any pair", () => {
    // The transform animation tweens object i from layout A to layout B.
    // Mismatched lengths would throw at runtime mid-animation.
    const lengths = Object.values(all).map((p) => p.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("never emit NaN or Infinity", () => {
    for (const [name, placements] of Object.entries(all)) {
      for (const p of placements) {
        expect(Number.isFinite(p.x), `${name}.x`).toBe(true);
        expect(Number.isFinite(p.y), `${name}.y`).toBe(true);
        expect(Number.isFinite(p.z), `${name}.z`).toBe(true);
      }
    }
  });

  it("handle an empty dataset without throwing", () => {
    expect(tableLayout(0)).toHaveLength(0);
    expect(gridLayout(0)).toHaveLength(0);
    expect(doubleHelixLayout(0)).toHaveLength(0);
    expect(sphereLayout(0)).toHaveLength(0);
  });
});
