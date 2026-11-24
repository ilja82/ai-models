import {TestBed} from '@angular/core/testing';
import {DataTableComponent} from './data-table';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';
import {EffortLevel} from '../../models/ai-model.model';

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

describe('DataTableComponent estimated values', () => {
  afterEach(() => localStorage.clear());

  it('marks the estimated score of a model with an older benchmark version and estimated speed and times', () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'current', publicName: 'Current', overallIntelligence: 60}),
      testModel({
        id: 'old', modelName: 'old', publicName: 'Old', overallIntelligence: 31.2, intelligenceEstimatedFrom: 43.6,
        benchmarkVersion: 'v4.3.2', timesEstimated: true,
      }),
    ]);
    state.disabledModelIds.set(new Set());
    state.hiddenProviders.set([]);
    state.showOnlyPareto.set(false);
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const heads = [...el.querySelectorAll('th')].map(th => th.textContent!);
    const col = heads.findIndex(h => h.includes('Overall'));
    const speedCol = heads.findIndex(h => h.includes('Tok/s'));
    const responseCol = heads.findIndex(h => h.includes('Response Time'));
    const [current, old] = [...el.querySelectorAll('tbody tr')];
    for (const c of [speedCol, responseCol]) {
      const measured = current.querySelectorAll('td')[c];
      expect([measured.classList.contains('estimated'), measured.getAttribute('title')]).toEqual([false, null]);
      const estimated = old.querySelectorAll('td')[c];
      expect([estimated.classList.contains('estimated'), estimated.getAttribute('title')]).toEqual([true,
        'Speed or times estimated: converted from the artificialanalysis.ai measurement before 2026-11-04']);
    }
    const currentScore = current.querySelectorAll('td')[col];
    expect([currentScore.textContent!.trim(), currentScore.classList.contains('estimated')]).toEqual(['60', false]);
    expect(currentScore.getAttribute('title')).toBeNull();
    const score = old.querySelectorAll('td')[col];
    expect([score.textContent!.trim(), score.classList.contains('estimated')]).toEqual(['~31.2', true]);
    expect(score.getAttribute('title')).toBe('Score estimated for v5.0 from the v4.3.2 score 43.6');
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

describe('DataTableComponent effort levels', () => {
  afterEach(() => localStorage.clear());

  function level(effort: string, overrides: Partial<EffortLevel> = {}): EffortLevel {
    return {
      effort, overallIntelligence: 40, intelligenceEstimatedFrom: null, tokensPerRun: 100, inputTokensPerRun: 90,
      outputTokensPerRun: 10, cacheHitRate: null, tokensPerSecond: 50, inputProcessingTime: 1, thinkingTime: 2,
      outputTime: 3, timesEstimated: false, costsToRun: 10, ...overrides,
    };
  }

  function render(): { fixture: ReturnType<typeof TestBed.createComponent<DataTableComponent>>, el: HTMLElement } {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({
        id: 'big', modelName: 'big', publicName: 'Big', effort: 'high', overallIntelligence: 60, costsToRun: 100,
        efforts: [
          level('low', {overallIntelligence: 40, costsToRun: 20, thinkingTime: 1}),
          level('medium', {overallIntelligence: 50, costsToRun: 200, thinkingTime: 5}),
          level('high', {overallIntelligence: 60, costsToRun: 100}),
        ],
      }),
      testModel({
        id: 'small', modelName: 'small', publicName: 'Small', effort: 'reasoning', overallIntelligence: 50, costsToRun: 50,
        efforts: [
          level('non-reasoning', {overallIntelligence: 30, intelligenceEstimatedFrom: 35, costsToRun: 1}),
          level('reasoning', {overallIntelligence: 50, costsToRun: 50}),
        ],
      }),
      testModel({id: 'single', modelName: 'single', publicName: 'Single', effort: 'high', overallIntelligence: 45,
        costsToRun: 500, efforts: [level('high', {overallIntelligence: 45, costsToRun: 500})]}),
      testModel({id: 'none', modelName: 'none', publicName: 'None', overallIntelligence: 20, costsToRun: 600}),
    ]);
    state.disabledModelIds.set(new Set());
    state.pickedDeprecatedIds.set(new Set());
    state.hiddenProviders.set([]);
    state.showLocal.set(true);
    state.showAPI.set(true);
    state.maxVram.set(null);
    state.clearModalities();
    state.showOnlyPareto.set(false);
    state.today.set(new Date(2026, 9, 26));
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.detectChanges();
    return {fixture, el: fixture.nativeElement as HTMLElement};
  }

  const col = (el: HTMLElement, head: string) =>
    [...el.querySelectorAll('th')].findIndex(th => th.textContent!.trim().startsWith(head));
  const cell = (tr: Element, index: number) => tr.querySelectorAll('td')[index].textContent!.trim();
  const toggle = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLButtonElement>(`button.effort-toggle[aria-label="Effort levels of ${name}: ${name === 'Big' ? 3 : 2}"]`)!;
  const rows = (el: HTMLElement) => {
    const effort = col(el, 'Effort');
    return [...el.querySelectorAll('tbody tr')].map(tr =>
      `${tr.classList.contains('effort-row') ? '  ' : ''}${tr.querySelector('.name-cell')!.textContent!.replace('★', '').trim()} ${tr.querySelectorAll('td')[effort].querySelector('.effort-label')!.textContent!.trim()}`);
  };

  it('shows the Effort column right after Name with the short label, or a dash without an effort', () => {
    const {el} = render();
    const heads = [...el.querySelectorAll('th')].map(th => th.textContent!.trim());
    expect(heads.length).toBe(25);
    expect(heads[1]).toBe('Effort');
    const labels = [...el.querySelectorAll('tbody tr')].map(tr => tr.querySelector('.effort-label')!.textContent!.trim());
    expect(labels).toEqual(['high', 'on', 'high', '—']);
    const titles = [...el.querySelectorAll('tbody tr')].map(tr => tr.querySelectorAll('td')[1].getAttribute('title'));
    expect(titles).toEqual(['high', 'reasoning', 'high', null]);
  });

  it('has a closed toggle only for a model with 2 or more levels', () => {
    const {el} = render();
    const buttons = [...el.querySelectorAll('tbody tr')].map(tr => tr.querySelector('button.effort-toggle'));
    expect(buttons.map(b => b?.getAttribute('aria-expanded') ?? null)).toEqual(['false', 'false', null, null]);
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Effort levels of Big: 3');
    expect(buttons[0]!.textContent!.trim()).toBe('▸ 3');
  });

  it('adds the other levels under the model on a click and removes them on a second click', () => {
    const {fixture, el} = render();
    toggle(el, 'Big').click();
    fixture.detectChanges();
    expect(rows(el)).toEqual(['Big high', '  Big low', '  Big med', 'Small on', 'Single high', 'None —']);
    expect(toggle(el, 'Big').getAttribute('aria-expanded')).toBe('true');
    const subs = [...el.querySelectorAll('tbody tr.effort-row')];
    const score = col(el, 'Overall');
    const response = col(el, 'Response Time');
    expect(subs.map(tr => [cell(tr, score), cell(tr, response)])).toEqual([['40', '5.0s'], ['50', '9.0s']]);

    toggle(el, 'Small').click();
    fixture.detectChanges();
    const estimated = el.querySelectorAll('tbody tr')[4].querySelectorAll('td')[score];
    expect([estimated.textContent!.trim(), estimated.classList.contains('estimated')]).toEqual(['~30', true]);

    toggle(el, 'Big').click();
    fixture.detectChanges();
    expect(rows(el)).toEqual(['Big high', 'Small on', '  Small off', 'Single high', 'None —']);
  });

  it('keeps the levels under their model when sorted by Overall in both directions', () => {
    const {fixture, el} = render();
    fixture.componentInstance.toggleAllEfforts();
    fixture.detectChanges();
    const expected = ['Big high', '  Big low', '  Big med', 'Small on', '  Small off', 'Single high', 'None —'];
    expect(rows(el)).toEqual(expected);
    const head = [...el.querySelectorAll('th')][col(el, 'Overall')] as HTMLElement;
    head.click();
    fixture.detectChanges();
    expect(rows(el)).toEqual(['None —', 'Single high', 'Small on', '  Small off', 'Big high', '  Big low', '  Big med']);
    head.click();
    fixture.detectChanges();
    expect(rows(el)).toEqual(expected);
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('4 models');
  });

  it('marks a level in the Pareto set with the star and the class useful', () => {
    const {fixture, el} = render();
    fixture.componentInstance.toggleAllEfforts();
    fixture.detectChanges();
    const subs = [...el.querySelectorAll('tbody tr.effort-row')];
    const marks = subs.map(tr => [tr.querySelector('.effort-label')!.textContent!.trim(), tr.classList.contains('useful'),
      tr.querySelector('.useful-badge') !== null]);
    expect(marks).toEqual([
      ['low', true, true],
      ['med', false, false],
      ['off', true, true],
    ]);
  });

  it('opens and closes the levels of every model with "All effort levels"', () => {
    const {fixture, el} = render();
    const box = [...el.querySelectorAll('.toggle-label')].find(l => l.textContent!.includes('All effort levels'))!
      .querySelector('input')!;
    box.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr.effort-row').length).toBe(3);
    expect(toggle(el, 'Big').getAttribute('aria-expanded')).toBe('true');
    expect(toggle(el, 'Small').getAttribute('aria-expanded')).toBe('true');
    box.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr.effort-row').length).toBe(0);
  });

  it('closes only the clicked model while "All effort levels" is on', () => {
    const {fixture, el} = render();
    fixture.componentInstance.toggleAllEfforts();
    fixture.detectChanges();
    toggle(el, 'Big').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.allEfforts()).toBeFalse();
    expect(rows(el)).toEqual(['Big high', 'Small on', '  Small off', 'Single high', 'None —']);
  });

  it('shows no levels of an expanded model that a search hides', () => {
    const {fixture, el} = render();
    toggle(el, 'Big').click();
    fixture.componentInstance.searchText.set('small');
    fixture.detectChanges();
    expect(rows(el)).toEqual(['Small on']);
  });
});
