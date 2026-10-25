import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';

describe('best balanced marker on a log axis', () => {
  let state: AppState;
  beforeEach(() => {
    localStorage.clear();
    state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'cheap', costsToRun: 1, overallIntelligence: 40}),
      testModel({id: 'mid', costsToRun: 10, overallIntelligence: 50}),
      testModel({id: 'pricey', costsToRun: 1000, overallIntelligence: 1}),
    ]);
    state.disabledModelIds.set(new Set());
  });

  it('follows the log x axis of the cost plot', () => {
    state.plotType.set('cost');
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance;
    state.logScaleX.set(true);
    expect(c.specialMarkers2d().balancedId).toBe('cheap');
    state.logScaleX.set(false);
    expect(c.specialMarkers2d().balancedId).toBe('mid');
  });

  it('follows the log scale of the 3D cost axis', () => {
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('contextWindow');
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    state.logScale3d.set(true);
    expect(c.specialMarkers3d().balancedId).toBe('cheap');
    state.logScale3d.set(false);
    expect(c.specialMarkers3d().balancedId).toBe('mid');
  });
});
