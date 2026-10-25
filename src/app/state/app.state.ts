import {computed, effect, Injectable, signal} from '@angular/core';
import {AiModel} from '../models/ai-model.model';
import {AI_MODELS} from '../models/ai-models.data';
import {AXIS_FIELD_KEYS, AxisField, BarMetric, PlotType, ViewTab} from '../models/view-types';
import {parseHash, serializeHash} from './url-sync';

const KEY = (k: string) => `ai-models.${k}`;

@Injectable({ providedIn: 'root' })
export class AppState {
  readonly allModels = signal<AiModel[]>(AI_MODELS);
  readonly disabledModelIds = signal<Set<string>>(this.loadDisabledIds());

  readonly showAPI = signal(this.loadBool('showAPI', true));
  readonly showLocal = signal(this.loadBool('showLocal', false));
  readonly maxVram = signal<number | null>(this.loadMaxVram());
  readonly showUsefulModels = signal(this.loadBool('showUsefulModels', true));
  readonly showDeprecated = signal(this.loadBool('showDeprecated', false));
  readonly showEfforts = signal(this.loadBool('showEfforts', false));
  readonly logScaleX = signal(this.loadBool('logScaleX', true));
  readonly logScale3d = signal(this.loadBool('logScale3d', false));

  readonly activeTab = signal<ViewTab>(this.loadStr('activeTab', 'scatter') as ViewTab);
  readonly barMetric = signal<BarMetric>(this.loadStr('barMetric', 'intelligence') as BarMetric);
  readonly plotType = signal<PlotType>(this.loadStr('plotType', 'cost') as PlotType);
  readonly scatter3dX = signal<AxisField>(this.loadAxis('scatter3d.x', 'tokensPerSecond'));
  readonly scatter3dY = signal<AxisField>(this.loadAxis('scatter3d.y', 'costsToRun'));
  readonly scatter3dZ = signal<AxisField>(this.loadAxis('scatter3d.z', 'intelligence'));

  // While true, the localStorage effects skip their writes.
  private hydrating = true;

  constructor() {
    effect(() => {
      const v = this.maxVram();
      if (this.hydrating) return;
      localStorage.setItem(KEY('maxVram'), v === null ? '' : String(v));
    });
    effect(() => {
      const v = this.showAPI();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showAPI'), String(v));
    });
    effect(() => {
      const v = this.showLocal();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showLocal'), String(v));
    });
    effect(() => {
      const v = this.showUsefulModels();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showUsefulModels'), String(v));
    });
    effect(() => {
      const v = this.showDeprecated();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showDeprecated'), String(v));
    });
    effect(() => {
      const v = this.showEfforts();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showEfforts'), String(v));
    });
    effect(() => {
      const v = this.logScaleX();
      if (this.hydrating) return;
      localStorage.setItem(KEY('logScaleX'), String(v));
    });
    effect(() => {
      const v = this.logScale3d();
      if (this.hydrating) return;
      localStorage.setItem(KEY('logScale3d'), String(v));
    });
    effect(() => {
      const v = this.disabledModelIds();
      if (this.hydrating) return;
      localStorage.setItem(KEY('disabledIds'), JSON.stringify([...v]));
    });
    effect(() => {
      const v = this.activeTab();
      if (this.hydrating) return;
      localStorage.setItem(KEY('activeTab'), v);
    });
    effect(() => {
      const v = this.barMetric();
      if (this.hydrating) return;
      localStorage.setItem(KEY('barMetric'), v);
    });
    effect(() => {
      const v = this.plotType();
      if (this.hydrating) return;
      localStorage.setItem(KEY('plotType'), v);
    });
    effect(() => {
      const v = this.scatter3dX();
      if (this.hydrating) return;
      localStorage.setItem(KEY('scatter3d.x'), v);
    });
    effect(() => {
      const v = this.scatter3dY();
      if (this.hydrating) return;
      localStorage.setItem(KEY('scatter3d.y'), v);
    });
    effect(() => {
      const v = this.scatter3dZ();
      if (this.hydrating) return;
      localStorage.setItem(KEY('scatter3d.z'), v);
    });

    // URL writeback. It has no hydrating guard on purpose.
    effect(() => {
      const hash = serializeHash({
        view: this.activeTab(),
        barMetric: this.barMetric(),
        plotType: this.plotType(),
        scatter3dX: this.scatter3dX(),
        scatter3dY: this.scatter3dY(),
        scatter3dZ: this.scatter3dZ(),
        showAPI: this.showAPI(),
        showLocal: this.showLocal(),
        showDeprecated: this.showDeprecated(),
        showEfforts: this.showEfforts(),
        logScaleX: this.logScaleX(),
        logScale3d: this.logScale3d(),
        showUseful: this.showUsefulModels(),
      });
      if (typeof window === 'undefined') return;
      if (window.location.hash !== hash) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
      }
    });

    if (typeof window !== 'undefined') {
      this.applyUrlState(window.location.hash);
      window.addEventListener('popstate', () => {
        this.hydrating = true;
        this.applyUrlState(window.location.hash);
        setTimeout(() => {
          this.hydrating = false;
        }, 0);
      });
    }

    setTimeout(() => {
      this.hydrating = false;
    }, 0);
  }

  private applyUrlState(hash: string): void {
    const parsed = parseHash(hash);
    if (!parsed) return;
    // Missing fields fall back to defaults, not to persisted values.
    this.activeTab.set(parsed.view);
    this.barMetric.set(parsed.barMetric ?? 'intelligence');
    this.plotType.set(parsed.plotType ?? 'cost');
    this.scatter3dX.set(parsed.scatter3dX ?? 'tokensPerSecond');
    this.scatter3dY.set(parsed.scatter3dY ?? 'costsToRun');
    this.scatter3dZ.set(parsed.scatter3dZ ?? 'intelligence');
    this.showAPI.set(parsed.showAPI ?? true);
    this.showLocal.set(parsed.showLocal ?? false);
    this.showDeprecated.set(parsed.showDeprecated ?? false);
    this.showEfforts.set(parsed.showEfforts ?? false);
    this.logScaleX.set(parsed.logScaleX ?? true);
    this.logScale3d.set(parsed.logScale3d ?? false);
    this.showUsefulModels.set(parsed.showUseful ?? true);
  }

  private loadStr(key: string, fallback: string): string {
    return localStorage.getItem(KEY(key)) ?? fallback;
  }

  private loadAxis(key: string, fallback: AxisField): AxisField {
    const v = localStorage.getItem(KEY(key));
    return (AXIS_FIELD_KEYS as readonly string[]).includes(v ?? '') ? v as AxisField : fallback;
  }

  private loadBool(key: string, fallback: boolean): boolean {
    const v = localStorage.getItem(KEY(key));
    return v === null ? fallback : v === 'true';
  }

  private loadMaxVram(): number | null {
    const stored = localStorage.getItem(KEY('maxVram'));
    if (stored === null) return 32;
    if (stored === '') return null;
    const num = parseFloat(stored);
    return isNaN(num) ? 32 : num;
  }

  private loadDisabledIds(): Set<string> {
    try {
      const stored = localStorage.getItem(KEY('disabledIds'));
      if (!stored) return new Set();
      return new Set(JSON.parse(stored) as string[]);
    } catch {
      return new Set();
    }
  }

  readonly availableModels = computed(() => {
    const showAPI = this.showAPI();
    const showLocal = this.showLocal();
    const maxVram = this.maxVram();
    const showDeprecated = this.showDeprecated();

    return this.allModels().filter(m => {
      if (!showAPI && !m.localModel) return false;
      if (!showLocal && m.localModel) return false;
      if (maxVram !== null && m.localModel && m.minVramRequirement > maxVram) return false;
      if (!showDeprecated && m.deprecated) return false;
      return true;
    });
  });

  readonly filteredModels = computed(() => {
    const disabled = this.disabledModelIds();
    return this.availableModels().filter(m => !disabled.has(m.id));
  });

  readonly usefulModelIds = computed(() => {
    const models = this.filteredModels().filter(m => !m.deprecated && m.costsToRun !== null);

    // Sort by intelligence descending, then by cost ascending for tiebreaking
    const sorted = [...models].sort((a, b) => {
      const diff = b.overallIntelligence - a.overallIntelligence;
      return diff !== 0 ? diff : a.costsToRun! - b.costsToRun!;
    });

    const useful: string[] = [];
    let minCostSoFar = Infinity;

    for (const model of sorted) {
      if (model.costsToRun! < minCostSoFar) {
        useful.push(model.id);
        minCostSoFar = model.costsToRun!;
      }
    }

    return new Set(useful);
  });

  toggleModel(id: string): void {
    this.disabledModelIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}
