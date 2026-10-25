import {TestBed} from '@angular/core/testing';
import {AppState} from '../../state/app.state';
import {ThemeState} from '../../state/theme.state';
import {testModel} from '../../../testing/model-fixture';
import {darken, getPlotColors} from '../../models/plot-colors';
import {HIGHLIGHT_LABEL_SIZE_3D, LABEL_SIZE_3D, MARKER_SIZE_3D, Scatter3dPlotComponent} from './scatter-3d-plot';

describe('highlighted 3D markers', () => {
  const level = (effort: string, overallIntelligence: number, costsToRun: number) => ({
    effort, overallIntelligence, costsToRun, tokensPerRun: 1, inputTokensPerRun: 1, outputTokensPerRun: 0,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    TestBed.inject(ThemeState).override.set('light');
    state = TestBed.inject(AppState);
    state.disabledModelIds.set(new Set());
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
  });

  it('draws the Pareto and best per axis models larger than the others, with bold larger labels', () => {
    state.allModels.set([
      testModel({id: 'plain', costsToRun: 100, overallIntelligence: 10, contextWindow: 1000}),
      ...[1, 2, 4, 8, 16, 32].map((cost, i) => testModel({id: `m${i}`, costsToRun: cost, overallIntelligence: 20 + i * 10})),
    ]);
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    const traces = c.traces() as any[];
    const byName = (name: string) => traces.find(t => t.name === name);
    const api = byName('API');
    expect(api.x.length).toBe(1);
    expect(byName('Best balanced').marker.size).toBeGreaterThan(MARKER_SIZE_3D.axisBest);
    const plain = c.labels3d().find(l => l.id === 'plain')!;
    expect(plain.bold).toBe(false);
    const light = getPlotColors('light');
    for (const [name, rank, color] of [['Pareto efficient', 1, light.usefulLabel], ['Best per axis', 2, light.axisBestLabel]] as const) {
      const t = byName(name);
      expect(t.x.length).toBeGreaterThan(0);
      expect(t.marker.size).toBeGreaterThan(api.marker.size);
      const labels = c.labels3d().filter(l => l.rank === rank);
      expect(labels.length).toBe(t.x.length);
      for (const l of labels) {
        expect(l.size).toBeGreaterThan(plain.size);
        expect(l.bold).toBe(true);
        expect([color, darken(color, light.attractiveTextShade)]).toContain(l.color);
      }
    }
  });

  it('writes the labels of Pareto effort levels larger', () => {
    state.allModels.set([
      testModel({id: 'a', costsToRun: 1, overallIntelligence: 20}),
      testModel({id: 'b', costsToRun: 100, overallIntelligence: 90}),
      testModel({
        id: 'lv', effort: 'high', costsToRun: 10, overallIntelligence: 50, contextWindow: 1_000_000,
        efforts: [level('low', 30, 3), level('mid', 40, 5), level('high', 50, 10)],
      }),
    ]);
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    const trace = (c.traces() as any[]).find(t => t.name.endsWith('effort levels'));
    const points = c.shownEffortCurves()[0].points;
    const pareto = points.filter((_, i) => trace.marker.size[i] === MARKER_SIZE_3D.useful);
    expect(pareto.length).toBeGreaterThan(0);
    for (const p of pareto) {
      const label = c.labels3d().find(l => l.id === p.id)!;
      expect([label.size, label.bold]).toEqual([HIGHLIGHT_LABEL_SIZE_3D, true]);
    }
    expect(HIGHLIGHT_LABEL_SIZE_3D).toBeGreaterThan(LABEL_SIZE_3D);
  });
});
