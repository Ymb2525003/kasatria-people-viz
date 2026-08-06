import { SPHERE_LAYOUT, type Placement } from "./types";

/**
 * SPHERE — the one layout with no dimensional constraint in the spec.
 *
 * The demo's approach is already correct and count-agnostic, so this is
 * essentially the original algorithm, restated in our data-returning form
 * and with the spherical-coordinate conversion made explicit rather than
 * delegated to `Object3D.position.setFromSphericalCoords`.
 *
 * The distribution is a Fibonacci / golden-angle sphere: phi is spaced so
 * that equal steps in `i` cover equal *area*, which avoids the clustering
 * at the poles you get from naive uniform lat/long spacing. With 200 tiles
 * that clustering would be very visible.
 */
export function sphereLayout(count: number): Placement[] {
  const { radius } = SPHERE_LAYOUT;

  const placements: Placement[] = [];

  for (let i = 0; i < count; i++) {
    // Equal-area spacing in the polar angle.
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;

    // Spherical -> Cartesian, matching three.js's convention.
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    placements.push({
      x,
      y,
      z,
      // Face directly away from the centre.
      lookAt: { x: x * 2, y: y * 2, z: z * 2 },
    });
  }

  return placements;
}
