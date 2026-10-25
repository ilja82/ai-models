import {TestBed} from '@angular/core/testing';
import {Label3d, Scatter3dPlotComponent} from './scatter-3d-plot';
import {ThemeState} from '../../state/theme.state';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';
import {darken, getPlotColors} from '../../models/plot-colors';

describe('3D label color in the "Most attractive" box', () => {
  const good = testModel({id: 'good', publicName: 'Good', costsToRun: 1, overallIntelligence: 60, contextWindow: 1_000_000});
  const nearGood = testModel({id: 'nearGood', publicName: 'Near good', costsToRun: 2, overallIntelligence: 58, contextWindow: 900_000});
  const mid = testModel({id: 'mid', publicName: 'Mid', costsToRun: 50, overallIntelligence: 45, contextWindow: 200_000});
  const bad = testModel({id: 'bad', publicName: 'Bad', costsToRun: 100, overallIntelligence: 30, contextWindow: 8_000});
  const old = testModel({id: 'old', publicName: 'Old', costsToRun: 80, overallIntelligence: 20, contextWindow: 4_000});
  const tiny = testModel({id: 'tiny', publicName: 'Tiny', costsToRun: 90, overallIntelligence: 10, contextWindow: 2_000});

  const labelColors = (c: Scatter3dPlotComponent) => new Map(c.labels3d().map(l => [l.text, l.color] as const));

  let state: AppState;
  let theme: ThemeState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    theme = TestBed.inject(ThemeState);
    state.disabledModelIds.set(new Set());
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    state.allModels.set([good, nearGood, mid, bad, old, tiny]);
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

describe('3D zone split', () => {
  const at = (id: string, costsToRun: number, overallIntelligence: number, contextWindow: number) =>
    testModel({id, publicName: id, costsToRun, overallIntelligence, contextWindow});
  const models = [at('a', 1, 60, 1_000_000), at('b', 2, 58, 900_000), at('c', 50, 45, 200_000),
    at('d', 100, 30, 8_000), at('e', 80, 20, 4_000), at('f', 90, 10, 2_000)];

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.disabledModelIds.set(new Set());
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    state.allModels.set(models);
  });

  const regionNames = (c: Scatter3dPlotComponent) =>
    (c.traces() as { mode?: string; name: string }[]).filter(t => t.mode === 'lines' && t.name.endsWith('attractive')).map(t => t.name);

  it('splits at the median and at the top quarter of intelligence', () => {
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    expect(c.zoneSplit3d()).toEqual([65, 54.75, 104_000]);
  });

  it('keeps the split when the filter hides models', () => {
    state.disabledModelIds.set(new Set(['a', 'b']));
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    expect(c.zoneSplit3d()).toEqual([65, 54.75, 104_000]);
  });

  it('draws both cuboids when the split lies inside the axis ranges', () => {
    expect(regionNames(TestBed.createComponent(Scatter3dPlotComponent).componentInstance))
      .toEqual(['Most attractive', 'Least attractive']);
  });

  it('drops the "Most attractive" cuboid when the shown models all lie below the split', () => {
    state.disabledModelIds.set(new Set(['a', 'b']));
    expect(regionNames(TestBed.createComponent(Scatter3dPlotComponent).componentInstance)).toEqual(['Least attractive']);
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
    const label = c.labels3d().find(l => l.id === 'lv@low')!;
    lastLabel = label;
    return label.color;
  };
  let lastLabel: Label3d;

  it('draws the effort labels as large as the model names', () => {
    effortLabelColors('light');
    const name = TestBed.createComponent(Scatter3dPlotComponent).componentInstance.labels3d().find(l => l.id === 'b')!;
    expect(lastLabel.rank).toBe(0);
    expect(lastLabel.size).toBe(name.size);
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
