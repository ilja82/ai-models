import {effortLabelOffset, labelBaselines} from './scatter-plot';

describe('label placement', () => {
  const labelH = 12;

  it('keeps every model label candidate clear of its marker', () => {
    for (const radius of [6, 7, 11, 15]) {
      for (const baseline of labelBaselines(100, radius, labelH)) {
        const clear = baseline < 100 - radius || baseline - labelH > 100 + radius;
        expect(clear).toBe(true);
      }
    }
  });

  it('tries the place above the marker first', () => {
    expect(labelBaselines(100, 15, labelH)[0]).toBeLessThan(100 - 15);
  });

  it('starts an effort label right of a large marker', () => {
    for (const radius of [11, 13]) expect(effortLabelOffset(radius).dx).toBeGreaterThan(radius);
  });

  it('keeps the small effort labels where they were', () => {
    expect(effortLabelOffset(3)).toEqual({dx: 5, dy: 8});
  });
});
