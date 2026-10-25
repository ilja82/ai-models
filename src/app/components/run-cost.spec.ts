import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {BarChartComponent} from './bar-chart/bar-chart';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';
import {DataTableComponent} from './data-table/data-table';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {EffortLevel} from '../models/ai-model.model';

describe('run cost with estimated tokens and cost per request', () => {
  const measured = testModel({id: 'measured', publicName: 'Measured', costsToRun: 20, totalSpend: 10, totalRequests: 100});
  const estimated = testModel({id: 'estimated', publicName: 'Estimated', costsToRun: 10, tokensPerRunEstimated: true});

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([measured, estimated]);
    state.disabledModelIds.set(new Set());
  });

  it('bar chart draws a bar with estimated tokens hollow, only for the run cost', () => {
    const c = TestBed.createComponent(BarChartComponent).componentInstance;
    state.barMetric.set('costsToRun');
    const seg = c.chartData().segments[0];
    expect(seg.borderWidth).toEqual([1.5, 0]);
    expect((seg.color as string[])[0]).toMatch(/0\.15\)$/);
    expect((seg.color as string[])[1]).toBe(seg.borderColor![1]);
    expect(c.legendItems().map(i => i.label)).toContain('Estimated tokens (hollow)');
    state.barMetric.set('inputCosts');
    expect(c.chartData().segments[0].borderWidth).toEqual([0, 0]);
    expect(c.legendItems().map(i => i.label)).not.toContain('Estimated tokens (hollow)');
  });

  it('3D scatter shows a model with estimated tokens open, only on a cost axis', () => {
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.scatter3dX.set('tokensPerSecond');
    state.scatter3dY.set('costsToRun');
    state.scatter3dZ.set('intelligence');
    const symbols = () => c.traces().flatMap((t: any) => t.type === 'scatter3d' && t.mode === 'markers+text'
      ? t.text.map((name: string, i: number) => [name, t.marker.symbol[i]]) : []);
    expect(symbols()).toContainEqual(['Estimated', expect.stringMatching(/-open$/)]);
    expect(symbols()).not.toContainEqual(['Measured', 'circle-open']);
    state.scatter3dY.set('inputCosts');
    expect(symbols().find(([name]: string[]) => name === 'Estimated')[1]).not.toBe('circle-open');
  });

  it('table sorts by cost per request with missing values last', () => {
    const cheap = testModel({id: 'cheap', totalSpend: 1, totalRequests: 100});
    state.allModels.set([measured, estimated, cheap]);
    const c = TestBed.createComponent(DataTableComponent).componentInstance;
    c.sortByComputed('costPerRequest');
    expect(c.tableModels().map(m => m.id)).toEqual(['cheap', 'measured', 'estimated']);
    c.sortByComputed('costPerRequest');
    expect(c.tableModels().map(m => m.id)).toEqual(['measured', 'cheap', 'estimated']);
    expect(c.formatCost(c.costPerRequest(measured))).toBe('$0.10');
    expect(c.formatCost(c.costPerRequest(estimated))).toBe('—');
    expect(c.runCostTitle(estimated)).toContain('Estimated');
    expect(c.runCostTitle(measured)).toBeNull();
  });

  it('cost plot shows the run cost on the x axis, a model with estimated tokens hollow', () => {
    const noCost = testModel({id: 'no-cost', costsToRun: null, tokensPerRun: null});
    state.allModels.set([measured, estimated, noCost]);
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('cost');
    state.logScaleX.set(false);
    expect(c.plotted().map(p => [p.model.id, p.x])).toEqual([['measured', 20], ['estimated', 10]]);
    expect(c.missingModels().map(m => m.id)).toEqual(['no-cost']);
    expect(c.plotData().map(d => d.hollow)).toEqual([false, true]);
    state.plotType.set('price');
    expect(c.plotData().map(d => d.hollow)).toEqual([false, false, false]);
  });

  it('cost plot draws the effort line through the model point with the level run costs', () => {
    const level = (effort: string, costsToRun: number | null, overallIntelligence: number): EffortLevel => ({
      effort, overallIntelligence, costsToRun, tokensPerRun: null, inputTokensPerRun: null, outputTokensPerRun: null,
      cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
    });
    const m = testModel({
      id: 'e', effort: 'high', costsToRun: 30, overallIntelligence: 40, tokensPerRunEstimated: true,
      efforts: [level('low', 5, 30), level('medium', null, 35), level('high', null, 40)],
    });
    state.allModels.set([m]);
    state.logScaleX.set(false);
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('cost');
    expect(c.effortCurves()[0].points.map(p => [p.effort, p.x, p.current])).toEqual([['low', 5, false], ['high', 30, true]]);
  });
});
