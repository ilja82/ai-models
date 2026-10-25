import {TestBed} from '@angular/core/testing';
import {Scatter3dPlotComponent} from './scatter-3d-plot';
import {ThemeState} from '../../state/theme.state';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';
import {darken, getPlotColors} from '../../models/plot-colors';

describe('3D label color in the "Most attractive" box', () => {
  const good = testModel({id: 'good', publicName: 'Good', costsToRun: 1, overallIntelligence: 60, contextWindow: 1_000_000});
  const nearGood = testModel({id: 'nearGood', publicName: 'Near good', costsToRun: 2, overallIntelligence: 58, contextWindow: 900_000});
  const mid = testModel({id: 'mid', publicName: 'Mid', costsToRun: 50, overallIntelligence: 45, contextWindow: 200_000});
  const bad = testModel({id: 'bad', publicName: 'Bad', costsToRun: 100, overallIntelligence: 30, contextWindow: 8_000});

  const labelColors = (c: Scatter3dPlotComponent) => new Map(c.traces()
    .filter((t: any) => t.mode === 'markers+text' && Array.isArray(t.textfont.color))
    .flatMap((t: any) => t.text.map((name: string, i: number) => [name, t.textfont.color[i]] as const)));

  let state: AppState;
  let theme: ThemeState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    theme = TestBed.inject(ThemeState);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(false);
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    state.allModels.set([good, nearGood, mid, bad]);
  });

  it('darkens the names inside the box in the light theme and keeps the others', () => {
    theme.override.set('light');
    const light = getPlotColors('light');
    const colors = labelColors(TestBed.createComponent(Scatter3dPlotComponent).componentInstance);
    expect(colors.get('Near good')).toBe(darken(light.pointLabel3d, light.attractiveTextShade));
    expect(colors.get('Bad')).toBe(light.pointLabel3d);
  });

  it('does not shade the names in the box in the dark theme', () => {
    theme.override.set('dark');
    const colors = labelColors(TestBed.createComponent(Scatter3dPlotComponent).componentInstance);
    expect(colors.get('Near good')).toBe(getPlotColors('dark').pointLabel3d);
    expect(colors.get('Bad')).toBe(getPlotColors('dark').pointLabel3d);
  });
});

describe('3D effort label color', () => {
  const level = (effort: string, overallIntelligence: number, costsToRun: number) => ({
    effort, overallIntelligence, costsToRun, tokensPerRun: 1, inputTokensPerRun: 1, outputTokensPerRun: 0,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });

  const effortLabelColors = (theme: 'light' | 'dark') => {
    localStorage.clear();
    TestBed.inject(ThemeState).override.set(theme);
    const state = TestBed.inject(AppState);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(true);
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    state.allModels.set([
      testModel({id: 'a', costsToRun: 1, overallIntelligence: 60, contextWindow: 1_000_000}),
      testModel({id: 'b', costsToRun: 100, overallIntelligence: 30, contextWindow: 8_000}),
      testModel({
        id: 'lv', effort: 'high', costsToRun: 90, overallIntelligence: 35, contextWindow: 10_000,
        efforts: [level('low', 31, 80), level('high', 35, 90)],
      }),
    ]);
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    const trace = c.traces().find((t: any) => t.name.endsWith('effort levels')) as any;
    const index = c.shownEffortCurves()[0].points.findIndex(p => p.id === 'lv@low');
    lastTrace = trace;
    return trace.textfont.color[index] as string;
  };
  let lastTrace: any;

  it('draws the effort labels as large as the model names', () => {
    effortLabelColors('light');
    const names = TestBed.createComponent(Scatter3dPlotComponent).componentInstance.traces()
      .find((t: any) => t.name === 'API') as any;
    expect(lastTrace.textfont.size).toBe(names.textfont.size);
  });

  it('darkens the effort labels outside the box in the light theme', () => {
    const light = getPlotColors('light');
    expect(effortLabelColors('light')).toBe(darken(light.api, light.effortLabelShade3d));
    expect(light.effortLabelShade3d).toBeGreaterThan(0);
  });

  it('keeps the line color in the dark theme', () => {
    expect(effortLabelColors('dark')).toBe(getPlotColors('dark').api);
  });
});
