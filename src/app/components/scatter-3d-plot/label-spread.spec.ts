import {TestBed} from '@angular/core/testing';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';
import {baseOffset, Label3d, labelAnnotation, Scatter3dPlotComponent, shiftsFromRects} from './scatter-3d-plot';

const label = (id: string, rank: number, side: Label3d['side'] = 'top'): Label3d => ({
  id, point: testModel({id}), text: id, color: '#123456', size: 10, bold: false, rank, marker: 10, side,
});

describe('3D label spreading', () => {
  it('moves the lower ranked of two labels drawn on the same place', () => {
    const labels = [label('plain', 0), label('pareto', 1)];
    const rect = {x: 100, y: 100, w: 60, h: 14};
    const shifts = shiftsFromRects(labels, [rect, rect], [{dx: 0, dy: 0}, {dx: 0, dy: 0}]);
    expect(shifts[1]).toEqual({dx: 0, dy: 0});
    expect(shifts[0]).not.toEqual({dx: 0, dy: 0});
  });

  it('measures from the base place, so a drawn shift does not add up', () => {
    const labels = [label('plain', 0), label('pareto', 1)];
    const rect = {x: 100, y: 100, w: 60, h: 14};
    const first = shiftsFromRects(labels, [rect, rect], [{dx: 0, dy: 0}, {dx: 0, dy: 0}]);
    const drawn = {x: rect.x + first[0].dx, y: rect.y + first[0].dy, w: rect.w, h: rect.h};
    expect(shiftsFromRects(labels, [drawn, rect], first)).toEqual(first);
  });

  it('keeps a label off the marker of a highlighted point', () => {
    const labels = [label('star', 2, 'right'), label('plain', 0)];
    const {ax} = baseOffset(labels[0]);
    const star = {x: 100 + ax, y: 100 - 7, w: 50, h: 14};
    const onMarker = {x: 60, y: 100 - 7, w: 44, h: 14};
    const [, shift] = shiftsFromRects(labels, [star, onMarker], [{dx: 0, dy: 0}, {dx: 0, dy: 0}]);
    expect(shift).not.toEqual({dx: 0, dy: 0});
  });

  it('skips a label that is not drawn', () => {
    const shifts = shiftsFromRects([label('a', 0)], [null], [{dx: 0, dy: 0}]);
    expect(shifts).toEqual([{dx: 0, dy: 0}]);
  });

  it('draws a line to the point only for a moved label', () => {
    const l = label('a', 0);
    expect(labelAnnotation(l, [0, 0, 0]).arrowcolor).toBe('rgba(0,0,0,0)');
    const movedLabel = labelAnnotation(l, [0, 0, 0], {dx: 0, dy: -20});
    expect(movedLabel.arrowcolor).toBe(l.color);
    expect(movedLabel.ay).toBe(baseOffset(l).ay - 20);
  });

  it('keeps the camera of the viewer across renders and applies the label shifts', () => {
    localStorage.clear();
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'a', costsToRun: 1, overallIntelligence: 40, contextWindow: 100_000}),
      testModel({id: 'b', costsToRun: 100, overallIntelligence: 50, contextWindow: 1_000_000}),
    ]);
    state.disabledModelIds.set(new Set());
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    expect((c.layout() as any).uirevision).toBeTruthy();
    const annotation = () => (c.layout() as any).scene.annotations.find((a: any) => a.text === c.labels3d()[0].text);
    const before = annotation().ay;
    c.labelShifts.set(new Map([[c.labels3d()[0].id, {dx: 0, dy: -30}]]));
    expect(annotation().ay).toBe(before - 30);
  });
});
