import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {EffortLevel} from '../models/ai-model.model';
import {shortEffortLabel} from '../models/effort.util';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';
import {DataTableComponent} from './data-table/data-table';

describe('show only Pareto best', () => {
  const level = (effort: string, overallIntelligence: number, costsToRun: number): EffortLevel => ({
    effort, overallIntelligence, costsToRun, tokensPerRun: 1, inputTokensPerRun: 1, outputTokensPerRun: 0,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({
        id: 'e',
        publicName: 'Eve',
        effort: 'high',
        costsToRun: 10,
        overallIntelligence: 40,
        efforts: [level('low', 35, 2), level('high', 40, 10)]
      }),
      testModel({id: 'mid', publicName: 'Mid', overallIntelligence: 30, costsToRun: 5}),
      testModel({id: 'pricey', publicName: 'Pricey', overallIntelligence: 39, costsToRun: 100}),
      testModel({
        id: 'f',
        publicName: 'Foo',
        effort: 'high',
        costsToRun: 20,
        overallIntelligence: 34,
        efforts: [level('low', 20, 0.5), level('high', 34, 20)]
      }),
    ]);
    state.disabledModelIds.set(new Set());
  });

  const ids = (models: { id: string }[]) => models.map(m => m.id);

  it('is off by default and highlights the Pareto set anyway', () => {
    expect(state.showOnlyPareto()).toBe(false);
    const table = TestBed.createComponent(DataTableComponent).componentInstance;
    expect(ids(table.tableModels()).sort()).toEqual(['e', 'f', 'mid', 'pricey']);
    expect(table.isUseful('e')).toBe(true);
    expect(table.isUseful('mid')).toBe(false);
    const c2 = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('cost');
    expect(c2.plotData().map(d => d.isUseful)).toEqual([true, false, false, false]);
  });

  it('table shows only the models in the Pareto set', () => {
    state.showOnlyPareto.set(true);
    const table = TestBed.createComponent(DataTableComponent).componentInstance;
    expect(ids(table.tableModels())).toEqual(['e']);
  });

  it('2D scatter shows only the Pareto models and effort levels', () => {
    state.showOnlyPareto.set(true);
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('cost');
    expect(ids(c.plotted().map(p => p.model))).toEqual(['e']);
    expect(c.missingModels()).toEqual([]);
    expect(c.effortCurves().map(curve => [curve.model.id, curve.points.map(p => p.effort)]))
      .toEqual([['e', ['low', 'high']], ['f', ['low']]]);
    expect(c.effortCurves().map(curve => curve.points.map(p => p.label)))
      .toEqual([[shortEffortLabel('low'), shortEffortLabel('high')], [`Foo ${shortEffortLabel('low')}`]]);
  });

  it('ranks the best balanced and best per axis markers over all points, also while the filter is on', () => {
    const c2 = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const c3 = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.plotType.set('cost');
    state.scatter3dX.set('tokensPerSecond');
    state.scatter3dY.set('costsToRun');
    state.scatter3dZ.set('intelligence');
    const markers = () => [c2.specialMarkers2d().balancedId, [...c2.specialMarkers2d().axisBestIds].sort(),
      c3.specialMarkers3d().balancedId, [...c3.specialMarkers3d().axisBestIds].sort()];
    const off = markers();
    expect(off[0]).toBe('e@low');
    state.showOnlyPareto.set(true);
    expect(markers()).toEqual(off);

    const [e, , , f] = state.allModels();
    state.allModels.set([{...e, efforts: [...e.efforts, level('xhigh', 39, 100)]}, f]);
    const withLevel = markers();
    expect([withLevel[0], withLevel[2]]).toEqual(['e@low', 'e@low']);
    state.showOnlyPareto.set(false);
    expect(markers()).toEqual(withLevel);
  });

  it('3D scatter shows only the Pareto models and effort levels of the three axes', () => {
    state.showOnlyPareto.set(true);
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.scatter3dX.set('tokensPerSecond');
    state.scatter3dY.set('costsToRun');
    state.scatter3dZ.set('intelligence');
    expect(ids(c.shownModels())).toEqual(['e']);
    expect(ids(c.missingModels())).toEqual([]);
    expect(c.shownEffortCurves().map(curve => [curve.model.id, ids(curve.points)]))
      .toEqual([['e', ['e@low', 'e']], ['f', ['f@low']]]);
    const names = c.traces().flatMap((t: any) => t.type === 'scatter3d' && t.mode === 'markers+text' ? t.text : []);
    expect(names).toEqual(['Eve']);
    const effortTexts = c.traces().flatMap((t: any) => t.mode === 'lines+markers+text' ? [t.text] : []);
    expect(effortTexts).toEqual([[shortEffortLabel('low'), shortEffortLabel('high')], [`Foo ${shortEffortLabel('low')}`]]);
  });
});

describe('Pareto set per plot type', () => {
  const level = (effort: string, overallIntelligence: number, costsToRun: number): EffortLevel => ({
    effort, overallIntelligence, costsToRun, tokensPerRun: 1, inputTokensPerRun: 1, outputTokensPerRun: 0,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.disabledModelIds.set(new Set());
  });

  it('ranks the two axes of the current plot type', () => {
    state.allModels.set([
      testModel({id: 'smart', overallIntelligence: 50, costsToRun: 10, tokensPerSecond: 40, contextWindow: 100_000}),
      testModel({id: 'fast', overallIntelligence: 30, costsToRun: 20, tokensPerSecond: 200, contextWindow: 50_000}),
      testModel({id: 'long', overallIntelligence: 20, costsToRun: 30, tokensPerSecond: 30, contextWindow: 1_000_000}),
    ]);
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const useful = () => [...c.usefulIds()].sort();
    state.plotType.set('cost');
    expect(useful()).toEqual(['smart']);
    state.plotType.set('speed');
    expect(useful()).toEqual(['fast', 'smart']);
    state.plotType.set('context');
    expect(useful()).toEqual(['long', 'smart']);
    expect(c.plotData().map(d => d.isUseful)).toEqual([true, false, true]);
    state.showOnlyPareto.set(true);
    expect(ids(c.plotted().map(p => p.model))).toEqual(['smart', 'long']);
  });

  it('ranks lower values as better on a reversed y axis', () => {
    state.allModels.set([
      testModel({id: 'quick', costsToRun: 10, inputProcessingTime: 0, thinkingTime: 0, outputTime: 1}),
      testModel({id: 'slow', costsToRun: 10, inputProcessingTime: 0, thinkingTime: 9, outputTime: 1}),
      testModel({id: 'cheap', costsToRun: 1, inputProcessingTime: 0, thinkingTime: 20, outputTime: 1}),
    ]);
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('costVsResponse');
    expect([...c.usefulIds()].sort()).toEqual(['cheap', 'quick']);
  });

  it('ranks only the models on the price plot, without their effort levels', () => {
    state.allModels.set([
      testModel({
        id: 'a', overallIntelligence: 50, tokensPerRun: 100, effort: 'high',
        efforts: [{...level('low', 35, 2), tokensPerRun: 10}, level('high', 50, 10)],
      }),
      testModel({id: 'b', overallIntelligence: 30, inputCosts: 0.5, outputCosts: 0.5}),
      testModel({id: 'c', overallIntelligence: 40, inputCosts: 0.2, outputCosts: 0.2}),
    ]);
    const plot = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('price');
    expect([...plot.usefulIds()].sort()).toEqual(['a', 'c']);
  });

  const ids = (models: { id: string }[]) => models.map(m => m.id);
});

describe('show only Pareto best persistence', () => {
  afterEach(() => localStorage.clear());

  it('ignores the stored value of the removed highlight toggle', () => {
    localStorage.setItem('ai-models.showUsefulModels', 'true');
    expect(TestBed.inject(AppState).showOnlyPareto()).toBe(false);
  });
});
