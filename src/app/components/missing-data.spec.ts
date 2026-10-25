import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {BarChartComponent} from './bar-chart/bar-chart';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';
import {DataTableComponent} from './data-table/data-table';
import {ModelProfilesComponent} from './model-profiles/model-profiles';

// The components are created without change detection, so ngOnInit (canvas, Plotly) does not run in jsdom.
describe('charts with missing measurements', () => {
  const full = testModel({id: 'full', publicName: 'Full'});
  const noTokens = testModel({id: 'no-tokens', publicName: 'No Tokens', tokensPerRun: null, costsToRun: null});
  const noTimes = testModel({id: 'no-times', publicName: 'No Times', tokensPerSecond: null, thinkingTime: null});

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([full, noTokens, noTimes]);
    state.disabledModelIds.set(new Set());
  });

  const ids = (models: { id: string }[]) => models.map(m => m.id);

  it('scatter plot leaves out models without a value on an axis', () => {
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('price');
    expect(ids(c.plotted().map(p => p.model))).toEqual(['full', 'no-tokens', 'no-times']);
    expect(c.missingModels()).toEqual([]);
    state.plotType.set('responseVsSpeed');
    expect(ids(c.missingModels())).toEqual(['no-times']);
    state.plotType.set('context');
    expect(c.missingModels()).toEqual([]);
  });

  it('bar chart leaves out models without the metric', () => {
    const c = TestBed.createComponent(BarChartComponent).componentInstance;
    state.barMetric.set('latency');
    expect(ids(c.chartData().models)).toEqual(['full', 'no-tokens']);
    expect(ids(c.chartData().missing)).toEqual(['no-times']);
    state.barMetric.set('costsToRun');
    expect(ids(c.chartData().missing)).toEqual(['no-tokens']);
  });

  it('3D scatter needs a value on all three axes', () => {
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.scatter3dX.set('tokensPerSecond');
    state.scatter3dY.set('costsToRun');
    state.scatter3dZ.set('intelligence');
    expect(ids(c.plotModels())).toEqual(['full']);
    expect(ids(c.missingModels())).toEqual(['no-tokens', 'no-times']);
  });

  it('Pareto set ignores models without a run cost', () => {
    expect(state.usefulModelIds().has('no-tokens')).toBe(false);
  });

  it('price Pareto set keeps models without a run cost', () => {
    state.allModels.set([full, testModel({
      id: 'cheap', overallIntelligence: 30, inputCosts: 0.1, outputCosts: 0.2,
      tokensPerRun: null, costsToRun: null
    }), testModel({id: 'worse', overallIntelligence: 20})]);
    expect([...state.usefulPriceModelIds()]).toEqual(['full', 'cheap']);
  });

  it('marks Pareto-efficient effort levels in the 2D and the 3D scatter plot', () => {
    const levels = [
      {effort: 'low', overallIntelligence: 35, costsToRun: 2},
      {effort: 'high', overallIntelligence: 40, costsToRun: 10},
    ].map(l => ({
      ...l,
      tokensPerRun: 1,
      inputTokensPerRun: 1,
      outputTokensPerRun: 0,
      cacheHitRate: null,
      tokensPerSecond: 50,
      inputProcessingTime: 1,
      thinkingTime: 2,
      outputTime: 3
    }));
    state.allModels.set([testModel({id: 'e', effort: 'high', efforts: levels}), testModel({id: 'mid', overallIntelligence: 30, costsToRun: 5})]);

    const c2 = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('speed');
    expect(c2.effortCurves()[0].points.map(p => [p.effort, p.useful])).toEqual([['low', true], ['high', false]]);

    const c3 = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.scatter3dX.set('tokensPerSecond');
    state.scatter3dY.set('costsToRun');
    state.scatter3dZ.set('intelligence');
    expect(c3.effortCurves().map(c => c.points.map(p => p.id))).toEqual([['e@low', 'e']]);
    expect([...c3.useful3d()].sort()).toEqual(['e', 'e@low']);
    state.showEfforts.set(false);
    expect(c3.effortCurves()).toEqual([]);
    expect([...c3.useful3d()].sort()).toEqual(['e', 'mid']);
  });

  it('marks an effort level as best balanced and best per axis in the scatter plots, and as best balanced in the profiles', () => {
    const levels = [
      {effort: 'low', overallIntelligence: 38, costsToRun: 2, tokensPerSecond: 80},
      {effort: 'high', overallIntelligence: 40, costsToRun: 10, tokensPerSecond: 50},
    ].map(l => ({
      ...l,
      tokensPerRun: 1,
      inputTokensPerRun: 1,
      outputTokensPerRun: 0,
      cacheHitRate: null,
      inputProcessingTime: 1,
      thinkingTime: 2,
      outputTime: 3
    }));
    state.allModels.set([testModel({id: 'e', effort: 'high', efforts: levels}), testModel({id: 'mid', overallIntelligence: 30, costsToRun: 5})]);

    const c2 = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('speed');
    expect(c2.specialMarkers2d().balancedId).toBe('e@low');
    expect(c2.effortCurves()[0].points.map(p => [p.effort, p.balanced])).toEqual([['low', true], ['high', false]]);
    expect([...c2.specialMarkers2d().axisBestIds].sort()).toEqual(['e', 'e@low']);
    expect(c2.effortCurves()[0].points.map(p => [p.effort, p.axisBest])).toEqual([['low', true], ['high', false]]);

    const c3 = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.scatter3dX.set('tokensPerSecond');
    state.scatter3dY.set('costsToRun');
    state.scatter3dZ.set('intelligence');
    expect(c3.specialMarkers3d().balancedId).toBe('e@low');
    expect([...c3.specialMarkers3d().axisBestIds].sort()).toEqual(['e', 'e@low']);

    const profiles = TestBed.createComponent(ModelProfilesComponent).componentInstance;
    expect(profiles.balancedIds().overall).toBe('e@low');
    const badge = profiles.profiles().find(p => p.model.id === 'e')!.badges.find(b => b.id === 'best-balanced-overall');
    expect(badge?.label).toBe('Best balanced at overall (effort: low)');

    state.showEfforts.set(false);
    expect([...c2.specialMarkers2d().axisBestIds]).not.toContain('e@low');
    expect([...c3.specialMarkers3d().axisBestIds]).not.toContain('e@low');
    expect(c2.specialMarkers2d().balancedId).not.toContain('@');
    expect(c3.specialMarkers3d().balancedId).not.toContain('@');
    expect(profiles.balancedIds().overall).not.toContain('@');
  });

  it('table sorts missing values last in both directions', () => {
    const c = TestBed.createComponent(DataTableComponent).componentInstance;
    c.sort('costsToRun');
    expect(ids(c.tableModels()).at(-1)).toBe('no-tokens');
    c.sort('costsToRun');
    expect(ids(c.tableModels()).at(-1)).toBe('no-tokens');
    expect(c.formatCost(null)).toBe('—');
    expect(c.formatTime(null)).toBe('—');
  });
});
