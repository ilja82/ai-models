import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AppState} from '../../state/app.state';
import {ModelBadgesService} from '../../services/model-badges.service';
import {ProfileEntry} from '../../models/profile.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';
import {BalancedAxis, bestBalancedId} from '../../models/balanced.util';
import {byIntelligenceDesc, MODALITY_ICONS, MODALITY_LABELS} from '../../models/ai-model.model';

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
  readonly icons = MODALITY_ICONS;
  readonly labels = MODALITY_LABELS;

  /** The "best balanced" model or effort level id: closest-to-ideal in (cost ↓, intelligence ↑). */
  readonly balancedIds = computed(() => {
    const models = this.state.paretoCandidates().filter(m => m.costsToRun !== null && m.overallIntelligence !== null);
    const cost: BalancedAxis = {get: m => m.costsToRun === 0 ? 0.001 : m.costsToRun!, higherIsBetter: false};
    return {
      overall: bestBalancedId(models, [cost, {get: m => m.overallIntelligence!, higherIsBetter: true}]),
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
      const intelDiff = byIntelligenceDesc(a, b);
      if (intelDiff !== 0) return intelDiff;
      return (b.releaseDate || '').localeCompare(a.releaseDate || '');
    });
    return this.badges.computeProfiles(sorted, this.state.allModels(), this.balancedIds());
  });

  readonly totalCount = computed(() => this.state.filteredModels().length);
  readonly shownCount = computed(() => this.profiles().length);

  tooltipFor(entry: ProfileEntry): string {
    return buildModelTooltipLines(entry.model).join('\n');
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
