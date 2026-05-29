import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AppState} from '../../state/app.state';
import {ModelBadgesService} from '../../services/model-badges.service';
import {ProfileEntry} from '../../models/profile.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';
import {BalancedAxis, bestBalancedId} from '../../models/balanced.util';

@Component({
  selector: 'app-model-profiles',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './model-profiles.html',
  styleUrl: './model-profiles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelProfilesComponent {
  readonly state = inject(AppState);
  private readonly badges = inject(ModelBadgesService);
  readonly searchText = signal('');

  /**
   * The "best balanced" model per intelligence — each identical to the 2D scatter's
   * Cost-vs-Intelligence balanced marker for that metric: closest-to-ideal in (cost ↓, intelligence ↑).
   * Metric-independent on purpose: the Profile shows all three at once and never reacts to the
   * active-metric switcher. Computed over the full filtered, non-deprecated set so the text search
   * doesn't change which models win.
   */
  readonly balancedIds = computed(() => {
    const models = this.state.filteredModels().filter(m => !m.deprecated);
    const cost: BalancedAxis = {get: m => m.costsToRun === 0 ? 0.001 : m.costsToRun, higherIsBetter: false};
    return {
      overall: bestBalancedId(models, [cost, {get: m => m.overallIntelligence, higherIsBetter: true}]),
      coding: bestBalancedId(models, [cost, {get: m => m.codingIntelligence, higherIsBetter: true}]),
      agentic: bestBalancedId(models, [cost, {get: m => m.agenticIntelligence, higherIsBetter: true}]),
    };
  });

  readonly profiles = computed<ProfileEntry[]>(() => {
    const search = this.searchText().trim().toLowerCase();
    const display = this.state.filteredModels().filter(m => {
      if (!search) return true;
      return m.publicName.toLowerCase().includes(search)
        || m.modelName.toLowerCase().includes(search);
    });
    const sorted = [...display].sort((a, b) => {
      if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
      const intelDiff = b.overallIntelligence - a.overallIntelligence;
      if (intelDiff !== 0) return intelDiff;
      return (b.releaseDate || '').localeCompare(a.releaseDate || '');
    });
    return this.badges.computeProfiles(sorted, this.state.allModels(), this.balancedIds());
  });

  readonly totalCount = computed(() => this.state.filteredModels().length);
  readonly shownCount = computed(() => this.profiles().length);

  tooltipFor(entry: ProfileEntry): string {
    return buildModelTooltipLines(entry.model, this.state.intelligenceMetric()).join('\n');
  }

  strengths(entry: ProfileEntry) {
    return entry.badges.filter(b => b.kind === 'strength');
  }

  weaknesses(entry: ProfileEntry) {
    return entry.badges.filter(b => b.kind === 'weakness');
  }

  neutrals(entry: ProfileEntry) {
    return entry.badges.filter(b => b.kind === 'neutral' || b.kind === 'meta');
  }

  trackById(_: number, entry: ProfileEntry): string {
    return entry.model.id;
  }
}
