import {TestBed} from '@angular/core/testing';
import {AppState} from './app.state';

describe('AppState stored 3D axes', () => {
  afterEach(() => localStorage.clear());

  it('falls back to the default for an axis that no longer exists', () => {
    localStorage.setItem('ai-models.scatter3d.z', 'codingIntelligence');
    localStorage.setItem('ai-models.scatter3d.x', 'contextWindow');
    const state = TestBed.inject(AppState);
    expect(state.scatter3dZ()).toBe('intelligence');
    expect(state.scatter3dX()).toBe('contextWindow');
  });
});
