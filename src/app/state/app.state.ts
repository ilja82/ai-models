import { computed, Injectable, signal } from '@angular/core';
import { AiModel, IntelligenceMetric } from '../models/ai-model.model';
import { AI_MODELS } from '../models/ai-models.data';

@Injectable({ providedIn: 'root' })
export class AppState {
  readonly allModels = signal<AiModel[]>(AI_MODELS);
  readonly disabledModelIds = signal<Set<string>>(new Set());

  readonly intelligenceMetric = signal<IntelligenceMetric>('overall');
  readonly showLiteLLM = signal(true);
  readonly showLocal = signal(true);
  readonly maxVram = signal<number | null>(null);
  readonly showUsefulModels = signal(false);
  readonly logScaleX = signal(false);

  readonly filteredModels = computed(() => {
    const disabled = this.disabledModelIds();
    const showLiteLLM = this.showLiteLLM();
    const showLocal = this.showLocal();
    const maxVram = this.maxVram();

    return this.allModels().filter(m => {
      if (disabled.has(m.id)) return false;
      if (!showLiteLLM && m.availableInLiteLLM && !m.availableForLocal) return false;
      if (!showLocal && m.availableForLocal && !m.availableInLiteLLM) return false;
      if (!showLiteLLM && !showLocal) return false;
      if (maxVram !== null && m.availableForLocal && m.minVramRequirement > maxVram) return false;
      return true;
    });
  });

  readonly usefulModelIds = computed(() => {
    const metric = this.intelligenceMetric();
    const models = this.filteredModels();

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
      const cost = model.costsToRun;
      if (cost < minCostSoFar) {
        useful.push(model.id);
        minCostSoFar = cost;
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
