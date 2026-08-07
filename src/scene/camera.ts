import type { Placement } from "./layouts/types";
import { TILE } from "./layouts/types";

/**
 * Camera framing math.
 *
 * Kept here — pure, three.js-free, returning plain numbers — for the same
 * reason the layout math is: it is the part that can be wrong in a way a
 * screenshot does not reveal, so it belongs in a unit test rather than in
 * the render loop.
 *
 * The problem it solves: four layouts with very different volumes cannot
 * share one hardcoded camera distance. A constant tuned for the sphere
 * clips the table's outer columns; one tuned for the helix leaves the
 * sphere a speck. Worse, the correct distance depends on the *viewport
 * aspect ratio*, which is not known until runtime — a distance that frames
 * all 20 table columns on a 16:9 monitor clips them on a narrow window.
 *
 * So the distance is derived, not tuned: given the layout's bounding box,
 * the direction the camera looks from, and the current frustum, solve for
 * the nearest distance at which every corner of the box still projects
 * inside the viewport.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Half-extents of the axis-aligned bounding box, centred on the origin. */
export interface Extent {
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly halfDepth: number;
}

/**
 * Bounding half-extents of a set of placements, grown by half a tile.
 *
 * Placements are tile *centres*. Framing to the centres alone shaves half a
 * tile off each edge of the screen, which on the table layout means the
 * first and last columns are visibly sliced — precisely the failure this
 * module exists to prevent.
 *
 * Every layout is built symmetrically around the origin, so max(|v|) is the
 * half-extent directly.
 */
export function extentOf(placements: readonly Placement[]): Extent {
  let x = 0;
  let y = 0;
  let z = 0;

  for (const p of placements) {
    x = Math.max(x, Math.abs(p.x));
    y = Math.max(y, Math.abs(p.y));
    z = Math.max(z, Math.abs(p.z));
  }

  return {
    halfWidth: x + TILE.width / 2,
    halfHeight: y + TILE.height / 2,
    // A tile is a flat plane, so it adds no depth of its own. Rotated tiles
    // (sphere, helix) can lean into Z, but never by more than their own
    // half-width, so that is the safe allowance.
    halfDepth: z + TILE.width / 2,
  };
}

/**
 * Distance from the origin at which the whole box fits the frustum.
 *
 * The camera sits at `direction * distance` and looks at the origin. For
 * each of the eight box corners, expressed in camera space as
 * (right, up, toward-camera) = (cx, cy, cz), the corner is inside the
 * frustum at distance `d` when its depth `d - cz` is deep enough that the
 * corner falls within the frustum's half-width and half-height there:
 *
 *     |cx| <= (d - cz) * tan(hFov / 2)
 *     |cy| <= (d - cz) * tan(vFov / 2)
 *
 * Rearranged, each corner imposes a minimum `d`. The answer is the largest.
 *
 * Solving per-corner rather than using the bounding *sphere* matters: the
 * table is a flat 2780 x 1780 rectangle, and framing it by its diagonal
 * would push the camera far enough back to leave a third of the viewport
 * empty. It also means the grid's deliberately off-axis viewpoint is framed
 * as tightly as the head-on ones, with no separate tuning.
 *
 * @param aspect  viewport width / height
 * @param padding breathing room; 1 is an exact fit with the outermost tile
 *                edges flush against the viewport border
 */
export function fitDistance(
  extent: Extent,
  direction: Vec3,
  fovDegrees: number,
  aspect: number,
  padding = 1.06,
): number {
  const tanV = Math.tan((fovDegrees * Math.PI) / 360);
  const tanH = tanV * aspect;

  const [right, up, toward] = cameraBasis(direction);

  let distance = 0;

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner: Vec3 = {
          x: sx * extent.halfWidth,
          y: sy * extent.halfHeight,
          z: sz * extent.halfDepth,
        };

        const cx = Math.abs(dot(corner, right));
        const cy = Math.abs(dot(corner, up));
        const cz = dot(corner, toward);

        distance = Math.max(distance, cz + cy / tanV, cz + cx / tanH);
      }
    }
  }

  return distance * padding;
}

/** Camera position that frames `extent` when looking at the origin. */
export function framePosition(
  extent: Extent,
  direction: Vec3,
  fovDegrees: number,
  aspect: number,
  padding?: number,
): Vec3 {
  const distance = fitDistance(extent, direction, fovDegrees, aspect, padding);
  const unit = normalise(direction);

  return { x: unit.x * distance, y: unit.y * distance, z: unit.z * distance };
}

// ---------------------------------------------------------------------

/**
 * Orthonormal camera basis for a camera at `direction` looking at the origin,
 * matching three.js's convention where the camera's local +Z points *back*
 * toward the camera.
 */
function cameraBasis(direction: Vec3): [Vec3, Vec3, Vec3] {
  const toward = normalise(direction);

  // World up, unless the view is straight up or down — in which case the
  // cross product below degenerates and any perpendicular axis will do.
  const worldUp: Vec3 =
    Math.abs(toward.y) > 0.9999 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };

  const right = normalise(cross(worldUp, toward));
  const up = cross(toward, right);

  return [right, up, toward];
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

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length === 0) return { x: 0, y: 0, z: 1 };
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}
