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
    [...this.state.allModels()].sort(
      (a, b) => this.state.getIntelligence(b) - this.state.getIntelligence(a)
    )
  );
}
