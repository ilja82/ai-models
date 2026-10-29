import {darken, getPlotColors, withAlpha} from './plot-colors';

function hue(color: string): number {
  const rgba = color.match(/\d+(\.\d+)?/g);
  const [r, g, b] = color.startsWith('#')
    ? [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255)
    : rgba!.slice(0, 3).map(v => +v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}

describe('plot colors', () => {
  for (const theme of ['dark', 'light'] as const) {
    it(`draw best balanced in orange, apart from the other markers, in the ${theme} theme`, () => {
      const c = getPlotColors(theme);
      expect(hue(c.balanced)).toBeGreaterThanOrEqual(10);
      expect(hue(c.balanced)).toBeLessThanOrEqual(30);
      for (const other of [c.api, c.local]) expect(hueDistance(c.balanced, other)).toBeGreaterThan(60);
      for (const other of [c.useful, c.axisBest]) expect(hueDistance(c.balanced, other)).toBeGreaterThan(10);
    });

    it(`draw the best per axis star in a clear yellow, apart from the orange, in the ${theme} theme`, () => {
      const c = getPlotColors(theme);
      expect(hue(c.axisBest)).toBeGreaterThanOrEqual(45);
      expect(hue(c.axisBest)).toBeLessThanOrEqual(60);
      expect(hueDistance(c.axisBest, c.balanced)).toBeGreaterThan(25);
    });
  }
});

describe('darken', () => {
  it('mixes hex and rgba colors with black', () => {
    expect(darken('#ffd60a', 0)).toBe('#ffd60a');
    expect(darken('#ffffff', 0.5)).toBe('rgb(128,128,128)');
    expect(darken('rgba(200,100,0,0.5)', 0.5)).toBe('rgb(100,50,0)');
  });

  it('sets the alpha of hex and rgba colors', () => {
    expect(withAlpha('#1e5bc6', 0.35)).toBe('rgba(30,91,198,0.35)');
    expect(withAlpha('rgba(160,160,160,0.65)', 0.35)).toBe('rgba(160,160,160,0.35)');
  });

  it('darkens labels in the green zone only in the light theme', () => {
    expect(getPlotColors('light').attractiveTextShade).toBeGreaterThan(0);
    expect(getPlotColors('dark').attractiveTextShade).toBe(0);
  });

  it('gives the 3D names a gray darker than #bbb but readable on the dark surface in the dark theme', () => {
    const channels = [1, 3, 5].map(i => parseInt(getPlotColors('dark').pointLabel3d.slice(i, i + 2), 16));
    expect(Math.max(...channels)).toBeLessThan(0xbb);
    expect(Math.min(...channels)).toBeGreaterThan(0x70);
  });

  it('gives the 3D names a dark gray in the light theme', () => {
    expect(parseInt(getPlotColors('light').pointLabel3d.slice(1, 3), 16)).toBeLessThan(0x80);
  });
});
