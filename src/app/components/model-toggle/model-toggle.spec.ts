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
