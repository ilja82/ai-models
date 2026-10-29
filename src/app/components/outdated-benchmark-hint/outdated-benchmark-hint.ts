import {Component, computed, inject, input} from '@angular/core';
import {AiModel} from '../../models/ai-model.model';
import {AppState} from '../../state/app.state';

/** Names the shown models whose benchmark values come from an older Intelligence Index version than the others. */
@Component({
  selector: 'app-outdated-benchmark-hint',
  standalone: true,
  templateUrl: './outdated-benchmark-hint.html',
  styleUrl: './outdated-benchmark-hint.scss',
})
export class OutdatedBenchmarkHintComponent {
  private readonly state = inject(AppState);
  readonly models = input.required<AiModel[]>();
  readonly latest = this.state.latestBenchmarkVersion;
  /** The models with an outdated benchmark, one per name. */
  readonly outdated = computed(() => {
    const isOutdated = this.state.isOutdated();
    return [...new Map(this.models().filter(isOutdated).map(m => [m.publicName, m])).values()];
  });
  readonly versions = computed(() => [...new Set(this.outdated().map(m => m.benchmarkVersion))].join(', '));
  readonly names = computed(() => this.outdated().map(m => m.publicName).join(', '));
}
