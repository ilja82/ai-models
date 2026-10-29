import {TestBed} from '@angular/core/testing';
import {OutdatedBenchmarkHintComponent} from './outdated-benchmark-hint';
import {AppState} from '../../state/app.state';
import {AiModel} from '../../models/ai-model.model';
import {testModel} from '../../../testing/model-fixture';

describe('OutdatedBenchmarkHintComponent', () => {
  const current = testModel({id: 'current', publicName: 'Lorem Current'});
  const old = testModel({id: 'old', publicName: 'Lorem Old', benchmarkVersion: 'v4.3.2'});
  const oldLevel = {...old, id: 'old@low', effort: 'low'};

  function render(models: AiModel[]): HTMLElement {
    TestBed.inject(AppState).allModels.set([current, old]);
    const fixture = TestBed.createComponent(OutdatedBenchmarkHintComponent);
    fixture.componentRef.setInput('models', models);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names each shown model with an older benchmark version once', () => {
    const hint = render([current, old, oldLevel]).querySelector('.outdated-hint')!;
    expect(hint.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Outdated benchmark: Intelligence Index v4.3.2, not comparable with v5.0 (1 model): Lorem Old');
    expect(hint.getAttribute('title')).toBe('Lorem Old');
  });

  it('shows nothing while every shown model has the newest version', () => {
    expect(render([current]).querySelector('.outdated-hint')).toBeNull();
  });
});
