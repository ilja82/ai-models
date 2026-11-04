import {TestBed} from '@angular/core/testing';
import {AppState} from '../state/app.state';
import {testModel} from '../../testing/model-fixture';
import {ScatterPlotComponent} from './scatter-plot/scatter-plot';
import {Scatter3dPlotComponent} from './scatter-3d-plot/scatter-3d-plot';
import {ModelProfilesComponent} from './model-profiles/model-profiles';
import {getPlotColors} from '../models/plot-colors';
import {ThemeState} from '../state/theme.state';

describe('markers with shown deprecated models', () => {
  let state: AppState;

  beforeEach(() => {
    localStorage.clear();
    TestBed.inject(ThemeState).override.set('light');
    state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'a', costsToRun: 10, overallIntelligence: 20}),
      testModel({id: 'b', costsToRun: 20, overallIntelligence: 60}),
      testModel({id: 'fresh', costsToRun: 5, overallIntelligence: 40, deprecated: true, releaseDate: '2026-09-01'}),
      testModel({id: 'old', costsToRun: 1, overallIntelligence: 90, deprecated: true, releaseDate: '2025-01-10'}),
    ]);
    state.today.set(new Date(2026, 9, 26));
    state.disabledModelIds.set(new Set());
    state.pickedDeprecatedIds.set(new Set());
    state.setDeprecatedMode('new');
    state.plotType.set('cost');
    state.scatter3dX.set('costsToRun');
    state.scatter3dY.set('intelligence');
    state.scatter3dZ.set('responseTime');
  });

  const sorted = (ids: Set<string>) => [...ids].sort();

  it('ranks the shown deprecated model and leaves out the hidden one in the table Pareto set', () => {
    expect(state.filteredModels().map(m => m.id)).toEqual(['a', 'b', 'fresh']);
    expect(sorted(state.usefulModelIds())).toEqual(['b', 'fresh']);
  });

  it('gives the shown deprecated model the 2D markers in its marker color', () => {
    const c = TestBed.createComponent(ScatterPlotComponent).componentInstance as any;
    expect(sorted(c.usefulIds())).toEqual(['b', 'fresh']);
    const {axisBestIds, balancedId} = c.specialMarkers2d();
    expect(sorted(axisBestIds)).toEqual(['b', 'fresh']);
    expect(balancedId).toBe('fresh');
    const point = c.plotData()[c.plotted().findIndex((p: any) => p.model.id === 'fresh')];
    expect(point.balanced).toBe(true);
    expect(point.color).toBe(getPlotColors('light').balanced);
  });

  it('gives the shown deprecated model the 3D markers', () => {
    const c = TestBed.createComponent(Scatter3dPlotComponent).componentInstance;
    expect(sorted(c.useful3d())).toEqual(['b', 'fresh']);
    expect(c.specialMarkers3d().balancedId).toBe('fresh');
    const balanced = (c.traces() as any[]).find(t => t.name === 'Best balanced');
    expect(balanced.x).toEqual([Math.log2(5)]);
  });

  it('gives the shown deprecated model the Pareto and best balanced badges', () => {
    const c = TestBed.createComponent(ModelProfilesComponent).componentInstance;
    expect(c.balancedIds().api).toBe('fresh');
    const byId = new Map(c.profiles().map(p => [p.model.id, p]));
    expect(byId.get('fresh')!.badges.map(b => b.id)).toEqual(expect.arrayContaining(['pareto-front', 'best-balanced-overall']));
    expect(byId.get('a')!.alternative?.model.id).toBe('fresh');
  });
});
