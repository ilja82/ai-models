import {Rect, spreadLabels} from './label-layout.util';

const overlaps = (a: Rect, b: Rect) =>
  Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
const moved = (r: Rect, s: { dx: number; dy: number }): Rect => ({x: r.x + s.dx, y: r.y + s.dy, w: r.w, h: r.h});

describe('spreadLabels', () => {
  it('keeps labels that do not overlap in place', () => {
    const shifts = spreadLabels([{x: 0, y: 0, w: 40, h: 12, rank: 0}, {x: 100, y: 0, w: 40, h: 12, rank: 0}]);
    expect(shifts).toEqual([{dx: 0, dy: 0}, {dx: 0, dy: 0}]);
  });

  it('moves a stack of labels apart and keeps the highest rank in place', () => {
    const boxes = [0, 0, 1, 3, 0].map(rank => ({x: 50, y: 50, w: 60, h: 12, rank}));
    const shifts = spreadLabels(boxes);
    expect(shifts[3]).toEqual({dx: 0, dy: 0});
    const placed = boxes.map((b, i) => moved(b, shifts[i]));
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
    }
  });

  it('moves a label off an obstacle', () => {
    const box = {x: 0, y: 0, w: 40, h: 12, rank: 0};
    const marker = {x: 10, y: 2, w: 10, h: 10};
    const [shift] = spreadLabels([box], [marker]);
    expect(overlaps(moved(box, shift), marker)).toBe(false);
  });

  it('takes the place with the least overlap when no place is free', () => {
    const box = {x: 0, y: 0, w: 10, h: 10, rank: 0};
    const wall = {x: -1000, y: -1000, w: 2000, h: 2000};
    expect(spreadLabels([box], [wall])).toEqual([{dx: 0, dy: 0}]);
  });
});
