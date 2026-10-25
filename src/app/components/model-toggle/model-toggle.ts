import {Component, computed, inject} from '@angular/core';
import {AppState} from '../../state/app.state';

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
}
