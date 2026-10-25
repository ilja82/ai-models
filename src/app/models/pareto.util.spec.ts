import {ParetoAxis, paretoIds} from './pareto.util';

describe('paretoIds', () => {
  type Item = { id: string; x: number | null; y: number };
  const axes: ParetoAxis<Item>[] = [
    {get: p => p.x, higherIsBetter: true},
    {get: p => p.y, higherIsBetter: false},
  ];
  const ranked = (items: Item[]) => [...paretoIds(items, axes)].sort();

  it('keeps the items that no other item dominates', () => {
    expect(ranked([
      {id: 'best', x: 10, y: 1},
      {id: 'cheap', x: 5, y: 0.5},
      {id: 'worse', x: 5, y: 2},
    ])).toEqual(['best', 'cheap']);
  });

  it('keeps equal items and drops an item that is equal on one axis and worse on the other', () => {
    expect(ranked([
      {id: 'a', x: 10, y: 1},
      {id: 'b', x: 10, y: 1},
      {id: 'c', x: 10, y: 2},
    ])).toEqual(['a', 'b']);
  });

  it('leaves out items without a value, so they cannot dominate', () => {
    expect(ranked([
      {id: 'missing', x: null, y: 0},
      {id: 'nan', x: NaN, y: 0},
      {id: 'only', x: 1, y: 5},
    ])).toEqual(['only']);
  });
});
