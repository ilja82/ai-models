import {TestBed} from '@angular/core/testing';
import {ScatterPlotComponent} from './scatter-plot';
import {ThemeState} from '../../state/theme.state';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';
import {darken, getPlotColors} from '../../models/plot-colors';

describe('label color on the "Most attractive" zone', () => {
  const fakeChart = (pixelOf: (v: number) => number) => ({
    scales: {
      x: {left: 0, right: 100, getPixelForValue: pixelOf},
      y: {top: 0, bottom: 100, getPixelForValue: pixelOf},
    },
  }) as any;

  it('darkens a label inside the zone in the light theme and keeps it elsewhere', () => {
    localStorage.clear();
    TestBed.inject(ThemeState).override.set('light');
    const state = TestBed.inject(AppState);
    state.plotType.set('price');
    state.logScaleX.set(false);
    state.allModels.set([
      testModel({id: 'a', overallIntelligence: 40}),
      testModel({id: 'b', overallIntelligence: 60}),
    ]);
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const chart = fakeChart(() => 50);
    expect(c.labelColorAt(chart, '#eab308', 80, 20)).toBe(darken('#eab308', getPlotColors('light').attractiveTextShade));
    expect(c.labelColorAt(chart, '#eab308', 20, 20)).toBe('#eab308');
    expect(c.labelColorAt(chart, '#eab308', 80, 80)).toBe('#eab308');

    TestBed.inject(ThemeState).override.set('dark');
    expect(c.labelColorAt(chart, '#eab308', 80, 20)).toBe('#eab308');
  });
});
