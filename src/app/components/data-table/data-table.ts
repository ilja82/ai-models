import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AppState} from '../../state/app.state';
import {
  AiModel,
  costPerRequestOf,
  hasEstimatedScore,
  latencyOf,
  Modality,
  MODALITY_ICONS,
  NEW_MODEL_MONTHS,
  PROVIDER_LABELS,
  responseTimeOf,
} from '../../models/ai-model.model';
import {estimatedScoreText, estimatedTokensText, formatUsd, modalityNames, outdatedBenchmarkText, scoreText,} from '../../models/tooltip.util';

type SortKey = keyof AiModel;
type ComputedSortKey = 'latency' | 'responseTime' | 'costPerRequest';
type SortDir = 'asc' | 'desc';

type NumericCol =
  | 'inputCosts' | 'outputCosts' | 'costsToRun' | 'costPerRequest'
  | 'contextWindow' | 'maxInputTokens' | 'maxOutputTokens'
  | 'minVramRequirement'
  | 'overallIntelligence'
  | 'tokensPerSecond'
  | 'inputProcessingTime' | 'thinkingTime' | 'outputTime'
  | 'latency' | 'responseTime';

type BoundsFn = (rawMin: number, rawMax: number) => [number, number];

interface ColMeta {
  higherIsBetter: boolean;
  log: boolean;
  get: (m: AiModel) => number | null;
  nullIfZeroOrNeg?: boolean;
  bounds: BoundsFn;
}

interface Extent {
  min: number;
  max: number;
}

function niceCeil(x: number): number {
  if (x <= 0) return 0;
  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  const m = x / base;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return nice * base;
}

const staticBounds = (lo: number, hi: number): BoundsFn => () => [lo, hi];

const decadeBounds: BoundsFn = (rawMin, rawMax) => {
  if (rawMin <= 0 || !Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return [rawMin, rawMax];
  return [
    Math.pow(10, Math.floor(Math.log10(rawMin))),
    Math.pow(10, Math.ceil(Math.log10(rawMax))),
  ];
};

const niceLinearBounds: BoundsFn = (rawMin, rawMax) => {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return [rawMin, rawMax];
  const lo = rawMin >= 0 ? 0 : -niceCeil(-rawMin);
  const hi = niceCeil(rawMax);
  return [lo, hi];
};

const COL_META: Record<NumericCol, ColMeta> = {
  inputCosts: {higherIsBetter: false, log: true, get: m => m.inputCosts, bounds: decadeBounds},
  outputCosts: {higherIsBetter: false, log: true, get: m => m.outputCosts, bounds: decadeBounds},
  costsToRun: {higherIsBetter: false, log: true, get: m => m.costsToRun, bounds: decadeBounds},
  costPerRequest: {higherIsBetter: false, log: true, get: m => costPerRequestOf(m), bounds: decadeBounds},
  contextWindow: {higherIsBetter: true, log: false, get: m => m.contextWindow, bounds: niceLinearBounds},
  maxInputTokens: {higherIsBetter: true, log: false, get: m => m.maxInputTokens, bounds: niceLinearBounds},
  maxOutputTokens: {higherIsBetter: true, log: false, get: m => m.maxOutputTokens, bounds: niceLinearBounds},
  minVramRequirement: {higherIsBetter: false, log: true, get: m => m.minVramRequirement, nullIfZeroOrNeg: true, bounds: decadeBounds},
  overallIntelligence: {higherIsBetter: true, log: false, get: m => m.overallIntelligence, bounds: staticBounds(0, 100)},
  tokensPerSecond: {higherIsBetter: true, log: false, get: m => m.tokensPerSecond, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  inputProcessingTime: {higherIsBetter: false, log: false, get: m => m.inputProcessingTime, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  thinkingTime: {higherIsBetter: false, log: false, get: m => m.thinkingTime, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  outputTime: {higherIsBetter: false, log: false, get: m => m.outputTime, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  latency: {higherIsBetter: false, log: false, get: m => latencyOf(m), nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  responseTime: {
    higherIsBetter: false,
    log: false,
    get: m => responseTimeOf(m),
    nullIfZeroOrNeg: true,
    bounds: niceLinearBounds
  },
};

const BAR_COLOR_WORST = [220, 90, 90] as const;
const BAR_COLOR_MID = [210, 200, 110] as const;
const BAR_COLOR_BEST = [120, 220, 130] as const;
const BAR_ALPHA = 0.32;
const BAR_MIN_T = 0.06;

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTableComponent {
  readonly state = inject(AppState);

  readonly newTitle = `Released in the last ${NEW_MODEL_MONTHS} months`;
  readonly searchText = signal('');
  readonly showHistogram = signal(true);
  readonly sortKey = signal<SortKey | null>('overallIntelligence');
  readonly computedSortKey = signal<ComputedSortKey | null>(null);
  readonly sortDir = signal<SortDir>('desc');

  readonly tableModels = computed(() => {
    const search = this.searchText().toLowerCase();
    const key = this.sortKey();
    const computedKey = this.computedSortKey();
    const dir = this.sortDir();

    const models = search
      ? this.state.allModels().filter(m =>
        m.publicName.toLowerCase().includes(search) ||
        m.modelName.toLowerCase().includes(search)
      )
      : this.shownModels();

    return [...models].sort((a, b) => {
      const rawA = computedKey ? this.computedValue(a, computedKey) : key ? a[key] : 0;
      const rawB = computedKey ? this.computedValue(b, computedKey) : key ? b[key] : 0;
      // Missing values go last in both directions.
      if (rawA === null || rawB === null) return rawA === rawB ? 0 : rawA === null ? 1 : -1;
      let cmp = 0;
      if (computedKey) {
        cmp = (rawA as number) - (rawB as number);
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

  /** The models that pass all filters, the "Pareto only" filter included. */
  readonly shownModels = computed(() => {
    const models = this.state.filteredModels();
    if (!this.state.showOnlyPareto()) return models;
    const pareto = this.state.usefulModelIds();
    return models.filter(m => pareto.has(m.id));
  });

  /** For each model that a filter hides, the reasons; a search lists these models too. */
  readonly filteredOutReasons = computed(() => {
    const shown = new Set(this.shownModels().map(m => m.id));
    const hiddenReasons = this.state.hiddenReasons();
    const reasons = new Map<string, string>();
    for (const m of this.tableModels()) {
      if (shown.has(m.id)) continue;
      const list = hiddenReasons(m);
      reasons.set(m.id, (list.length ? list : ['Not Pareto efficient']).join(', '));
    }
    return reasons;
  });

  readonly colExtents = computed<Record<NumericCol, Extent>>(() => {
    const models = this.state.filteredModels();
    const out = {} as Record<NumericCol, Extent>;
    (Object.keys(COL_META) as NumericCol[]).forEach(key => {
      const meta = COL_META[key];
      let rawMin = Infinity, rawMax = -Infinity;
      for (const m of models) {
        const v = meta.get(m);
        if (v === null) continue;
        if (meta.nullIfZeroOrNeg && v <= 0) continue;
        if (!Number.isFinite(v)) continue;
        if (v < rawMin) rawMin = v;
        if (v > rawMax) rawMax = v;
      }
      if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
        out[key] = {min: rawMin, max: rawMax};
        return;
      }
      const [min, max] = meta.bounds(rawMin, rawMax);
      out[key] = {min, max};
    });
    return out;
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

  private computedValue(model: AiModel, key: ComputedSortKey): number | null {
    switch (key) {
      case 'latency':
        return latencyOf(model);
      case 'responseTime':
        return responseTimeOf(model);
      case 'costPerRequest':
        return costPerRequestOf(model);
    }
  }

  costPerRequest(model: AiModel): number | null {
    return costPerRequestOf(model);
  }

  runCostTitle(model: AiModel): string | null {
    return model.tokensPerRunEstimated ? estimatedTokensText(model, this.state.latestBenchmarkVersion()) : null;
  }

  outdatedTitle(model: AiModel): string {
    return outdatedBenchmarkText(model, this.state.latestBenchmarkVersion());
  }

  readonly hasEstimatedScore = hasEstimatedScore;

  /** The score with `~` if it is estimated, or a dash without a score. */
  scoreText(model: AiModel): string {
    return scoreText(model, '—');
  }

  scoreTitle(model: AiModel): string | null {
    return hasEstimatedScore(model) ? `Score ${estimatedScoreText(model, model, this.state.latestBenchmarkVersion())}` : null;
  }

  latency(model: AiModel): number | null {
    return latencyOf(model);
  }

  responseTime(model: AiModel): number | null {
    return responseTimeOf(model);
  }

  providerLabel(model: AiModel): string {
    return model.provider ? PROVIDER_LABELS[model.provider] : '—';
  }

  icons(list: readonly Modality[]): string {
    return list.map(m => MODALITY_ICONS[m]).join('');
  }

  modalitiesTitle(model: AiModel): string {
    return `Input: ${modalityNames(model.inputModalities)}. Output: ${modalityNames(model.outputModalities)}.`;
  }

  formatCost(value: number | null): string {
    if (value === null) return '—';
    if (value === 0) return 'Free';
    return formatUsd(value);
  }

  formatTokens(value: number | null): string {
    if (value === null) return '—';
    return value < 1000 ? String(value) : `${(value / 1000).toFixed(0)}K`;
  }

  formatTime(value: number | null): string {
    if (value === null || value <= 0) return '—';
    return `${value.toFixed(1)}s`;
  }

  formatSpeed(value: number | null): string {
    return value === null || value <= 0 ? '—' : String(value);
  }

  isUseful(id: string): boolean {
    return this.state.usefulModelIds().has(id);
  }

  cellStyle(model: AiModel, col: NumericCol): Record<string, string> | null {
    if (!this.showHistogram()) return null;
    const meta = COL_META[col];
    const ext = this.colExtents()[col];
    const v = meta.get(model);
    if (v === null) return null;
    if (meta.nullIfZeroOrNeg && v <= 0) return null;
    if (!Number.isFinite(v) || !Number.isFinite(ext.min) || !Number.isFinite(ext.max)) return null;
    if (ext.max === ext.min) return null;

    let t: number;
    if (meta.log && v > 0 && ext.min > 0) {
      const lmin = Math.log(ext.min);
      const lmax = Math.log(ext.max);
      t = (Math.log(v) - lmin) / (lmax - lmin);
    } else {
      t = (v - ext.min) / (ext.max - ext.min);
    }
    if (!meta.higherIsBetter) t = 1 - t;
    t = Math.max(BAR_MIN_T, Math.min(1, t));

    const color = interpolateBarColor(t);
    const rgba = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${BAR_ALPHA})`;
    return {
      '--bar-pct': `${(t * 100).toFixed(2)}%`,
      '--bar-color': rgba,
    };
  }
}

function interpolateBarColor(t: number): [number, number, number] {
  const [a, b] = t < 0.5
    ? [BAR_COLOR_WORST, BAR_COLOR_MID]
    : [BAR_COLOR_MID, BAR_COLOR_BEST];
  const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ];
}
