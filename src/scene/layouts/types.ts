/**
 * Layout math lives in plain functions that return position/rotation data,
 * deliberately decoupled from three.js objects.
 *
 * Why: `THREE.Object3D` cannot be constructed in a plain Node test
 * environment without pulling in the whole library, and asserting on a
 * mutated object graph is awkward. By returning inert data, the exact
 * spec numbers — 20x10 and 5x4x10 — become trivially assertable in a
 * unit test. The scene layer then applies this data to Object3Ds.
 *
 * This is the difference between "the grid looks about right" and
 * "the grid is provably 5 wide, 4 tall, 10 deep".
 */

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Where the tile should face. Omitted for flat layouts (table, grid). */
  readonly lookAt?: { readonly x: number; readonly y: number; readonly z: number };
}

/** Tile footprint from the original demo, kept so spacing reads intuitively. */
export const TILE = {
  width: 120,
  height: 160,
} as const;

export const TABLE_LAYOUT = {
  columns: 20,
  rows: 10,
  spacingX: 140,
  spacingY: 180,
} as const;

export const GRID_LAYOUT = {
  columns: 5,
  rows: 4,
  layers: 10,
  spacingX: 420,
  spacingY: 460,
  // Sized to be seen from an angle rather than head-on -- see CAMERA_DISTANCE
  // in PeriodicScene. Viewed off-axis the layers no longer occlude each other,
  // so depth can be generous enough to make all ten of them distinct.
  spacingZ: 420,
} as const;

export const SPHERE_LAYOUT = {
  radius: 900,
} as const;

// Tuned so the structure is taller than it is wide. At radius 900 with a 14
// unit drop the helix came out 1800 across and 1400 tall, which reads as a
// drum rather than a helix.
export const HELIX_LAYOUT = {
  radius: 450,
  /** Angular step between consecutive tiles *within one strand*. */
  thetaStep: 0.19,
  /** Vertical drop between consecutive tiles within one strand. */
  yStep: 22,
  strands: 2,
} as const;
