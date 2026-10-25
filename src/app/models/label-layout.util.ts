export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelBox extends Rect {
  /** Labels with a higher rank are placed first and keep their place when it is free. */
  rank: number;
}

export interface Shift {
  dx: number;
  dy: number;
}

const GAP = 2;
const MAX_ROWS = 5;
const MAX_COLUMNS = 2;

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function candidateShifts(box: Rect): Shift[] {
  const stepY = box.h + GAP;
  const stepX = box.w / 2 + GAP;
  const shifts: Shift[] = [];
  for (let row = -MAX_ROWS; row <= MAX_ROWS; row++) {
    for (let column = -MAX_COLUMNS; column <= MAX_COLUMNS; column++) {
      shifts.push({dx: column * stepX, dy: row * stepY});
    }
  }
  return shifts.sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
}

/**
 * Moves each label box to the nearest place that overlaps no placed label and no obstacle.
 * Without a free place, a label takes the place with the least overlap.
 *
 * @param boxes the label boxes at their base places, in screen pixels
 * @param obstacles boxes no label may cover, such as large markers
 * @returns one shift per box, in the order of `boxes`
 */
export function spreadLabels(boxes: LabelBox[], obstacles: Rect[] = []): Shift[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].rank - boxes[a].rank);
  const placed: Rect[] = [...obstacles];
  const shifts: Shift[] = boxes.map(() => ({dx: 0, dy: 0}));
  for (const i of order) {
    const box = boxes[i];
    let best: Shift = {dx: 0, dy: 0};
    let bestOverlap = Infinity;
    for (const shift of candidateShifts(box)) {
      const moved = {x: box.x + shift.dx, y: box.y + shift.dy, w: box.w, h: box.h};
      const overlap = placed.reduce((sum, r) => sum + overlapArea(moved, r), 0);
      if (overlap < bestOverlap) {
        best = shift;
        bestOverlap = overlap;
        if (overlap === 0) break;
      }
    }
    shifts[i] = best;
    placed.push({x: box.x + best.dx, y: box.y + best.dy, w: box.w, h: box.h});
  }
  return shifts;
}
