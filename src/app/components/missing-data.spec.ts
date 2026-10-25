import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {BarChartComponent} from './bar-chart/bar-chart';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';
import {DataTableComponent} from './data-table/data-table';

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
