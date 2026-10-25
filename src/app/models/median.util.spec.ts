import {median} from './median.util';

describe('median', () => {
  it('returns the middle value of an odd count, also for unsorted input', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('returns the mean of the two middle values of an even count', () => {
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it('ignores one extreme value', () => {
    expect(median([1, 2, 3, 4, 1000])).toBe(3);
  });

  it('leaves out non-finite values and returns null without a finite value', () => {
    expect(median([NaN, 7, Infinity])).toBe(7);
    expect(median([NaN])).toBeNull();
    expect(median([])).toBeNull();
  });
});
