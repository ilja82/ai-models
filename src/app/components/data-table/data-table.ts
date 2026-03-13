import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppState } from '../../state/app.state';
import { AiModel } from '../../models/ai-model.model';

type SortKey = keyof AiModel;
type SortDir = 'asc' | 'desc';

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
  readonly sortKey = signal<SortKey>('publicName');
  readonly sortDir = signal<SortDir>('asc');

  readonly tableModels = computed(() => {
    const search = this.searchText().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir();

    let models = this.state.filteredModels();

    if (search) {
      models = models.filter(m =>
        m.publicName.toLowerCase().includes(search) ||
        m.modelName.toLowerCase().includes(search)
      );
    }

    return [...models].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      let cmp = 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv);
      } else if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else if (typeof av === 'boolean' && typeof bv === 'boolean') {
        cmp = Number(av) - Number(bv);
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  sort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  formatCost(value: number): string {
    if (value === 0) return 'Free';
    return `$${value.toFixed(2)}`;
  }

  isUseful(id: string): boolean {
    return this.state.showUsefulModels() && this.state.usefulModelIds().has(id);
  }
}
