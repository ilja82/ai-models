import {Component, computed, effect, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {AppState} from '../../state/app.state';
import {AiModel, IntelligenceMetric} from '../../models/ai-model.model';

type SortKey = keyof AiModel;
type ComputedSortKey = 'latency' | 'responseTime';
type SortDir = 'asc' | 'desc';

type NumericCol =
  | 'inputCosts' | 'outputCosts' | 'costsToRun'
  | 'contextWindow' | 'maxInputTokens' | 'maxOutputTokens'
  | 'minVramRequirement'
  | 'overallIntelligence' | 'codingIntelligence' | 'agenticIntelligence'
  | 'tokensPerSecond'
  | 'inputProcessingTime' | 'thinkingTime' | 'outputTime'
  | 'latency' | 'responseTime';

type BoundsFn = (rawMin: number, rawMax: number) => [number, number];

interface ColMeta {
  higherIsBetter: boolean;
  log: boolean;
  get: (m: AiModel) => number;
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
  contextWindow: {higherIsBetter: true, log: false, get: m => m.contextWindow, bounds: niceLinearBounds},
  maxInputTokens: {higherIsBetter: true, log: false, get: m => m.maxInputTokens, bounds: niceLinearBounds},
  maxOutputTokens: {higherIsBetter: true, log: false, get: m => m.maxOutputTokens, bounds: niceLinearBounds},
  minVramRequirement: {higherIsBetter: false, log: true, get: m => m.minVramRequirement, nullIfZeroOrNeg: true, bounds: decadeBounds},
  overallIntelligence: {higherIsBetter: true, log: false, get: m => m.overallIntelligence, bounds: staticBounds(0, 100)},
  codingIntelligence: {higherIsBetter: true, log: false, get: m => m.codingIntelligence, bounds: staticBounds(0, 100)},
  agenticIntelligence: {higherIsBetter: true, log: false, get: m => m.agenticIntelligence, bounds: staticBounds(0, 100)},
  tokensPerSecond: {higherIsBetter: true, log: false, get: m => m.tokensPerSecond, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  inputProcessingTime: {higherIsBetter: false, log: false, get: m => m.inputProcessingTime, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  thinkingTime: {higherIsBetter: false, log: false, get: m => m.thinkingTime, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  outputTime: {higherIsBetter: false, log: false, get: m => m.outputTime, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  latency: {higherIsBetter: false, log: false, get: m => m.inputProcessingTime + m.thinkingTime, nullIfZeroOrNeg: true, bounds: niceLinearBounds},
  responseTime: {
    higherIsBetter: false,
    log: false,
    get: m => m.inputProcessingTime + m.thinkingTime + m.outputTime,
    nullIfZeroOrNeg: true,
    bounds: niceLinearBounds
  },
};

const BAR_COLOR_WORST = [220, 90, 90] as const;
const BAR_COLOR_MID = [210, 200, 110] as const;
const BAR_COLOR_BEST = [120, 220, 130] as const;
const BAR_ALPHA = 0.32;
const BAR_MIN_T = 0.06;

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
  readonly showHistogram = signal(true);
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

  readonly colExtents = computed<Record<NumericCol, Extent>>(() => {
    const models = this.state.filteredModels();
    const out = {} as Record<NumericCol, Extent>;
    (Object.keys(COL_META) as NumericCol[]).forEach(key => {
      const meta = COL_META[key];
      let rawMin = Infinity, rawMax = -Infinity;
      for (const m of models) {
        const v = meta.get(m);
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

  cellStyle(model: AiModel, col: NumericCol): Record<string, string> | null {
    if (!this.showHistogram()) return null;
    const meta = COL_META[col];
    const ext = this.colExtents()[col];
    const v = meta.get(model);
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
