import { HELIX_LAYOUT, type Placement } from "./types";

/**
 * DOUBLE HELIX — spec requires a double helix, not the demo's single spiral.
 *
 * The original demo walks one continuous spiral:
 *   theta = i * 0.175 + PI
 *   y     = -(i * 8) + 450
 *
 * A *double* helix is two strands that share an axis and a vertical
 * progression but are 180 degrees out of phase — the structure of B-DNA.
 *
 * The design decision that matters here is how tiles are assigned to
 * strands. Two options:
 *
 *   (a) SPLIT: first half to strand A, second half to strand B.
 *   (b) INTERLEAVE: alternate by parity (i % 2).
 *
 * We use (b). Under (a) the two strands are still geometrically correct,
 * but each strand is a contiguous block of the dataset, so any ordering in
 * the source data (the sheet is roughly grouped by country) lands entirely
 * on one strand — the two ribbons end up visibly different in colour
 * distribution, which reads as a bug even though the geometry is right.
 * Parity interleaving distributes the data evenly across both strands.
 *
 * Consequently both strands advance in lockstep: tiles 0 and 1 sit at the
 * same height on opposite sides, tiles 2 and 3 one step down, and so on.
 * That lockstep is what makes it legible as a *double* helix rather than
 * two unrelated spirals that happen to share an axis.
 *
 * Odd counts are handled: strand A simply gets the extra tile.
 */
export function doubleHelixLayout(count: number): Placement[] {
  const { radius, thetaStep, yStep, strands } = HELIX_LAYOUT;

  // Height is driven by the longest strand so the structure stays centred
  // regardless of parity.
  const longestStrand = Math.ceil(count / strands);
  const offsetY = ((longestStrand - 1) / 2) * yStep;

  const placements: Placement[] = [];

  for (let i = 0; i < count; i++) {
    const strand = i % strands;
    const stepInStrand = Math.floor(i / strands);

    // The phase offset is what makes it a double helix. With 2 strands
    // this is PI; the formula generalises to n strands for free.
    const phase = (strand * 2 * Math.PI) / strands;
    const theta = stepInStrand * thetaStep + Math.PI + phase;

    const x = radius * Math.sin(theta);
    const z = radius * Math.cos(theta);
    const y = -(stepInStrand * yStep) + offsetY;

    placements.push({
      x,
      y,
      z,
      // Face outward from the central axis: same x/z direction, but at
      // double the distance, with y held level so tiles stay upright
      // instead of tipping toward the poles.
      lookAt: { x: x * 2, y, z: z * 2 },
    });
  }

  return placements;
}
