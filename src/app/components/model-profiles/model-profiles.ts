import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AppState} from '../../state/app.state';
import {ModelBadgesService} from '../../services/model-badges.service';
import {ProfileEntry} from '../../models/profile.model';
import {buildModelTooltipLines} from '../../models/tooltip.util';

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

  readonly profiles = computed<ProfileEntry[]>(() => {
    const search = this.searchText().trim().toLowerCase();
    const display = this.state.filteredModels().filter(m => {
      if (!search) return true;
      return m.publicName.toLowerCase().includes(search)
        || m.modelName.toLowerCase().includes(search);
    });
    return this.badges.computeProfiles(
      display,
      this.state.allModels(),
      this.state.intelligenceMetric(),
      this.state.usefulModelIds(),
    );
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
