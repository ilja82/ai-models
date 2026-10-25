import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {EffortLevel} from '../models/ai-model.model';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';

describe('special marker sizes', () => {
  const level = (effort: string, overallIntelligence: number, costsToRun: number): EffortLevel => ({
    effort, overallIntelligence, costsToRun, tokensPerRun: 1, inputTokensPerRun: 1, outputTokensPerRun: 0,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });
  const cheap = testModel({id: 'cheap', costsToRun: 1, overallIntelligence: 40});
  const pricey = testModel({id: 'pricey', costsToRun: 1000, overallIntelligence: 50});
  const withLevel = testModel({
    id: 'lv', effort: 'high', costsToRun: 500, overallIntelligence: 45,
    efforts: [level('low', 49, 2), level('high', 45, 500)],
  });

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(true);
    state.plotType.set('cost');
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
  });

  // Plotly scatter3d draws a per-point size array at size / sizeref / 2, a single size at its value.
  const drawnArraySize = (size: number, sizeref = 1) => size / sizeref / 2;
  const sizes3d = (c: Scatter3dPlotComponent) => c.traces()
    .filter(t => t.type === 'scatter3d' && 'marker' in t)
    .map((t: any) => ({
      balanced: t.name === 'Best balanced',
      sizes: Array.isArray(t.marker.size)
        ? (t.marker.size as number[]).map(s => drawnArraySize(s, t.marker.sizeref))
        : t.x.map(() => t.marker.size as number),
    }));

  it('is the largest marker on a model point', () => {
    state.allModels.set([cheap, pricey]);
    const c2 = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const balanced = c2.plotData().find(d => d.pointStyle === 'rectRot')!;
    expect(Math.max(...c2.plotData().filter(d => d !== balanced).map(d => d.radius))).toBeLessThan(balanced.radius);

    const c3 = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    const traces = sizes3d(c3);
    const [balancedSize] = traces.find(t => t.balanced)!.sizes;
    expect(balancedSize).toBeDefined();
    expect(Math.max(...traces.filter(t => !t.balanced).flatMap(t => t.sizes))).toBeLessThan(balancedSize);
  });

  it('is the largest marker on an effort level', () => {
    state.allModels.set([cheap, pricey, withLevel]);
    const c2 = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const points = c2.effortCurves().flatMap(c => c.points);
    expect(points.filter(p => p.balanced).length).toBe(1);
    const radius = (c2 as any).effortDatasets(c2.effortCurves()).flatMap((d: any) => d.pointRadius) as number[];
    const balancedRadius = radius[points.findIndex(p => p.balanced)];
    const others = radius.filter((_, i) => !points[i].balanced).concat(c2.plotData().map(d => d.radius));
    expect(Math.max(...others)).toBeLessThan(balancedRadius);

    const c3 = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    expect(c3.specialMarkers3d().balancedId).toBe('lv@low');
    const levelTrace = c3.traces().find(t => t.name === `${withLevel.publicName} effort levels`) as any;
    const balancedIndex = c3.shownEffortCurves()[0].points.findIndex(p => p.id === 'lv@low');
    const balancedSize = drawnArraySize(levelTrace.marker.size[balancedIndex], levelTrace.marker.sizeref);
    const others3d = sizes3d(c3).flatMap(t => t.sizes);
    others3d.splice(others3d.indexOf(balancedSize), 1);
    expect(Math.max(...others3d)).toBeLessThan(balancedSize);
  });

  it('draws a best per axis effort level as large as a best per axis model', () => {
    state.allModels.set([pricey, testModel({id: 'smart', costsToRun: 5000, overallIntelligence: 60}), testModel({
      id: 'cheapLevel', effort: 'high', costsToRun: 500, overallIntelligence: 30,
      efforts: [level('low', 20, 0.5), level('high', 30, 500)],
    })]);
    const c2 = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const points = c2.effortCurves().flatMap(c => c.points);
    const datasets = (c2 as any).effortDatasets(c2.effortCurves());
    const radius = datasets.flatMap((d: any) => d.pointRadius) as number[];
    const style = datasets.flatMap((d: any) => d.pointStyle);
    const levelIndex = points.findIndex(p => p.axisBest);
    const model = c2.plotData().find(d => d.pointStyle instanceof HTMLImageElement)!;
    expect(levelIndex).toBeGreaterThanOrEqual(0);
    expect(radius[levelIndex]).toBe(model.radius);
    expect(style[levelIndex]).toBe(model.pointStyle);

    const c3 = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    expect(c3.specialMarkers3d().axisBestIds.has('cheapLevel@low')).toBe(true);
    const levelTrace = c3.traces().find(t => t.name.endsWith('effort levels')) as any;
    const index = c3.shownEffortCurves()[0].points.findIndex(p => p.id === 'cheapLevel@low');
    const axisBestTrace = c3.traces().find(t => t.name === 'Best per axis') as any;
    expect(drawnArraySize(levelTrace.marker.size[index], levelTrace.marker.sizeref)).toBe(axisBestTrace.marker.size);
  });
});
