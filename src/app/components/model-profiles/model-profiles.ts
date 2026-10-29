import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {AppState} from '../../state/app.state';
import {BalancedIds, ModelBadgesService} from '../../services/model-badges.service';
import {ProfileEntry, ProfileGrouping, ProfileSection, ProfileSort} from '../../models/profile.model';
import {groupProfiles, PROFILE_GROUPING_LABELS, PROFILE_SORT_LABELS, sortProfiles} from '../../models/profile.util';
import {buildModelTooltipLines, outdatedBenchmarkText} from '../../models/tooltip.util';
import {BalancedAxis, bestBalancedId} from '../../models/balanced.util';
import {AiModel, MODALITY_ICONS, MODALITY_LABELS} from '../../models/ai-model.model';

@Component({
  selector: 'app-model-profiles',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './model-profiles.html',
  styleUrl: './model-profiles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelProfilesComponent {
  readonly state = inject(AppState);
  private readonly badges = inject(ModelBadgesService);
  readonly searchText = signal('');
  readonly sortBy = signal<ProfileSort>('intelligence');
  readonly grouping = signal<ProfileGrouping>('none');
  readonly icons = MODALITY_ICONS;
  readonly labels = MODALITY_LABELS;
  readonly sortOptions = Object.entries(PROFILE_SORT_LABELS) as [ProfileSort, string][];
  readonly groupingOptions = Object.entries(PROFILE_GROUPING_LABELS) as [ProfileGrouping, string][];

  /** The "best balanced" model or effort level id of each peer group: closest-to-ideal in (cost ↓, intelligence ↑). */
  readonly balancedIds = computed<BalancedIds>(() => {
    const models = this.state.paretoCandidates().filter(m => m.costsToRun !== null && m.overallIntelligence !== null);
    const cost: BalancedAxis = {get: m => m.costsToRun === 0 ? 0.001 : m.costsToRun!, higherIsBetter: false};
    const axes = [cost, {get: (m: AiModel) => m.overallIntelligence!, higherIsBetter: true}];
    return {
      api: bestBalancedId(models.filter(m => !m.localModel), axes),
      local: bestBalancedId(models.filter(m => m.localModel), axes),
    };
  });

  readonly profiles = computed<ProfileEntry[]>(() => {
    const search = this.searchText().trim().toLowerCase();
    const display = this.state.filteredModels().filter(m => {
      if (!search) return true;
      return m.publicName.toLowerCase().includes(search)
        || m.modelName.toLowerCase().includes(search);
    });
    const entries = this.badges.computeProfiles(display, this.state.filteredModels(), this.balancedIds());
    return sortProfiles(entries, this.sortBy());
  });

  readonly sections = computed<ProfileSection[]>(() => groupProfiles(this.profiles(), this.grouping()));

  readonly totalCount = computed(() => this.state.filteredModels().length);
  readonly shownCount = computed(() => this.profiles().length);

  tooltipFor(entry: ProfileEntry): string {
    return buildModelTooltipLines(entry.model, this.state.latestBenchmarkVersion()).join('\n');
  }

  outdatedTitle(model: AiModel): string {
    return outdatedBenchmarkText(model, this.state.latestBenchmarkVersion());
  }

  rankTitle(entry: ProfileEntry, rank: number | null): string {
    return rank === null ? '' : `Better than or equal to ${Math.round(rank * 100)}% of the other ${entry.group === 'local' ? 'local' : 'API'} models`;
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
}
