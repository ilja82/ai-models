import {Component, computed, input} from '@angular/core';
import {AiModel} from '../../models/ai-model.model';

/** Names the shown models whose speed or times are converted from the older measurement. */
@Component({
  selector: 'app-estimated-times-hint',
  standalone: true,
  templateUrl: './estimated-times-hint.html',
  styleUrl: './estimated-times-hint.scss',
})
export class EstimatedTimesHintComponent {
  readonly models = input.required<AiModel[]>();
  /** The models with an estimated speed or time, one per name. */
  readonly estimated = computed(() =>
    [...new Map(this.models().filter(m => m.timesEstimated).map(m => [m.publicName, m])).values()]);
  readonly names = computed(() => this.estimated().map(m => m.publicName).join(', '));
}
