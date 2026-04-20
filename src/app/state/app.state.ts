import {computed, effect, Injectable, signal} from '@angular/core';
import {AiModel, IntelligenceMetric} from '../models/ai-model.model';
import {AI_MODELS} from '../models/ai-models.data';

const KEY = (k: string) => `ai-models.${k}`;

@Injectable({ providedIn: 'root' })
export class AppState {
  readonly allModels = signal<AiModel[]>(AI_MODELS);
  readonly disabledModelIds = signal<Set<string>>(this.loadDisabledIds());

  readonly intelligenceMetric = signal<IntelligenceMetric>(this.loadStr('metric', 'overall') as IntelligenceMetric);
  readonly showAPI = signal(this.loadBool('showAPI', true));
  readonly showLocal = signal(this.loadBool('showLocal', false));
  readonly maxVram = signal<number | null>(this.loadMaxVram());
  readonly showUsefulModels = signal(this.loadBool('showUsefulModels', true));
  readonly showDeprecated = signal(this.loadBool('showDeprecated', false));
  readonly logScaleX = signal(this.loadBool('logScaleX', true));
  readonly logScale3d = signal(this.loadBool('logScale3d', false));

  constructor() {
    effect(() => {
      const v = this.maxVram();
      localStorage.setItem(KEY('maxVram'), v === null ? '' : String(v));
    });
    effect(() => {
      localStorage.setItem(KEY('metric'), this.intelligenceMetric());
    });
    effect(() => {
      localStorage.setItem(KEY('showAPI'), String(this.showAPI()));
    });
    effect(() => {
      localStorage.setItem(KEY('showLocal'), String(this.showLocal()));
    });
    effect(() => {
      localStorage.setItem(KEY('showUsefulModels'), String(this.showUsefulModels()));
    });
    effect(() => {
      localStorage.setItem(KEY('showDeprecated'), String(this.showDeprecated()));
    });
    effect(() => {
      localStorage.setItem(KEY('logScaleX'), String(this.logScaleX()));
    });
    effect(() => {
      localStorage.setItem(KEY('logScale3d'), String(this.logScale3d()));
    });
    effect(() => {
      localStorage.setItem(KEY('disabledIds'), JSON.stringify([...this.disabledModelIds()]));
    });
  }

  private loadStr(key: string, fallback: string): string {
    return localStorage.getItem(KEY(key)) ?? fallback;
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
    const metric = this.intelligenceMetric();
    const models = this.filteredModels().filter(m => !m.deprecated);

    const getIntelligence = (m: AiModel) => {
      if (metric === 'coding') return m.codingIntelligence;
      if (metric === 'agentic') return m.agenticIntelligence;
      return m.overallIntelligence;
    };

    // Sort by intelligence descending, then by cost ascending for tiebreaking
    const sorted = [...models].sort((a, b) => {
      const diff = getIntelligence(b) - getIntelligence(a);
      return diff !== 0 ? diff : a.costsToRun - b.costsToRun;
    });

    const useful: string[] = [];
    let minCostSoFar = Infinity;

    for (const model of sorted) {
      if (model.costsToRun < minCostSoFar) {
        useful.push(model.id);
        minCostSoFar = model.costsToRun;
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

  getIntelligence(model: AiModel): number {
    const metric = this.intelligenceMetric();
    if (metric === 'coding') return model.codingIntelligence;
    if (metric === 'agentic') return model.agenticIntelligence;
    return model.overallIntelligence;
  }
}
