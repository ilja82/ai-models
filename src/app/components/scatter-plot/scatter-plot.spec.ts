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
