import {Component, computed, input} from '@angular/core';
import {AiModel} from '../../models/ai-model.model';

/** Names the models that a chart leaves out because a value it needs is not measured. */
@Component({
  selector: 'app-missing-data-hint',
  standalone: true,
  templateUrl: './missing-data-hint.html',
  styleUrl: './missing-data-hint.scss',
})
export class MissingDataHintComponent {
  readonly models = input.required<AiModel[]>();
  readonly names = computed(() => this.models().map(m => m.publicName).join(', '));
}
