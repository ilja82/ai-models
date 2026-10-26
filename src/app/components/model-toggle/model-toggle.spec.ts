import {TestBed} from '@angular/core/testing';
import {ModelToggleComponent} from './model-toggle';
import {AppState} from '../../state/app.state';
import {testModel} from '../../../testing/model-fixture';

describe('ModelToggleComponent modality chips', () => {
  afterEach(() => localStorage.clear());

  function setUp() {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'text'}),
      testModel({id: 'vision', inputModalities: ['text', 'image']}),
      testModel({id: 'omni', inputModalities: ['text', 'image', 'audio', 'video']}),
      testModel({id: 'doc', inputModalities: ['text', 'pdf'], overallIntelligence: null}),
    ]);
    state.clearModalities();
    const fixture = TestBed.createComponent(ModelToggleComponent);
    fixture.detectChanges();
    return {state, fixture, component: fixture.componentInstance};
  }

  const count = (chips: { modality: string; count: number }[], modality: string) =>
    chips.find(c => c.modality === modality)!.count;

  it('counts the models each chip would leave', () => {
    const {state, component} = setUp();
    expect(count(component.inputChips(), 'image')).toBe(2);
    expect(count(component.inputChips(), 'audio')).toBe(1);
    expect(count(component.outputChips(), 'embedding')).toBe(0);
    expect(count(component.inputChips(), 'pdf')).toBe(1);
    state.toggleInputModality('image');
    expect(count(component.inputChips(), 'image')).toBe(2);
    expect(count(component.inputChips(), 'video')).toBe(1);
    expect(count(component.outputChips(), 'text')).toBe(2);
  });

  it('disables a chip without matches and shows Clear only with a filter', async () => {
    const {state, fixture} = setUp();
    const el = fixture.nativeElement as HTMLElement;
    const chip = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('.chip')]
      .find(b => b.textContent!.includes(label))!;
    expect(chip('Embedding').disabled).toBe(true);
    expect(chip('Image').disabled).toBe(false);
    expect(el.querySelector('.clear')).toBeNull();

    chip('Image').click();
    await fixture.whenStable();
    expect(state.inputModalities()).toEqual(['image']);
    expect(chip('Image').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelectorAll('.model-item').length).toBe(2);
    expect(chip('PDF').disabled).toBe(true);

    el.querySelector<HTMLButtonElement>('.clear')!.click();
    await fixture.whenStable();
    expect(state.inputModalities()).toEqual([]);
  });
});

describe('ModelToggleComponent providers', () => {
  afterEach(() => localStorage.clear());

  it('hides the models of an unchecked provider', async () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([testModel({id: 'aws', provider: 'bedrock'}), testModel({id: 'tx', provider: 'tensorx'})]);
    state.hiddenProviders.set([]);
    const fixture = TestBed.createComponent(ModelToggleComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const box = (label: string) => [...el.querySelectorAll<HTMLLabelElement>('.provider')]
      .find(l => l.textContent!.includes(label))!.querySelector('input')!;
    expect(box('AWS Bedrock').checked).toBe(true);

    box('TensorX').click();
    await fixture.whenStable();
    expect(state.hiddenProviders()).toEqual(['tensorx']);
    expect(box('TensorX').checked).toBe(false);
    expect(el.querySelectorAll('.model-item').length).toBe(1);
  });
});

describe('ModelToggleComponent new tag', () => {
  afterEach(() => localStorage.clear());

  it('tags the models released in the last 3 months', () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'fresh', publicName: 'Fresh', releaseDate: '2026-08-01', overallIntelligence: 60}),
      testModel({id: 'old', publicName: 'Old', releaseDate: '2026-07-20', overallIntelligence: 50}),
    ]);
    state.disabledModelIds.set(new Set());
    state.hiddenProviders.set([]);
    state.today.set(new Date(2026, 9, 26));
    const fixture = TestBed.createComponent(ModelToggleComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tags = [...el.querySelectorAll('.model-item')].map(li => li.querySelector('.new-badge')?.textContent!.trim() ?? null);
    expect(tags).toEqual(['new', null]);
  });
});

describe('ModelToggleComponent model search', () => {
  afterEach(() => localStorage.clear());

  it('lists a matching deprecated model and turns it on with a click', async () => {
    const state = TestBed.inject(AppState);
    state.allModels.set([
      testModel({id: 'a', publicName: 'Lorem'}),
      testModel({id: 'd', publicName: 'Dolor', deprecated: true, deprecationInfo: 'Lorem ipsum'}),
    ]);
    state.showDeprecated.set(false);
    state.pickedDeprecatedIds.set(new Set());
    const fixture = TestBed.createComponent(ModelToggleComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const items = () => [...el.querySelectorAll<HTMLLIElement>('.model-item')];
    expect(items().length).toBe(1);

    const search = el.querySelector<HTMLInputElement>('.model-search')!;
    search.value = 'dol';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(items().length).toBe(1);
    expect(items()[0].classList).toContain('disabled');
    expect(items()[0].querySelector('.deprecation-badge')).not.toBeNull();

    items()[0].click();
    await fixture.whenStable();
    expect(items()[0].classList).not.toContain('disabled');
    expect(state.filteredModels().map(m => m.id)).toEqual(['a', 'd']);
  });
});
