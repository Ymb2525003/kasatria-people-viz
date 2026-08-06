import { TABLE_LAYOUT, type Placement } from "./types";

/**
 * TABLE — spec requires exactly 20 columns x 10 rows.
 *
 * The original demo could not do this: it positioned each element using
 * hardcoded periodic-table coordinates baked into the data array
 * (`table[i + 3]`, `table[i + 4]`), which is why it renders with the
 * characteristic gaps of a real periodic table. Our data has no such
 * intrinsic coordinates, so we derive them from the index instead.
 *
 * Row-major fill: index 0..19 is the first row, 20..39 the second, and so
 * on. 200 people fill exactly 20 x 10 with no remainder.
 *
 * The grid is centred on the origin so the camera framing from the demo
 * still works without retuning: with 20 columns the centre sits at
 * column 9.5, hence the (columns - 1) / 2 offset.
 */
export function tableLayout(count: number): Placement[] {
  const { columns, spacingX, spacingY } = TABLE_LAYOUT;

  const offsetX = ((columns - 1) / 2) * spacingX;
  const rowCount = Math.ceil(count / columns);
  const offsetY = ((rowCount - 1) / 2) * spacingY;

  const placements: Placement[] = [];

  for (let i = 0; i < count; i++) {
    const column = i % columns;
    const row = Math.floor(i / columns);

    placements.push({
      x: column * spacingX - offsetX,
      y: -(row * spacingY) + offsetY,
      z: 0,
    });
  }

  return placements;
}
