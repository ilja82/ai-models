import {TestBed} from '@angular/core/testing';
import {ScatterPlotComponent} from './scatter-plot';
import {ThemeState} from '../../state/theme.state';
import {getPlotColors} from '../../models/plot-colors';

describe('Pareto and best per axis label color', () => {
  const point = (flags: { useful?: boolean; axisBest?: boolean; balanced?: boolean }) =>
    ({useful: false, axisBest: false, balanced: false, ...flags}) as any;
  const curve = {color: '#123456'} as any;

  for (const theme of ['light', 'dark'] as const) {
    it(`uses the label colors for Pareto and best per axis labels in the ${theme} theme`, () => {
      localStorage.clear();
      TestBed.inject(ThemeState).override.set(theme);
      const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
      const colors = getPlotColors(theme);
      expect(c.pointLabelColor(colors.useful)).toBe(colors.usefulLabel);
      expect(c.pointLabelColor(colors.axisBest)).toBe(colors.axisBestLabel);
      expect(c.pointLabelColor(colors.api)).toBe(colors.api);
      expect(c.effortLabelColor(curve, point({useful: true}))).toBe(colors.usefulLabel);
      expect(c.effortLabelColor(curve, point({useful: true, axisBest: true}))).toBe(colors.axisBestLabel);
      expect(c.effortLabelColor(curve, point({}))).toBe('#123456');
    });
  }

  it('draws the light Pareto and best per axis labels darker than their markers', () => {
    const {useful, usefulLabel, axisBest, axisBestLabel} = getPlotColors('light');
    const lightness = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(lightness(usefulLabel)).toBeLessThan(lightness(useful) * 0.75);
    expect(lightness(axisBestLabel)).toBeLessThan(lightness(axisBest) * 0.75);
  });
});
