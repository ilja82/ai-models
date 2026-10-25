import {Type} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {BarChartComponent} from './bar-chart/bar-chart';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';

describe('order of the chart switcher buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([testModel({id: 'a'})]);
    state.disabledModelIds.set(new Set());
    // jsdom has no canvas context, so Chart.js cannot draw.
    for (const proto of [BarChartComponent.prototype, ScatterPlotComponent.prototype] as any[]) {
      vi.spyOn(proto, 'initChart').mockImplementation(() => undefined);
      vi.spyOn(proto, 'updateChart').mockImplementation(() => undefined);
    }
  });

  afterEach(() => vi.restoreAllMocks());

  const buttons = <T>(component: Type<T>, selector: string) => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector)).map(e => e.textContent!.trim());
  };

  it('puts the most important bar metrics on the left', () => {
    expect(buttons(BarChartComponent, '.metric-btn')).toEqual([
      'Intelligence', 'Run Cost', 'Response Time', 'Tokens/sec', 'Latency',
      'Input Cost', 'Output Cost', 'Context', 'Max Output', 'Max Input',
    ]);
  });

  it('puts the most important scatter plots on the left', () => {
    expect(buttons(ScatterPlotComponent, '.plot-btn')).toEqual([
      'Cost vs Intelligence', 'Price vs Intelligence', 'Response Time vs Intelligence', 'Cost vs Response Time',
      'Tokens/s vs Intelligence', 'Response Time vs Speed', 'Context vs Intelligence', 'Release vs Intelligence',
    ]);
  });

  it('puts the most important 3D axes on top of each axis picker', () => {
    const options = buttons(Scatter3dPlotComponent, '.axis-picker option');
    const order = [
      'Overall Intelligence', 'Cost per Index Run (USD)', 'Response Time (s)', 'Speed (tok/s)',
      'Input Processing (s)', 'Thinking Time (s)', 'Output Time (s)', 'Input Cost ($/M)', 'Output Cost ($/M)',
      'Context Window (tokens)', 'Max Output Tokens', 'Max Input Tokens', 'Min VRAM (GB)', 'Release Date',
    ];
    expect(options).toEqual([...order, ...order, ...order]);
  });
});
