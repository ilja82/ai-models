import {TestBed} from '@angular/core/testing';
import {AXIS_DEFS, Scatter3dPlotComponent} from './scatter-3d-plot';
import {AxisField} from '../../models/view-types';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';

describe('Scatter3dPlot axes', () => {
  it('offers a log scale for the time axes', () => {
    const times: AxisField[] = ['inputProcessingTime', 'thinkingTime', 'outputTime', 'responseTime'];
    const logKeys = AXIS_DEFS.filter(a => a.logCandidate).map(a => a.key);
    expect(logKeys).toEqual(expect.arrayContaining(times));
  });
});

describe('Scatter3dPlot regions', () => {
  it('draws the regions as edges, so they do not block the hover of the points inside', () => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'a', costsToRun: 1, overallIntelligence: 40, contextWindow: 100_000}),
      testModel({id: 'b', costsToRun: 100, overallIntelligence: 50, contextWindow: 1_000_000}),
    ]);
    state.disabledModelIds.set(new Set());
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    const traces = TestBed.createComponent(Scatter3dPlotComponent).componentInstance.traces() as any[];
    const regions = traces.filter(t => t.name === 'Most attractive' || t.name === 'Least attractive');
    expect(regions.length).toBe(2);
    expect(traces.map(t => t.type)).not.toContain('mesh3d');
    for (const r of regions) {
      expect([r.type, r.mode, r.hoverinfo]).toEqual(['scatter3d', 'lines', 'skip']);
      expect(r.x.filter((v: number | null) => v === null).length).toBe(12);
    }
  });
});

describe('Scatter3dPlot axis ranges', () => {
  it('fit the shown models when a model is switched off', () => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'a', costsToRun: 1, overallIntelligence: 40, contextWindow: 100_000}),
      testModel({id: 'b', costsToRun: 100, overallIntelligence: 50, contextWindow: 1_000_000}),
      testModel({id: 'c', costsToRun: 50, overallIntelligence: 90, contextWindow: 500_000}),
    ]);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(false);
    state.logScale3d.set(false);
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    const yRange = () => (c.layout() as any).scene.yaxis.range as number[];
    expect(yRange()).toEqual([37.5, 92.5]);
    state.toggleModel('c');
    expect(yRange()).toEqual([39.5, 50.5]);
  });

  it('keep their range when Pareto only is toggled', () => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'best', costsToRun: 1, overallIntelligence: 90, contextWindow: 1_000_000}),
      testModel({id: 'worse', costsToRun: 100, overallIntelligence: 40, contextWindow: 100_000}),
    ]);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(false);
    state.logScale3d.set(false);
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    const yRange = () => (c.layout() as any).scene.yaxis.range as number[];
    const before = yRange();
    state.showOnlyPareto.set(true);
    expect(c.shownModels().map(m => m.id)).toEqual(['best']);
    expect(yRange()).toEqual(before);
  });
});
