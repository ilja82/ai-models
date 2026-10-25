import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {EffortLevel} from '../models/ai-model.model';
import {effortLabelFont, effortLabelOffset, ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';

describe('label of the current effort level', () => {
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
        id: 'c',
        publicName: 'Claude',
        effort: 'max',
        costsToRun: 40,
        overallIntelligence: 60,
        efforts: [level('low', 40, 5), level('high', 55, 20), level('max', 60, 40)],
      }),
      testModel({id: 'other', publicName: 'Other', costsToRun: 10, overallIntelligence: 30}),
    ]);
    state.disabledModelIds.set(new Set());
  });

  it('2D scatter draws the current level label beside the model marker in the style of the model point', () => {
    state.plotType.set('cost');
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance as any;
    const drawn: { text: string; x: number; y: number; font: string; color: string }[] = [];
    const ctx = {
      font: '', fillStyle: '', textAlign: '', textBaseline: '',
      save: () => undefined, restore: () => undefined,
      fillText(text: string, x: number, y: number) {
        drawn.push({text, x, y, font: this.font, color: this.fillStyle});
      },
    };
    const axis = {getPixelForValue: (v: number) => v * 10, left: 0, right: 1000, top: 0, bottom: 1000};
    c.effortLabelPlugin().afterDatasetsDraw({ctx, scales: {x: axis, y: axis}});

    expect(drawn.map(d => d.text)).toEqual(['low', 'high', 'max']);
    const index = c.plotted().findIndex((p: any) => p.model.id === 'c');
    const model = c.plotData()[index];
    const offset = effortLabelOffset(model.radius);
    expect(drawn[2]).toMatchObject({x: model.x * 10 + offset.dx, y: model.y * 10 + offset.dy});
    const role = {useful: model.isUseful, axisBest: model.axisBest, balanced: model.balanced};
    expect(role.useful).toBe(true);
    expect(drawn[2].font).toBe(effortLabelFont(role));
    expect(drawn[2].color).toBe(c.effortLabelColor(c.effortCurves()[0], role));
  });

  it('3D scatter labels the current level beside the model marker in the style of the model label', () => {
    state.scatter3dX.set('tokensPerSecond');
    state.scatter3dY.set('costsToRun');
    state.scatter3dZ.set('intelligence');
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    const labels = c.labels3d();
    const modelLabel = labels.find(l => l.id === 'c')!;
    const current = labels.find(l => l.id === 'c@max')!;
    expect(current).toMatchObject({text: 'max', side: 'right', marker: modelLabel.marker, point: modelLabel.point});
    expect(modelLabel.bold).toBe(true);
    expect(current).toMatchObject({size: modelLabel.size, bold: modelLabel.bold, color: modelLabel.color, rank: modelLabel.rank});
    expect(new Set(labels.map(l => l.id)).size).toBe(labels.length);
  });
});
