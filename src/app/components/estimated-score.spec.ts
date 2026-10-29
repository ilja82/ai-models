import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {BarChartComponent} from './bar-chart/bar-chart';
import {ESTIMATED_OPACITY_3D, Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';
import {DataTableComponent} from './data-table/data-table';
import {drawEstimatedOutline, ESTIMATED_DASH, ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {EffortLevel} from '../models/ai-model.model';
import {effortVariant} from '../models/effort.util';
import {ModelBadgesService} from '../services/model-badges.service';
import {PlotType} from '../models/view-types';

describe('estimated scores', () => {
  const level = (effort: string, overallIntelligence: number, intelligenceEstimatedFrom: number | null): EffortLevel => ({
    effort, overallIntelligence, intelligenceEstimatedFrom, costsToRun: 10, tokensPerRun: 100, inputTokensPerRun: 90,
    outputTokensPerRun: 10, cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });
  const measured = testModel({id: 'measured', publicName: 'Measured', overallIntelligence: 50, costsToRun: 20});
  const estimated = testModel({
    id: 'estimated', publicName: 'Estimated', overallIntelligence: 31.2, intelligenceEstimatedFrom: 43.6,
    benchmarkVersion: 'v4.3.2', costsToRun: 10, effort: 'high',
    efforts: [level('low', 20.5, 30), level('high', 31.2, 43.6)],
  });

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([measured, estimated]);
    state.disabledModelIds.set(new Set());
  });

  it('scatter plot marks an estimated score on the plots with intelligence on the y axis', () => {
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const flags = (plotType: PlotType) => {
      state.plotType.set(plotType);
      return [c.plotData().map(d => d.estimated), c.estimatedShown()];
    };
    for (const plotType of ['cost', 'price', 'responseVsIntel', 'speed', 'context', 'release'] as PlotType[]) {
      expect(flags(plotType), plotType).toEqual([[false, true], true]);
    }
    expect(flags('costVsResponse')).toEqual([[false, false], false]);
    expect(flags('responseVsSpeed')).toEqual([[false, false], false]);
  });

  it('scatter plot gives an estimated point a faint fill and no solid border, so the dashed outline shows', () => {
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('price');
    const [plain, dashed] = c.plotData();
    expect(c.pointFillOf(plain)).toBe(plain.color);
    expect(c.pointBorderWidthOf(plain)).toBeGreaterThan(0);
    expect(c.pointFillOf(dashed)).toMatch(/^rgba\(\d+,\d+,\d+,0\.35\)$/);
    expect(c.pointBorderWidthOf(dashed)).toBe(0);
    expect(c.pointFillOf({...dashed, hollow: true})).toBe('transparent');
  });

  it('scatter plot passes the models to the outdated benchmark hint only on plots with speed or response time', () => {
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    const hinted = (plotType: PlotType) => {
      state.plotType.set(plotType);
      return c.versionedModels().map(m => m.id);
    };
    for (const plotType of ['responseVsIntel', 'costVsResponse', 'speed', 'responseVsSpeed'] as PlotType[]) {
      expect(hinted(plotType), plotType).toEqual(['measured', 'estimated']);
    }
    for (const plotType of ['cost', 'price', 'context', 'release'] as PlotType[]) {
      expect(hinted(plotType), plotType).toEqual([]);
    }
  });

  it('draws the outline of an estimated point dashed in its shape, and a dashed circle around the star image', () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) => key in target ? target[key] : (...args: unknown[]) => calls.push(`${key}(${args.join(',')})`),
      set: (target, key: string, value) => {
        target[key] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    drawEstimatedOutline(ctx, {pointStyle: 'triangle', radius: 7, borderColor: 'red', borderWidth: 1}, 10, 20);
    expect(calls[1]).toBe(`setLineDash(${ESTIMATED_DASH.join(',')})`);
    expect(calls).toContain('stroke()');
    expect(calls).not.toContain('arc(10,20,9,0,6.283185307179586)');
    expect([ctx.strokeStyle, ctx.lineWidth, ctx.fillStyle]).toEqual(['red', 1.5, 'transparent']);
    calls.length = 0;
    drawEstimatedOutline(ctx, {pointStyle: new Image(), radius: 7, borderColor: 'red', borderWidth: 2.5}, 10, 20);
    expect(calls).toContain('arc(10,20,9,0,6.283185307179586)');
    expect(ctx.lineWidth).toBe(2.5);
    expect(calls.at(-1)).toBe('restore()');
  });

  it('bar chart draws the bars with an estimated score dashed and faint, only for the intelligence metric', () => {
    const c = TestBed.createComponent(BarChartComponent).componentInstance;
    state.barGroupByModel.set(true);
    state.barMetric.set('intelligence');
    const seg = c.chartData().segments[0];
    expect(c.chartData().models.map(m => m.id)).toEqual(['measured', 'estimated', 'estimated@low']);
    expect(seg.dashed).toEqual([false, true, true]);
    expect((seg.color as string[]).map(x => x.endsWith('0.15)'))).toEqual([false, true, true]);
    const item = c.legendItems().find(i => i.label === 'Estimated score')!;
    expect(item.border).toMatch(/dashed/);
    expect(item.title).toMatch(/^Estimated from the score of an older Intelligence Index version/);
    expect(c.versionedModels()).toEqual([]);
    state.barMetric.set('costsToRun');
    expect(c.chartData().segments[0].dashed).toEqual([false, false]);
    expect(c.legendItems().map(i => i.label)).not.toContain('Estimated score');
    expect(c.versionedModels()).toEqual([]);
    state.barMetric.set('tokensPerSecond');
    expect(c.versionedModels().map(m => m.id)).toEqual(['measured', 'estimated']);
  });

  it('3D scatter shows a model with an estimated score faint, only while intelligence is an axis', () => {
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('tokensPerSecond');
    state.scatter3dZ.set('intelligence');
    const traceOf = (name: string) => c.traces().find((t: any) => t.mode === 'markers+text' && t.text.includes(name)) as any;
    expect([traceOf('Estimated').marker.opacity, traceOf('Estimated').showlegend]).toEqual([ESTIMATED_OPACITY_3D, false]);
    expect([traceOf('Measured').marker.opacity, traceOf('Measured').showlegend]).toEqual([0.95, true]);
    expect(c.estimatedShown()).toBe(true);
    state.scatter3dZ.set('contextWindow');
    expect(traceOf('Estimated').marker.opacity).toBe(0.95);
    expect(c.estimatedShown()).toBe(false);
  });

  it('3D scatter passes the models to the outdated benchmark hint only while speed or a time is an axis', () => {
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    expect(c.versionedModels()).toEqual([]);
    state.scatter3dZ.set('thinkingTime');
    expect(c.versionedModels().map(m => m.id)).toEqual(['measured', 'estimated']);
  });

  it('profiles show an estimated score and an estimated level score with ~', () => {
    const [profile] = TestBed.inject(ModelBadgesService).computeProfiles([estimated], [measured, estimated], {api: null, local: null});
    expect(profile.metrics.find(m => m.id === 'intelligence')!.text).toBe('~31.2');
    expect(profile.levels.map(l => l.intelligenceText)).toEqual(['~20.5', '~31.2']);
    const [plain] = TestBed.inject(ModelBadgesService).computeProfiles([measured], [measured, estimated], {api: null, local: null});
    expect(plain.metrics.find(m => m.id === 'intelligence')!.text).toBe('50');
    const better = testModel({id: 'better', publicName: 'Better', overallIntelligence: 60, costsToRun: 5});
    const [dominated] = TestBed.inject(ModelBadgesService).computeProfiles([estimated], [estimated, better], {api: null, local: null});
    expect(dominated.alternative?.reason).toBe('intelligence 60 instead of ~31.2, 50% lower run cost');
  });

  it('gives an effort variant the measured score of its level', () => {
    expect(effortVariant(estimated, estimated.efforts[0]).intelligenceEstimatedFrom).toBe(30);
    expect(effortVariant(measured, level('low', 40, null)).intelligenceEstimatedFrom).toBeNull();
  });
});

describe('token counts scaled from an older index run', () => {
  const level = (effort: string, tokensPerRun: number | null): EffortLevel => ({
    effort, overallIntelligence: 30, intelligenceEstimatedFrom: 40, costsToRun: tokensPerRun === null ? null : 5, tokensPerRun,
    inputTokensPerRun: tokensPerRun === null ? null : 90, outputTokensPerRun: tokensPerRun === null ? null : 10,
    cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2, outputTime: 3,
  });
  const measured = testModel({id: 'measured', publicName: 'Measured', overallIntelligence: 50, costsToRun: 20});
  const scaled = testModel({
    id: 'scaled', publicName: 'Scaled', overallIntelligence: 30, intelligenceEstimatedFrom: 40, benchmarkVersion: 'v4.3.2',
    costsToRun: 5, tokensPerRunEstimated: true, tokensPerRunScaled: true, effort: 'high',
    efforts: [level('low', null), level('high', 100)],
  });

  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([measured, scaled]);
    state.disabledModelIds.set(new Set());
  });

  it('draws the run cost hollow on the cost plots and in the bar chart', () => {
    const scatter = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.plotType.set('cost');
    expect(scatter.plotData().map(d => d.hollow)).toEqual([false, true]);
    const bars = TestBed.createComponent(BarChartComponent).componentInstance;
    state.barMetric.set('costsToRun');
    expect(bars.chartData().models.map(m => m.id)).toEqual(['scaled', 'measured']);
    expect(bars.chartData().segments[0].borderWidth).toEqual([1.5, 0]);
  });

  it('names the older run in the title of the run cost', () => {
    const table = TestBed.createComponent(DataTableComponent).componentInstance;
    expect(table.runCostTitle(scaled)).toBe('Token counts estimated for v5.0 from the v4.3.2 run');
    expect(table.runCostTitle(testModel({tokensPerRunEstimated: true}))).toBe(
      'Estimated: the benchmark publishes no token counts for this model');
    expect(table.runCostTitle(measured)).toBeNull();
  });

  it('shows a run cost from estimated token counts with ~ in the profile, also for an effort level', () => {
    const service = TestBed.inject(ModelBadgesService);
    const cost = (p: { metrics: { id: string; text: string }[] }) => p.metrics.find(m => m.id === 'cost')!.text;
    const withLevels = {...scaled, efforts: [level('low', 100), level('high', 100)]};
    const [profile] = service.computeProfiles([withLevels], [measured, withLevels], {api: null, local: null});
    expect(cost(profile)).toBe('~$5.00');
    expect(profile.levels.map(l => l.costText)).toEqual(['~$5.00', '~$5.00']);
    expect(cost(service.computeProfiles([measured], [measured, withLevels], {api: null, local: null})[0])).toBe('$20.00');
    const fit = testModel({id: 'fit', tokensPerRunEstimated: true, costsToRun: 7});
    expect(cost(service.computeProfiles([fit], [measured, fit], {api: null, local: null})[0])).toBe('~$7.00');
  });

  it('marks the token counts of an effort level of a scaled model as scaled, if the level has any', () => {
    const [low, high] = scaled.efforts.map(l => effortVariant(scaled, l));
    expect([low.tokensPerRunScaled, low.tokensPerRunEstimated]).toEqual([false, false]);
    expect([high.tokensPerRunScaled, high.tokensPerRunEstimated]).toEqual([true, true]);
    expect(effortVariant(measured, level('low', 100)).tokensPerRunScaled).toBe(false);
  });
});
