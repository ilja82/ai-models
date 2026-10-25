import {BalancedAxis, bestBalancedId} from './balanced.util';

describe('bestBalancedId', () => {
  const points = [
    {id: 'cheap', cost: 1, intel: 40},
    {id: 'mid', cost: 10, intel: 50},
    {id: 'pricey', cost: 1000, intel: 0},
  ];
  const axes = (log: boolean): BalancedAxis<typeof points[number]>[] => [
    {get: p => p.cost, higherIsBetter: false, log},
    {get: p => p.intel, higherIsBetter: true},
  ];

  it('normalizes a linear axis on the values', () => {
    expect(bestBalancedId(points, axes(false))).toBe('mid');
  });

  it('normalizes a log axis on log2 of the values', () => {
    expect(bestBalancedId(points, axes(true))).toBe('cheap');
  });

  it('counts a value <= 0 on a log axis as 0.001', () => {
    const withFree = points.concat({id: 'free', cost: 0, intel: 0});
    expect(bestBalancedId(withFree, axes(true))).toBe('cheap');
    expect(bestBalancedId([{id: 'a', cost: NaN, intel: 1}], axes(true))).toBeNull();
  });
});
