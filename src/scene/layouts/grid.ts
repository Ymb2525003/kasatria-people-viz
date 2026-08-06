import { GRID_LAYOUT, type Placement } from "./types";

/**
 * GRID — spec requires exactly 5 x 4 x 10.
 *
 * The original demo hardcodes a 5 x 5 x N arrangement:
 *   x = (i % 5)
 *   y = (floor(i / 5) % 5)      <- 5 rows
 *   z = floor(i / 25)           <- new layer every 25 tiles
 *
 * Two changes are required, and getting only one of them right is the
 * classic way to silently miss this requirement:
 *   1. the row modulus becomes 4 (not 5)
 *   2. the layer divisor becomes columns * rows = 20 (not 25)
 *
 * If you change the modulus but forget the divisor, you get a 5x4 face
 * that *looks* correct from the front while tiles wrap into the wrong
 * layers behind it — invisible in a screenshot, wrong on inspection.
 *
 * 5 x 4 x 10 = 200, so the supplied dataset fills the volume exactly.
 */
export function gridLayout(count: number): Placement[] {
  const { columns, rows, layers, spacingX, spacingY, spacingZ } = GRID_LAYOUT;

  const perLayer = columns * rows;

  const offsetX = ((columns - 1) / 2) * spacingX;
  const offsetY = ((rows - 1) / 2) * spacingY;
  const offsetZ = ((layers - 1) / 2) * spacingZ;

  const placements: Placement[] = [];

  for (let i = 0; i < count; i++) {
    const column = i % columns;
    const row = Math.floor(i / columns) % rows;
    const layer = Math.floor(i / perLayer);

    placements.push({
      x: column * spacingX - offsetX,
      y: -(row * spacingY) + offsetY,
      z: -(layer * spacingZ) + offsetZ,
    });
  }

  return placements;
}
