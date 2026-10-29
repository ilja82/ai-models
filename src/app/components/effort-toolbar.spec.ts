import {Type} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {EffortLevel} from '../models/ai-model.model';
import {PlotType} from '../models/view-types';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';

describe('effort levels in the plot toolbars', () => {
  const level = (effort: string, overallIntelligence: number): EffortLevel => ({
    effort, overallIntelligence, intelligenceEstimatedFrom: null, costsToRun: 10, tokensPerRun: 100,
    inputTokensPerRun: 90, outputTokensPerRun: 10, cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1,
    thinkingTime: 2, outputTime: 3,
  });

  beforeEach(() => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([testModel({id: 'e', effort: 'high', efforts: [level('low', 30), level('high', 50)]})]);
    state.disabledModelIds.set(new Set());
    // jsdom has no canvas context, so Chart.js cannot draw.
    const proto = ScatterPlotComponent.prototype as any;
    vi.spyOn(proto, 'initChart').mockImplementation(() => undefined);
    vi.spyOn(proto, 'updateChart').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  const render = <T>(component: Type<T>) => {
    const fixture = TestBed.createComponent(component);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const texts = (selector: string) => Array.from(el.querySelectorAll(selector)).map(e => e.textContent!.trim());
    return {fixture, toggles: () => texts('.toggle-label'), legend: () => texts('.legend-item')};
  };

  for (const plotType of ['cost', 'speed', 'responseVsIntel', 'responseVsSpeed', 'costVsResponse'] as PlotType[]) {
    it(`shows the effort levels without a toggle on the ${plotType} plot`, () => {
      TestBed.inject(AppState).plotType.set(plotType);
      const {fixture, toggles, legend} = render(ScatterPlotComponent);
      expect(fixture.componentInstance.effortCurves().length).toBe(1);
      expect(legend()).toContain('Effort levels');
      expect(toggles()).not.toContain('Effort levels');
      expect(toggles()).toContain('Pareto only');
    });
  }

  it('shows the effort levels without a toggle in the 3D plot', () => {
    const {fixture, toggles, legend} = render(Scatter3dPlotComponent);
    expect(fixture.componentInstance.effortCurves().length).toBe(1);
    expect(legend()).toContain('Effort levels');
    expect(toggles()).not.toContain('Effort levels');
    expect(toggles()).toContain('Pareto only');
  });
});
