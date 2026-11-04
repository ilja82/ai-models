import {TestBed} from '@angular/core/testing';
import {EstimatedTimesHintComponent} from './estimated-times-hint';
import {AiModel} from '../../models/ai-model.model';
import {testModel} from '../../../testing/model-fixture';

describe('EstimatedTimesHintComponent', () => {
  const measured = testModel({id: 'measured', publicName: 'Lorem Measured'});
  const estimated = testModel({id: 'estimated', publicName: 'Lorem Estimated', timesEstimated: true});
  const estimatedLevel = {...estimated, id: 'estimated@low', effort: 'low'};

  function render(models: AiModel[]): HTMLElement {
    const fixture = TestBed.createComponent(EstimatedTimesHintComponent);
    fixture.componentRef.setInput('models', models);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names each shown model with estimated speed or times once', () => {
    const hint = render([measured, estimated, estimatedLevel]).querySelector('.estimated-times-hint')!;
    expect(hint.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Speed or times estimated from the artificialanalysis.ai measurement before 2026-11-04 (1 model): Lorem Estimated');
    expect(hint.getAttribute('title')).toBe('Lorem Estimated');
  });

  it('shows nothing while every shown model has measured speed and times', () => {
    expect(render([measured]).querySelector('.estimated-times-hint')).toBeNull();
  });
});
