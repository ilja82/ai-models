import {Component, computed, effect, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AppState} from '../../state/app.state';
import {AiModel, IntelligenceMetric} from '../../models/ai-model.model';

type SortKey = keyof AiModel;
type ComputedSortKey = 'latency' | 'responseTime';
type SortDir = 'asc' | 'desc';

const METRIC_TO_SORT_KEY: Record<IntelligenceMetric, SortKey> = {
  overall: 'overallIntelligence',
  coding: 'codingIntelligence',
  agentic: 'agenticIntelligence',
};

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTableComponent {
  readonly state = inject(AppState);

  readonly searchText = signal('');
  readonly sortKey = signal<SortKey | null>(METRIC_TO_SORT_KEY[this.state.intelligenceMetric()]);
  readonly computedSortKey = signal<ComputedSortKey | null>(null);
  readonly sortDir = signal<SortDir>('desc');

  constructor() {
    effect(() => {
      const metric = this.state.intelligenceMetric();
      this.sortKey.set(METRIC_TO_SORT_KEY[metric]);
      this.computedSortKey.set(null);
      this.sortDir.set('desc');
    });
  }

  readonly tableModels = computed(() => {
    const search = this.searchText().toLowerCase();
    const key = this.sortKey();
    const computedKey = this.computedSortKey();
    const dir = this.sortDir();

    let models = this.state.filteredModels();

    if (search) {
      models = models.filter(m =>
        m.publicName.toLowerCase().includes(search) ||
        m.modelName.toLowerCase().includes(search)
      );
    }

    return [...models].sort((a, b) => {
      let cmp = 0;
      if (computedKey) {
        cmp = this.computedValue(a, computedKey) - this.computedValue(b, computedKey);
      } else if (key) {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        if (typeof av === 'string' && typeof bv === 'string') {
          cmp = av.localeCompare(bv);
        } else if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv;
        } else if (typeof av === 'boolean' && typeof bv === 'boolean') {
          cmp = Number(av) - Number(bv);
        }
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  sort(key: SortKey): void {
    if (this.sortKey() === key && !this.computedSortKey()) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.computedSortKey.set(null);
      this.sortDir.set('asc');
    }
  }

  sortByComputed(key: ComputedSortKey): void {
    if (this.computedSortKey() === key) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.computedSortKey.set(key);
      this.sortKey.set(null);
      this.sortDir.set('asc');
    }
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key || this.computedSortKey()) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  sortComputedIcon(key: ComputedSortKey): string {
    if (this.computedSortKey() !== key) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  private computedValue(model: AiModel, key: ComputedSortKey): number {
    if (key === 'latency') return model.inputProcessingTime + model.thinkingTime;
    return model.inputProcessingTime + model.thinkingTime + model.outputTime;
  }

  formatCost(value: number): string {
    if (value === 0) return 'Free';
    return `$${value.toFixed(2)}`;
  }

  formatTime(value: number): string {
    if (value <= 0) return '—';
    return `${value.toFixed(1)}s`;
  }

  isUseful(id: string): boolean {
    return this.state.showUsefulModels() && this.state.usefulModelIds().has(id);
  }
}
