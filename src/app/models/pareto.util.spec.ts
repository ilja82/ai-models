import {dominators, ParetoAxis, paretoIds} from './pareto.util';

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

describe('dominators', () => {
  type Item = { id: string; x: number | null; y: number };
  const axes: ParetoAxis<Item>[] = [
    {get: p => p.x, higherIsBetter: true},
    {get: p => p.y, higherIsBetter: false},
  ];
  const items: Item[] = [
    {id: 'best', x: 10, y: 1},
    {id: 'same', x: 5, y: 2},
    {id: 'worse', x: 5, y: 2},
    {id: 'missing', x: null, y: 0},
  ];
  const of = (id: string) => dominators(items.find(i => i.id === id)!, items, axes).map(i => i.id);

  it('returns each item that is at least as good on every axis and better on one', () => {
    expect(of('worse')).toEqual(['best']);
    expect(of('best')).toEqual([]);
  });

  it('returns nothing for an item without a value, and never an item without a value', () => {
    expect(of('missing')).toEqual([]);
    expect(of('same')).not.toContain('missing');
  });
});
