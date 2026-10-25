import {TestBed} from '@angular/core/testing';
import {DataTableComponent} from './data-table';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';

describe('DataTableComponent provider column', () => {
  afterEach(() => localStorage.clear());

  it('names the provider of each model', () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'aws', publicName: 'Aws', provider: 'bedrock', overallIntelligence: 60}),
      testModel({id: 'tx', publicName: 'Tx', provider: 'tensorx', overallIntelligence: 50}),
      testModel({id: 'local', publicName: 'Local', provider: null, localModel: true, overallIntelligence: 40}),
    ]);
    state.disabledModelIds.set(new Set());
    state.hiddenProviders.set([]);
    state.showLocal.set(true);
    state.maxVram.set(null);
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const col = [...el.querySelectorAll('th')].findIndex(th => th.textContent!.includes('Provider'));
    const cells = [...el.querySelectorAll('tbody tr')].map(tr => tr.querySelectorAll('td')[col].textContent!.trim());
    expect(cells).toEqual(['AWS Bedrock', 'TensorX', '—']);
  });
});
