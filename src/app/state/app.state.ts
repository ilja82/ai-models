import {computed, effect, Injectable, signal} from '@angular/core';
import {
  AiModel,
  hasModalities,
  INPUT_MODALITIES,
  InputModality,
  OUTPUT_MODALITIES,
  OutputModality,
  Provider,
  PROVIDERS,
} from '../models/ai-model.model';
import {AI_MODELS} from '../models/ai-models.data';
import {AXIS_FIELD_KEYS, AxisField, BarMetric, PLOT_TYPE_KEYS, PlotType, ViewTab} from '../models/view-types';
import {parseHash, SCATTER3D_DEFAULTS, serializeHash} from './url-sync';
import {otherEffortVariants} from '../models/effort.util';
import {paretoIds} from '../models/pareto.util';
import {fitTokenFactors} from '../models/token-factors.util';

const KEY = (k: string) => `ai-models.${k}`;

@Injectable({ providedIn: 'root' })
export class AppState {
  readonly allModels = signal<AiModel[]>(AI_MODELS);
  readonly disabledModelIds = signal<Set<string>>(this.loadDisabledIds());

  readonly showAPI = signal(this.loadBool('showAPI', true));
  readonly showLocal = signal(this.loadBool('showLocal', false));
  readonly maxVram = signal<number | null>(this.loadMaxVram());
  readonly showOnlyPareto = signal(this.loadBool('showOnlyPareto', false));
  readonly showDeprecated = signal(this.loadBool('showDeprecated', false));
  readonly hiddenProviders = signal<Provider[]>(this.loadList('hiddenProviders', PROVIDERS));
  readonly showEfforts = signal(this.loadBool('showEfforts', true));
  readonly barGroupByModel = signal(this.loadBool('barGroupByModel', true));
  readonly inputModalities = signal<InputModality[]>(this.loadList('inputModalities', INPUT_MODALITIES));
  readonly outputModalities = signal<OutputModality[]>(this.loadList('outputModalities', OUTPUT_MODALITIES));
  readonly logScaleX = signal(this.loadBool('logScaleX', true));
  readonly logScale3d = signal(this.loadBool('logScale3d', SCATTER3D_DEFAULTS.log));

  readonly activeTab = signal<ViewTab>(this.loadStr('activeTab', 'scatter') as ViewTab);
  readonly barMetric = signal<BarMetric>(this.loadStr('barMetric', 'intelligence') as BarMetric);
  readonly plotType = signal<PlotType>(this.loadPlotType());
  readonly scatter3dX = signal<AxisField>(this.loadAxis('scatter3d.x', SCATTER3D_DEFAULTS.x));
  readonly scatter3dY = signal<AxisField>(this.loadAxis('scatter3d.y', SCATTER3D_DEFAULTS.y));
  readonly scatter3dZ = signal<AxisField>(this.loadAxis('scatter3d.z', SCATTER3D_DEFAULTS.z));

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
      const v = this.showOnlyPareto();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showOnlyPareto'), String(v));
    });
    effect(() => {
      const v = this.showDeprecated();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showDeprecated'), String(v));
    });
    effect(() => {
      const v = this.hiddenProviders();
      if (this.hydrating) return;
      localStorage.setItem(KEY('hiddenProviders'), JSON.stringify(v));
    });
    effect(() => {
      const v = this.showEfforts();
      if (this.hydrating) return;
      localStorage.setItem(KEY('showEfforts'), String(v));
    });
    effect(() => {
      const v = this.barGroupByModel();
      if (this.hydrating) return;
      localStorage.setItem(KEY('barGroupByModel'), String(v));
    });
    effect(() => {
      const v = this.inputModalities();
      if (this.hydrating) return;
      localStorage.setItem(KEY('inputModalities'), JSON.stringify(v));
    });
    effect(() => {
      const v = this.outputModalities();
      if (this.hydrating) return;
      localStorage.setItem(KEY('outputModalities'), JSON.stringify(v));
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
        hiddenProviders: this.hiddenProviders(),
        showEfforts: this.showEfforts(),
        groupByModel: this.barGroupByModel(),
        logScaleX: this.logScaleX(),
        logScale3d: this.logScale3d(),
        onlyPareto: this.showOnlyPareto(),
        inputModalities: this.inputModalities(),
        outputModalities: this.outputModalities(),
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
    this.plotType.set(parsed.plotType ?? 'price');
    this.scatter3dX.set(parsed.scatter3dX ?? SCATTER3D_DEFAULTS.x);
    this.scatter3dY.set(parsed.scatter3dY ?? SCATTER3D_DEFAULTS.y);
    this.scatter3dZ.set(parsed.scatter3dZ ?? SCATTER3D_DEFAULTS.z);
    this.showAPI.set(parsed.showAPI ?? true);
    this.showLocal.set(parsed.showLocal ?? false);
    this.showDeprecated.set(parsed.showDeprecated ?? false);
    this.hiddenProviders.set(parsed.hiddenProviders ?? []);
    this.showEfforts.set(parsed.showEfforts ?? true);
    this.barGroupByModel.set(parsed.groupByModel ?? true);
    this.logScaleX.set(parsed.logScaleX ?? true);
    this.logScale3d.set(parsed.logScale3d ?? SCATTER3D_DEFAULTS.log);
    this.showOnlyPareto.set(parsed.onlyPareto ?? false);
    this.inputModalities.set(parsed.inputModalities ?? []);
    this.outputModalities.set(parsed.outputModalities ?? []);
  }

  private loadStr(key: string, fallback: string): string {
    return localStorage.getItem(KEY(key)) ?? fallback;
  }

  private loadPlotType(): PlotType {
    const v = localStorage.getItem(KEY('plotType'));
    return (PLOT_TYPE_KEYS as readonly string[]).includes(v ?? '') ? v as PlotType : 'price';
  }

  private loadAxis(key: string, fallback: AxisField): AxisField {
    const v = localStorage.getItem(KEY(key));
    return (AXIS_FIELD_KEYS as readonly string[]).includes(v ?? '') ? v as AxisField : fallback;
  }

  private loadList<T extends string>(key: string, known: readonly T[]): T[] {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY(key)) ?? '[]') as unknown;
      return Array.isArray(stored) ? known.filter(m => stored.includes(m)) : [];
    } catch {
      return [];
    }
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

  /** The models that pass every filter except the modality filter, so the filter chips can count their matches. */
  readonly modalityPool = computed(() => {
    const showAPI = this.showAPI();
    const showLocal = this.showLocal();
    const maxVram = this.maxVram();
    const showDeprecated = this.showDeprecated();
    const hiddenProviders = this.hiddenProviders();

    return this.allModels().filter(m => {
      if (m.provider !== null && hiddenProviders.includes(m.provider)) return false;
      if (!showAPI && !m.localModel) return false;
      if (!showLocal && m.localModel) return false;
      if (maxVram !== null && m.localModel && m.minVramRequirement > maxVram) return false;
      if (!showDeprecated && m.deprecated) return false;
      return true;
    });
  });

  readonly availableModels = computed(() => {
    const inputs = this.inputModalities();
    const outputs = this.outputModalities();
    return this.modalityPool().filter(m => hasModalities(m, inputs, outputs));
  });

  readonly filteredModels = computed(() => {
    const disabled = this.disabledModelIds();
    return this.availableModels().filter(m => !disabled.has(m.id));
  });

  /** The models that compete for the run-cost Pareto set and the profile badges, plus their other effort levels while those are shown. */
  readonly paretoCandidates = computed(() => {
    const models = this.filteredModels().filter(m => !m.deprecated);
    return this.showEfforts() ? models.concat(models.flatMap(otherEffortVariants)) : models;
  });

  /** Pareto set on the run cost, for the table. Effort levels have the id `<model id>@<effort>`. */
  readonly usefulModelIds = computed(() => paretoIds(this.paretoCandidates(), [
    {get: m => m.overallIntelligence, higherIsBetter: true},
    {get: m => m.costsToRun, higherIsBetter: false},
  ]));

  /** Token factors of the effort names, fitted over all models, for the estimated effort prices. */
  readonly tokenFactors = computed(() => fitTokenFactors(this.allModels()));

  toggleInputModality(modality: InputModality): void {
    this.inputModalities.update(list => toggled(INPUT_MODALITIES, list, modality));
  }

  toggleOutputModality(modality: OutputModality): void {
    this.outputModalities.update(list => toggled(OUTPUT_MODALITIES, list, modality));
  }

  toggleProvider(provider: Provider): void {
    this.hiddenProviders.update(list => toggled(PROVIDERS, list, provider));
  }

  clearModalities(): void {
    this.inputModalities.set([]);
    this.outputModalities.set([]);
  }

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

function toggled<T extends string>(order: readonly T[], list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : order.filter(x => x === item || list.includes(x));
}
