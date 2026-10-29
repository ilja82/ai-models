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
      testModel({id: 'tx', modelName: 'tx', publicName: 'Tx', provider: 'tensorx', overallIntelligence: 50}),
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

describe('DataTableComponent outdated benchmark', () => {
  afterEach(() => localStorage.clear());

  it('marks the name and the score of a model with an older benchmark version', () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'current', publicName: 'Current', overallIntelligence: 60}),
      testModel({id: 'old', modelName: 'old', publicName: 'Old', overallIntelligence: 50, benchmarkVersion: 'v4.3.2'}),
    ]);
    state.disabledModelIds.set(new Set());
    state.hiddenProviders.set([]);
    state.showOnlyPareto.set(false);
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const col = [...el.querySelectorAll('th')].findIndex(th => th.textContent!.includes('Overall'));
    const [current, old] = [...el.querySelectorAll('tbody tr')];
    expect(current.querySelector('.outdated-badge')).toBeNull();
    expect(current.querySelectorAll('td')[col].classList).not.toContain('outdated');
    expect(old.querySelector('.outdated-badge')!.textContent!.trim()).toBe('v4.3.2');
    const score = old.querySelectorAll('td')[col];
    expect(score.classList).toContain('outdated');
    expect(score.getAttribute('title')).toBe('Outdated benchmark: Intelligence Index v4.3.2, not comparable with v5.0');
  });
});

describe('DataTableComponent search', () => {
  afterEach(() => localStorage.clear());

  function render(): { fixture: ReturnType<typeof TestBed.createComponent<DataTableComponent>>, el: HTMLElement } {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'shown', modelName: 'shown', publicName: 'Lorem Shown', provider: 'bedrock', overallIntelligence: 60}),
      testModel({id: 'tx', modelName: 'tx', publicName: 'Lorem Tx', provider: 'tensorx', overallIntelligence: 50}),
      testModel({id: 'old', modelName: 'old', publicName: 'Lorem Old', deprecated: true, overallIntelligence: 40}),
      testModel({id: 'other', modelName: 'other', publicName: 'Ipsum', overallIntelligence: 30}),
    ]);
    state.disabledModelIds.set(new Set());
    state.pickedDeprecatedIds.set(new Set());
    state.showDeprecated.set(false);
    state.showNewModels.set(false);
    state.hiddenProviders.set(['tensorx']);
    state.showOnlyPareto.set(false);
    state.today.set(new Date(2026, 9, 26));
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.detectChanges();
    return {fixture, el: fixture.nativeElement as HTMLElement};
  }

  const rows = (el: HTMLElement) => [...el.querySelectorAll('tbody tr')].map(tr => ({
    name: [...tr.querySelector('td')!.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim(),
    filteredOut: tr.classList.contains('filtered-out'),
    title: tr.getAttribute('title'),
  }));

  it('shows no extra mark in the name of a filtered-out model', () => {
    const {fixture, el} = render();
    fixture.componentInstance.searchText.set('tx');
    fixture.detectChanges();
    expect(el.querySelector('tbody td')!.textContent!.trim()).toBe('Lorem Tx');
  });

  it('lists only the shown models without a search', () => {
    const {el} = render();
    expect(rows(el).map(r => r.name)).toEqual(['Lorem Shown', 'Ipsum']);
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('2 models');
  });

  it('finds the filtered-out models and marks them with the reasons', () => {
    const {fixture, el} = render();
    fixture.componentInstance.searchText.set('lorem');
    fixture.detectChanges();
    expect(rows(el)).toEqual([
      {name: 'Lorem Shown', filteredOut: false, title: null},
      {name: 'Lorem Tx', filteredOut: true, title: 'Filtered out: TensorX hidden'},
      {name: 'Lorem Old', filteredOut: true, title: 'Filtered out: Deprecated'},
    ]);
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('3 models, 2 filtered out');
  });

  it('marks a model that only "Pareto only" hides', () => {
    const {fixture, el} = render();
    TestBed.inject(AppState).showOnlyPareto.set(true);
    fixture.componentInstance.searchText.set('ipsum');
    fixture.detectChanges();
    expect(rows(el)).toEqual([{name: 'Ipsum', filteredOut: true, title: 'Filtered out: Not Pareto efficient'}]);
  });
});

describe('DataTableComponent new tag', () => {
  afterEach(() => localStorage.clear());

  it('tags the models released in the last 3 months', () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'fresh', modelName: 'fresh', publicName: 'Fresh', releaseDate: '2026-08-01', overallIntelligence: 60}),
      testModel({id: 'old', modelName: 'old', publicName: 'Old', releaseDate: '2026-07-20', overallIntelligence: 50}),
    ]);
    state.disabledModelIds.set(new Set());
    state.hiddenProviders.set([]);
    state.today.set(new Date(2026, 9, 26));
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tags = [...el.querySelectorAll('tbody tr')].map(tr => tr.querySelector('.new-badge')?.textContent!.trim() ?? null);
    expect(tags).toEqual(['new', null]);
  });
});
