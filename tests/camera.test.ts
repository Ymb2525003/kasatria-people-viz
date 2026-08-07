import { describe, expect, it } from "vitest";
import { extentOf, fitDistance, framePosition, type Vec3 } from "@/scene/camera";
import { tableLayout } from "@/scene/layouts/table";
import { gridLayout } from "@/scene/layouts/grid";
import { sphereLayout } from "@/scene/layouts/sphere";
import { doubleHelixLayout } from "@/scene/layouts/doubleHelix";
import { TABLE_LAYOUT, TILE } from "@/scene/layouts/types";

const DATASET_SIZE = 200;
const FOV = 40;

/** Viewport shapes worth caring about: tall phone, laptop, wide monitor. */
const ASPECTS = [0.46, 1.0, 1.6, 2.4];

const HEAD_ON: Vec3 = { x: 0, y: 0, z: 1 };
/** The grid's deliberately off-axis viewpoint, from PeriodicScene. */
const OFF_AXIS: Vec3 = { x: 2600, y: 1500, z: 3000 };

const LAYOUTS = {
  table: tableLayout(DATASET_SIZE),
  sphere: sphereLayout(DATASET_SIZE),
  helix: doubleHelixLayout(DATASET_SIZE),
  grid: gridLayout(DATASET_SIZE),
};

describe("extentOf", () => {
  it("measures the table to its outermost tile edges, not its tile centres", () => {
    const extent = extentOf(LAYOUTS.table);
    const { columns, rows, spacingX, spacingY } = TABLE_LAYOUT;

    // Centre of the outer column, plus the half tile that hangs past it.
    expect(extent.halfWidth).toBeCloseTo(((columns - 1) / 2) * spacingX + TILE.width / 2);
    expect(extent.halfHeight).toBeCloseTo(((rows - 1) / 2) * spacingY + TILE.height / 2);
  });

  it("gives the flat table no depth beyond a tile's own footprint", () => {
    expect(extentOf(LAYOUTS.table).halfDepth).toBeCloseTo(TILE.width / 2);
  });
});

/**
 * The property that matters, checked by independent projection.
 *
 * `isVisible` below builds the view basis from a look-at direction rather than
 * reusing the module's own basis, so a sign error in `camera.ts` cannot hide
 * behind the same sign error in the test.
 */
describe("fitDistance keeps the entire layout on screen", () => {
  for (const [name, placements] of Object.entries(LAYOUTS)) {
    const direction = name === "grid" ? OFF_AXIS : HEAD_ON;
    const extent = extentOf(placements);

    for (const aspect of ASPECTS) {
      it(`${name} @ aspect ${aspect}: every bounding-box corner is inside the frustum`, () => {
        const camera = framePosition(extent, direction, FOV, aspect);

        for (const corner of cornersOf(extent)) {
          expect(isVisible(corner, camera, FOV, aspect)).toBe(true);
        }
      });

      it(`${name} @ aspect ${aspect}: every tile centre is inside the frustum`, () => {
        const camera = framePosition(extent, direction, FOV, aspect);

        for (const placement of placements) {
          expect(isVisible(placement, camera, FOV, aspect)).toBe(true);
        }
      });
    }
  }
});

describe("fitDistance responds to the viewport, not just the layout", () => {
  const extent = extentOf(LAYOUTS.table);

  /**
   * This is the regression the module exists for. The camera distance used to
   * be a hardcoded constant, so a viewport narrow enough to make the frustum
   * the binding constraint sliced off the table's outer columns — on the one
   * layout whose exact 20 x 10 shape the assignment asks a reviewer to verify.
   */
  it("pulls back further on a narrow viewport than a wide one", () => {
    const narrow = fitDistance(extent, HEAD_ON, FOV, 0.6);
    const wide = fitDistance(extent, HEAD_ON, FOV, 2.4);

    expect(narrow).toBeGreaterThan(wide);
  });

  it("stops widening once height becomes the binding constraint", () => {
    // The table is far wider than it is tall, so beyond some aspect ratio the
    // vertical extent decides the distance and extra width changes nothing.
    const wide = fitDistance(extent, HEAD_ON, FOV, 6);
    const wider = fitDistance(extent, HEAD_ON, FOV, 12);

    expect(wider).toBeCloseTo(wide);
  });

  it("pulls back further for a narrower field of view", () => {
    const tight = fitDistance(extent, HEAD_ON, 20, 1.6);
    const loose = fitDistance(extent, HEAD_ON, 60, 1.6);

    expect(tight).toBeGreaterThan(loose);
  });

  it("leaves margin: padding of 1 is a flush fit, the default is not", () => {
    const flush = fitDistance(extent, HEAD_ON, FOV, 1.6, 1);
    const padded = fitDistance(extent, HEAD_ON, FOV, 1.6);

    expect(padded).toBeGreaterThan(flush);
  });
});

describe("framePosition", () => {
  it("places the camera along the requested direction", () => {
    const extent = extentOf(LAYOUTS.grid);
    const position = framePosition(extent, OFF_AXIS, FOV, 1.6);

    // Same direction, so the components stay in the same ratio.
    expect(position.x / position.z).toBeCloseTo(OFF_AXIS.x / OFF_AXIS.z);
    expect(position.y / position.z).toBeCloseTo(OFF_AXIS.y / OFF_AXIS.z);
  });

  it("ignores the magnitude of the direction vector", () => {
    const extent = extentOf(LAYOUTS.grid);
    const near = framePosition(extent, OFF_AXIS, FOV, 1.6);
    const far = framePosition(
      extent,
      { x: OFF_AXIS.x * 100, y: OFF_AXIS.y * 100, z: OFF_AXIS.z * 100 },
      FOV,
      1.6,
    );

    expect(far.x).toBeCloseTo(near.x);
    expect(far.y).toBeCloseTo(near.y);
    expect(far.z).toBeCloseTo(near.z);
  });

  it("survives a straight-down viewpoint, where world up degenerates", () => {
    const extent = extentOf(LAYOUTS.table);
    const position = framePosition(extent, { x: 0, y: 1, z: 0 }, FOV, 1.6);

    expect(Number.isFinite(position.y)).toBe(true);
    expect(position.y).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------

function cornersOf(extent: {
  halfWidth: number;
  halfHeight: number;
  halfDepth: number;
}): Vec3[] {
  const corners: Vec3[] = [];

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corners.push({
          x: sx * extent.halfWidth,
          y: sy * extent.halfHeight,
          z: sz * extent.halfDepth,
        });
      }
    }
  }

  return corners;
}

/**
 * Independent visibility check: is `point` inside the frustum of a camera at
 * `camera` looking at the origin?
 */
function isVisible(point: Vec3, camera: Vec3, fovDegrees: number, aspect: number): boolean {
  const tanV = Math.tan((fovDegrees * Math.PI) / 360);
  const tanH = tanV * aspect;

  const forward = unit({ x: -camera.x, y: -camera.y, z: -camera.z });
  const worldUp: Vec3 =
    Math.abs(forward.y) > 0.9999 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };

  const right = unit(cross(forward, worldUp));
  const up = cross(right, forward);

  const rel: Vec3 = { x: point.x - camera.x, y: point.y - camera.y, z: point.z - camera.z };

  const depth = dot(rel, forward);
  if (depth <= 0) return false;

  const EPSILON = 1e-9;

  return (
    Math.abs(dot(rel, right)) <= depth * tanH + EPSILON &&
    Math.abs(dot(rel, up)) <= depth * tanV + EPSILON
  );
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}
