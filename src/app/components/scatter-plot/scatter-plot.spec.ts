import {TestBed} from '@angular/core/testing';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';
import {ScatterPlotComponent} from './scatter-plot';
import {EffortLevel} from '../../models/ai-model.model';
import {PlotType} from '../../models/view-types';

describe('ScatterPlotComponent plot types', () => {
  const level = (effort: string, overallIntelligence: number, outputTime: number): EffortLevel => ({
    effort, overallIntelligence, costsToRun: 10, tokensPerRun: 100, inputTokensPerRun: 90, outputTokensPerRun: 10,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime,
  });
  const fast = testModel({id: 'fast', inputProcessingTime: 0.5, thinkingTime: 0, outputTime: 0.5});
  const slow = testModel({
    id: 'slow', effort: 'high', overallIntelligence: 50, inputProcessingTime: 10, thinkingTime: 20, outputTime: 34,
    efforts: [level('low', 30, 1), level('high', 50, 34)],
  });

  let state: AppState;
  let c: ScatterPlotComponent;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([fast, slow]);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(true);
    state.logScaleX.set(true);
    c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
  });

  it('fits the axes to the shown models when a model is switched off', () => {
    const wide = testModel({id: 'wide', costsToRun: 1, overallIntelligence: 20});
    const cheap = testModel({id: 'cheap', costsToRun: 4, overallIntelligence: 40});
    const dear = testModel({id: 'dear', costsToRun: 64, overallIntelligence: 60});
    state.allModels.set([wide, cheap, dear]);
    state.showEfforts.set(false);
    state.plotType.set('cost');
    expect(c.xBounds()).toEqual({min: 0, max: 6});
    expect(c.yBounds()).toEqual({min: 17, max: 63});
    state.toggleModel('wide');
    expect(c.xBounds()).toEqual({min: 2, max: 6});
    expect(c.yBounds()).toEqual({min: 37, max: 63});
  });

  it('keeps the axes when Pareto only is toggled', () => {
    state.allModels.set([
      testModel({id: 'best', costsToRun: 2, overallIntelligence: 60}),
      testModel({id: 'worse', costsToRun: 256, overallIntelligence: 30}),
    ]);
    state.showEfforts.set(false);
    state.plotType.set('cost');
    expect(c.xBounds()).toEqual({min: 1, max: 8});
    state.showOnlyPareto.set(true);
    expect(c.plotted().map(p => p.model.id)).toEqual(['best']);
    expect(c.xBounds()).toEqual({min: 1, max: 8});
  });

  it('splits the zones at the median of all models, also when the filter hides models', () => {
    state.allModels.set([
      testModel({id: 'a', costsToRun: 1, overallIntelligence: 20}),
      testModel({id: 'b', costsToRun: 4, overallIntelligence: 40}),
      testModel({id: 'c', costsToRun: 9, overallIntelligence: 50}),
      testModel({id: 'outlier', costsToRun: 10000, overallIntelligence: 90}),
      testModel({id: 'no-cost', costsToRun: null, overallIntelligence: 10}),
    ]);
    state.showEfforts.set(false);
    state.plotType.set('cost');
    expect(c.zoneSplit()).toEqual({x: 6.5, y: 45});
    state.toggleModel('outlier');
    state.showOnlyPareto.set(true);
    expect(c.zoneSplit()).toEqual({x: 6.5, y: 45});
  });

  it('keeps the best balanced model when the filter hides an extreme model', () => {
    state.allModels.set([
      testModel({id: 'cheap', costsToRun: 1, overallIntelligence: 40}),
      testModel({id: 'mid', costsToRun: 10, overallIntelligence: 50}),
      testModel({id: 'pricey', costsToRun: 1000, overallIntelligence: 0}),
    ]);
    state.showEfforts.set(false);
    state.logScaleX.set(false);
    state.plotType.set('cost');
    expect(c.specialMarkers2d().balancedId).toBe('mid');
    state.toggleModel('pricey');
    expect(c.specialMarkers2d().balancedId).toBe('mid');
  });

  it('gives a single model at a power of two a log axis one step wide', () => {
    state.allModels.set([testModel({id: 'one', costsToRun: 8})]);
    state.showEfforts.set(false);
    state.plotType.set('cost');
    expect(c.xBounds()).toEqual({min: 3, max: 4});
  });

  it('keeps the shown effort points inside the axes, also a level beyond every model', () => {
    state.allModels.set([fast, testModel({
      id: 'deep', effort: 'high', overallIntelligence: 50, inputProcessingTime: 10, thinkingTime: 20, outputTime: 34,
      efforts: [level('high', 50, 34), level('max', 60, 200)],
    })]);
    state.plotType.set('responseVsIntel');
    const xs = c.effortCurves().flatMap(curve => curve.points.map(p => p.px));
    const {min, max} = c.xBounds();
    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(min!);
      expect(x).toBeLessThanOrEqual(max!);
    }
  });

  for (const plotType of ['price', 'cost'] as PlotType[]) {
    it(`labels each log2 tick of the ${plotType} axis below one cent with its own value`, () => {
      const ticks = c['xAxisConfig'](plotType, true, {min: -10, max: 3}).ticks;
      const labels = [-10, -9, -8, -3, -1, 0].map(v => ticks.callback(v));
      expect(labels).toEqual(['$0.000977', '$0.00195', '$0.00391', '$0.125', '$0.50', '$1.00']);
      expect(ticks.stepSize).toBe(1);
    });
  }

  for (const plotType of ['release', 'context'] as PlotType[]) {
    it(`shows no effort levels on the ${plotType} plot`, () => {
      state.plotType.set(plotType);
      expect(c.effortsShown()).toBe(false);
      expect(c.effortCurves()).toEqual([]);
      state.plotType.set('speed');
      expect(c.effortCurves().length).toBe(1);
    });
  }

  for (const plotType of ['responseVsIntel', 'responseVsSpeed'] as PlotType[]) {
    it(`shows the ${plotType} plot with a log x axis`, () => {
      state.plotType.set(plotType);
      expect(c.currentPlotDef().supportsLogX).toBe(true);
      expect(c.plotData().map(d => d.x)).toEqual([0, 6]);
      expect(c.xBounds()).toEqual({min: 0, max: 6});
      state.logScaleX.set(false);
      expect(c.plotData().map(d => d.x)).toEqual([1, 64]);
    });
  }

  it('shows the run cost against the response time on a log y axis with lower is better on both axes', () => {
    const cheap = testModel({id: 'cheap', costsToRun: 5, inputProcessingTime: 4, thinkingTime: 3, outputTime: 3});
    const quick = testModel({id: 'quick', costsToRun: 20, inputProcessingTime: 0.5, thinkingTime: 0, outputTime: 0.5});
    const guessed = testModel({
      id: 'guessed', costsToRun: 40, tokensPerRunEstimated: true, inputProcessingTime: 10, thinkingTime: 10, outputTime: 10,
    });
    state.allModels.set([cheap, quick, guessed]);
    state.logScaleX.set(false);
    state.plotType.set('costVsResponse');
    expect(c.currentPlotDef()).toMatchObject({reverseX: true, reverseY: true, logY: true, supportsLogX: true});
    expect(c.plotted().map(p => [p.model.id, p.x, p.y])).toEqual([['cheap', 5, 10], ['quick', 20, 1], ['guessed', 40, 30]]);
    expect(c.plotData().map(d => d.hollow)).toEqual([false, false, true]);
    expect(c.specialMarkers2d().axisBestIds).toEqual(new Set(['cheap', 'quick']));
    expect(c.plotData().map(d => d.y)).toEqual([Math.log2(10), 0, Math.log2(30)]);
    expect(c.yBounds()).toEqual({min: 0, max: 5});
    state.plotType.set('responseVsSpeed');
    expect(c.plotData().map(d => d.y)).toEqual([50, 50, 50]);
  });

  it('draws the effort line with the level run costs and response times on the cost vs response time plot', () => {
    state.plotType.set('costVsResponse');
    state.logScaleX.set(false);
    expect(c.effortCurves().map(curve => curve.points.map(p => [p.effort, p.x, p.y, p.py])))
      .toEqual([[['low', 10, 4, 2], ['high', 10, 37, Math.log2(37)]]]);
  });
});
