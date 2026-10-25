import {Component, computed, inject} from '@angular/core';
import {AppState} from '../../state/app.state';
import {
  hasModalities,
  INPUT_MODALITIES,
  InputModality,
  Modality,
  MODALITY_ICONS,
  MODALITY_LABELS,
  OUTPUT_MODALITIES,
  OutputModality,
} from '../../models/ai-model.model';

export interface ModalityChip<T extends Modality> {
  modality: T;
  label: string;
  icon: string;
  active: boolean;
  /** Models that match the filter with this chip added. */
  count: number;
}

@Component({
  selector: 'app-model-toggle',
  standalone: true,
  templateUrl: './model-toggle.html',
  styleUrl: './model-toggle.scss',
})
export class ModelToggleComponent {
  readonly state = inject(AppState);

  readonly sortedModels = computed(() =>
    [...this.state.availableModels()].sort(
      (a, b) => b.overallIntelligence - a.overallIntelligence
    )
  );

  readonly inputChips = computed<ModalityChip<InputModality>[]>(() => {
    const inputs = this.state.inputModalities();
    const outputs = this.state.outputModalities();
    return INPUT_MODALITIES.map(modality => this.chip(modality, inputs.includes(modality), [...inputs, modality], outputs));
  });

  readonly outputChips = computed<ModalityChip<OutputModality>[]>(() => {
    const inputs = this.state.inputModalities();
    const outputs = this.state.outputModalities();
    return OUTPUT_MODALITIES.map(modality => this.chip(modality, outputs.includes(modality), inputs, [...outputs, modality]));
  });

  readonly hasModalityFilter = computed(() =>
    this.state.inputModalities().length > 0 || this.state.outputModalities().length > 0
  );

  private chip<T extends Modality>(
    modality: T, active: boolean, inputs: InputModality[], outputs: OutputModality[],
  ): ModalityChip<T> {
    const count = this.state.modalityPool().filter(m => hasModalities(m, inputs, outputs)).length;
    return {modality, label: MODALITY_LABELS[modality], icon: MODALITY_ICONS[modality], active, count};
  }
}
