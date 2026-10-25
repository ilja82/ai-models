import {TestBed} from '@angular/core/testing';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';
import {effortLabelFont, effortPointRadius, MarkerRole, modelLabelFont, modelPointRadius, ScatterPlotComponent, STAR_SIZE} from './scatter-plot';

const plain: MarkerRole = {balanced: false, axisBest: false, useful: false};
const pareto: MarkerRole = {...plain, useful: true};
const axisBest: MarkerRole = {...pareto, axisBest: true};
const balanced: MarkerRole = {...pareto, balanced: true};
const fontSize = (font: string) => Number(/(\d+)px/.exec(font)![1]);

describe('highlighted 2D markers', () => {
  it('draws Pareto, best per axis and best balanced points larger in this order', () => {
    for (const radius of [modelPointRadius, effortPointRadius]) {
      expect(radius(pareto)).toBeGreaterThan(radius(plain));
      expect(radius(axisBest)).toBeGreaterThan(radius(pareto));
      expect(radius(balanced)).toBeGreaterThan(radius(axisBest));
    }
  });

  it('fits the star image to the best per axis radius', () => {
    expect(modelPointRadius(axisBest) * 2).toBe(STAR_SIZE);
    expect(effortPointRadius(axisBest) * 2).toBe(STAR_SIZE);
  });

  it('writes the highlighted labels bold and larger', () => {
    for (const font of [modelLabelFont, effortLabelFont]) {
      expect(font(plain)).not.toContain('bold');
      for (const role of [pareto, axisBest, balanced]) {
        expect(font(role)).toContain('bold');
        expect(fontSize(font(role))).toBeGreaterThan(fontSize(font(plain)));
      }
    }
  });

  it('places the highlighted labels before the others, so they win the free places', () => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'plain', publicName: 'Plain', costsToRun: 100, overallIntelligence: 10}),
      testModel({id: 'cheap', publicName: 'Cheap', costsToRun: 1, overallIntelligence: 20}),
      testModel({id: 'mid', publicName: 'Mid', costsToRun: 4, overallIntelligence: 45}),
      testModel({id: 'smart', publicName: 'Smart', costsToRun: 64, overallIntelligence: 70}),
    ]);
    state.disabledModelIds.set(new Set());
    state.showEfforts.set(false);
    state.plotType.set('cost');
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance as any;
    expect(c.plotData()[0].radius).toBe(modelPointRadius(plain));

    const drawn: { text: string; font: string }[] = [];
    const ctx = {
      font: '', fillStyle: '', textAlign: '',
      save: () => undefined, restore: () => undefined,
      measureText: (t: string) => ({width: t.length * 7}),
      fillText(text: string) {
        drawn.push({text, font: this.font});
      },
    };
    const axis = {getPixelForValue: (v: number) => v * 10, left: 0, right: 1000, top: 0, bottom: 1000};
    c.labelPlugin().afterDatasetsDraw({ctx, scales: {x: axis, y: axis}});
    expect(drawn.map(d => d.text).at(-1)).toBe('Plain');
    expect(drawn.at(-1)!.font).not.toContain('bold');
    for (const d of drawn.slice(0, -1)) expect(d.font).toContain('bold');
  });
});
