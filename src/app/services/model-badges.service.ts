import {Injectable} from '@angular/core';
import {AiModel} from '../models/ai-model.model';
import {Badge, ProfileEntry} from '../models/profile.model';

/** The best-balanced model id per intelligence metric (closest-to-ideal in cost-vs-intelligence space). */
export interface BalancedIds {
  overall: string | null;
  coding: string | null;
  agentic: string | null;
}

const CURRENT_DATE = new Date();
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_MONTH = MS_PER_DAY * 30.4375;

interface Thresholds {
  intelTop: number;
  intelBottom: number;
  codingTop: number;
  agenticTop: number;
  speedTop: number;
  speedTopHigh: number;
  speedBottom: number;
  latencyTop: number;
  latencyBottom: number;
  contextTop: number;
  contextBottom: number;
  contextMedian: number;
  costTop: number;
  costBottom: number;
  costMedian: number;
  valueTop: number;
  oldestMonths: number;
}

interface BestSets {
  overall: Set<string>;
  overallBest: Set<string>;
  coding: Set<string>;
  codingBest: Set<string>;
  agentic: Set<string>;
  agenticBest: Set<string>;
}

interface ModelMetrics {
  intel: number;
  speed: number;
  lat: number;
  ctx: number;
  cost: number;
  value: number;
  months: number;
  cutoffMonths: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

const median = (values: number[]) => percentile(values, 0.5);

function latency(m: AiModel): number {
  return m.inputProcessingTime + m.thinkingTime + m.outputTime;
}

function monthsAgo(date: string | null): number {
  if (!date) return Infinity;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return Infinity;
  return (CURRENT_DATE.getTime() - d.getTime()) / MS_PER_MONTH;
}

function metricsFor(model: AiModel): ModelMetrics {
  const intel = model.overallIntelligence;
  const cost = model.costsToRun;
  return {
    intel,
    speed: model.tokensPerSecond,
    lat: latency(model),
    ctx: model.contextWindow,
    cost,
    value: cost > 0 ? intel / cost : 0,
    months: monthsAgo(model.releaseDate),
    cutoffMonths: monthsAgo(model.cutoffDate),
  };
}

function buildThresholds(baseline: AiModel[]): Thresholds {
  const intel = baseline.map(m => m.overallIntelligence);
  const coding = baseline.map(m => m.codingIntelligence);
  const agentic = baseline.map(m => m.agenticIntelligence);
  const speed = baseline.map(m => m.tokensPerSecond).filter(v => v > 0);
  const latencies = baseline.map(latency).filter(v => v > 0);
  const contexts = baseline.map(m => m.contextWindow).filter(v => v > 0);
  const costs = baseline.map(m => m.costsToRun).filter(v => v > 0);
  const values = baseline
    .filter(m => m.costsToRun > 0)
    .map(m => m.overallIntelligence / m.costsToRun);
  const ages = baseline.map(m => monthsAgo(m.releaseDate)).filter(v => Number.isFinite(v));

  return {
    intelTop: percentile(intel, 0.8),
    intelBottom: percentile(intel, 0.2),
    codingTop: percentile(coding, 0.8),
    agenticTop: percentile(agentic, 0.8),
    speedTop: percentile(speed, 0.8),
    speedTopHigh: percentile(speed, 0.95),
    speedBottom: percentile(speed, 0.2),
    latencyTop: percentile(latencies, 0.8),
    latencyBottom: percentile(latencies, 0.2),
    contextTop: percentile(contexts, 0.8),
    contextBottom: percentile(contexts, 0.25),
    contextMedian: median(contexts),
    costTop: percentile(costs, 0.8),
    costBottom: percentile(costs, 0.25),
    costMedian: median(costs),
    valueTop: percentile(values, 0.8),
    oldestMonths: percentile(ages, 0.8),
  };
}

function buildBestSets(baseline: AiModel[]): BestSets {
  const ranked = (key: (m: AiModel) => number): { top: Set<string>; best: Set<string> } => {
    const sorted = [...baseline].sort((a, b) => key(b) - key(a));
    const ids = sorted.slice(0, 3).map(m => m.id);
    return {top: new Set(ids), best: new Set(ids.slice(0, 1))};
  };
  const o = ranked(m => m.overallIntelligence);
  const c = ranked(m => m.codingIntelligence);
  const a = ranked(m => m.agenticIntelligence);
  return {
    overall: o.top,
    overallBest: o.best,
    coding: c.top,
    codingBest: c.best,
    agentic: a.top,
    agenticBest: a.best,
  };
}

type BadgeRule = {
  when: boolean;
  badge: Omit<Badge, 'kind'>;
};

function strengthRules(model: AiModel, m: ModelMetrics, t: Thresholds, best: BestSets, balancedIds: BalancedIds): BadgeRule[] {
  const topBest = best.overall.has(model.id);
  return [
    {
      when: best.overallBest.has(model.id),
      badge: {
        id: 'best-overall',
        icon: '👑',
        label: 'Best overall',
        tooltip: `#1 by overall intelligence (${model.overallIntelligence})`,
      },
    },
    {
      when: topBest && !best.overallBest.has(model.id),
      badge: {
        id: 'top-overall',
        icon: '👑',
        label: 'Top-tier overall',
        tooltip: `Top 3 by overall intelligence (${model.overallIntelligence})`,
      },
    },
    {
      when: best.codingBest.has(model.id),
      badge: {
        id: 'best-coding',
        icon: '💻',
        label: 'Best at coding',
        tooltip: `#1 by coding intelligence (${model.codingIntelligence})`,
      },
    },
    {
      when: best.coding.has(model.id) && !best.codingBest.has(model.id),
      badge: {
        id: 'top-coding',
        icon: '💻',
        label: 'Top-tier coder',
        tooltip: `Top 3 by coding intelligence (${model.codingIntelligence})`,
      },
    },
    {
      when: best.agenticBest.has(model.id),
      badge: {
        id: 'best-agentic',
        icon: '🤖',
        label: 'Best at agents',
        tooltip: `#1 by agentic intelligence (${model.agenticIntelligence})`,
      },
    },
    {
      when: best.agentic.has(model.id) && !best.agenticBest.has(model.id),
      badge: {
        id: 'top-agentic',
        icon: '🤖',
        label: 'Top-tier agent',
        tooltip: `Top 3 by agentic intelligence (${model.agenticIntelligence})`,
      },
    },
    {
      when: model.codingIntelligence >= t.codingTop && !best.coding.has(model.id),
      badge: {
        id: 'strong-coding',
        icon: '💻',
        label: 'Strong at coding',
        tooltip: `Top 20% coding intelligence (${model.codingIntelligence})`,
      },
    },
    {
      when: model.agenticIntelligence >= t.agenticTop && !best.agentic.has(model.id),
      badge: {
        id: 'strong-agentic',
        icon: '🤖',
        label: 'Strong at agents',
        tooltip: `Top 20% agentic intelligence (${model.agenticIntelligence})`,
      },
    },
    {
      when: model.id === balancedIds.overall,
      badge: {
        id: 'best-balanced-overall',
        icon: '🎯',
        label: 'Best balanced at overall',
        tooltip: 'Closest to the ideal of low cost and high overall intelligence',
      },
    },
    {
      when: model.id === balancedIds.coding,
      badge: {
        id: 'best-balanced-coding',
        icon: '🎯',
        label: 'Best balanced at coding',
        tooltip: 'Closest to the ideal of low cost and high coding intelligence',
      },
    },
    {
      when: model.id === balancedIds.agentic,
      badge: {
        id: 'best-balanced-agentic',
        icon: '🎯',
        label: 'Best balanced at agentic',
        tooltip: 'Closest to the ideal of low cost and high agentic intelligence',
      },
    },
    {
      when: m.intel >= t.intelTop && !topBest,
      badge: {
        id: 'top-intel',
        icon: '🧠',
        label: 'Top intelligence',
        tooltip: `Top 20% on overall intelligence (${m.intel})`,
      },
    },
    {
      when: m.speed >= t.speedTopHigh,
      badge: {
        id: 'fastest',
        icon: '⚡',
        label: 'Fastest',
        tooltip: `Top 5% throughput (${m.speed} tok/s)`,
      },
    },
    {
      when: m.speed >= t.speedTop && m.speed < t.speedTopHigh,
      badge: {
        id: 'very-fast',
        icon: '⚡',
        label: 'Very fast',
        tooltip: `Top 20% throughput (${m.speed} tok/s)`,
      },
    },
    {
      when: m.lat > 0 && m.lat <= t.latencyBottom,
      badge: {
        id: 'low-latency',
        icon: '⏱',
        label: 'Low latency',
        tooltip: `Bottom 20% response time (${m.lat.toFixed(1)}s total)`,
      },
    },
    {
      when: m.ctx >= t.contextTop && m.ctx >= 2 * t.contextMedian,
      badge: {
        id: 'huge-context',
        icon: '📦',
        label: 'Huge context',
        tooltip: `${(m.ctx / 1000).toFixed(0)}K tokens — ≥2× median`,
      },
    },
    {
      when: m.cost > 0 && m.cost <= t.costBottom && m.cost <= 0.5 * t.costMedian,
      badge: {
        id: 'affordable',
        icon: '💰',
        label: 'Affordable',
        tooltip: 'Run cost ≤ ½ median',
      },
    },
    {
      when: m.value >= t.valueTop,
      badge: {
        id: 'great-value',
        icon: '🏆',
        label: 'Great value',
        tooltip: 'Top 20% intelligence-per-dollar (overall)',
      },
    },
    {
      when: m.months <= 3,
      badge: {
        id: 'fresh',
        icon: '🆕',
        label: 'Recently released',
        tooltip: `Released ${model.releaseDate}`,
      },
    },
    {
      when: model.localModel && model.minVramRequirement > 0 && model.minVramRequirement <= 16,
      badge: {
        id: 'low-vram',
        icon: '🖥',
        label: 'Runs on laptop',
        tooltip: `Needs only ${model.minVramRequirement}GB VRAM`,
      },
    },
  ];
}

function weaknessRules(model: AiModel, m: ModelMetrics, t: Thresholds): BadgeRule[] {
  return [
    {
      when: Number.isFinite(m.months) && m.months >= t.oldestMonths && m.intel < t.intelTop,
      badge: {
        id: 'oldest',
        icon: '📅',
        label: 'Old',
        tooltip: `Among the oldest 20% (released ${model.releaseDate})`,
      },
    },
    {
      when: m.speed > 0 && m.speed <= t.speedBottom,
      badge: {
        id: 'slow',
        icon: '🐌',
        label: 'Slow',
        tooltip: `Bottom 20% throughput (${m.speed} tok/s)`,
      },
    },
    {
      when: m.lat > 0 && m.lat >= t.latencyTop,
      badge: {
        id: 'high-latency',
        icon: '⏳',
        label: 'High latency',
        tooltip: `Top 20% response time (${m.lat.toFixed(1)}s total)`,
      },
    },
    {
      when: m.ctx > 0 && m.ctx <= t.contextBottom && m.ctx <= 0.5 * t.contextMedian,
      badge: {
        id: 'small-context',
        icon: '📉',
        label: 'Small context',
        tooltip: `${(m.ctx / 1000).toFixed(0)}K tokens — ≤½ median`,
      },
    },
    {
      when: m.cost > 0 && m.cost >= t.costTop && m.cost >= 5 * t.costMedian,
      badge: {
        id: 'expensive',
        icon: '💸',
        label: 'Expensive',
        tooltip: 'Run cost ≥ 5× median',
      },
    },
    {
      when: m.intel <= t.intelBottom,
      badge: {
        id: 'weak-intel',
        icon: '📊',
        label: 'Lower intelligence',
        tooltip: `Bottom 20% overall intelligence (${m.intel})`,
      },
    },
    {
      when: model.localModel && model.minVramRequirement >= 48,
      badge: {
        id: 'heavy-vram',
        icon: '🏋',
        label: 'Heavy VRAM',
        tooltip: `Needs ${model.minVramRequirement}GB VRAM`,
      },
    },
    {
      when: !!model.cutoffDate && Number.isFinite(m.cutoffMonths) && m.cutoffMonths > 18,
      badge: {
        id: 'stale-knowledge',
        icon: '📚',
        label: 'Stale knowledge',
        tooltip: `Knowledge cutoff ${model.cutoffDate} (${Math.round(m.cutoffMonths)} months ago)`,
      },
    },
  ];
}

function neutralBadges(model: AiModel): Badge[] {
  const out: Badge[] = [];
  if (model.reasoning) {
    out.push({
      id: 'reasoning',
      kind: 'neutral',
      icon: '🧩',
      label: 'Reasoning model',
      tooltip: 'Uses chain-of-thought / thinking tokens',
    });
  }
  out.push({
    id: model.localModel ? 'local' : 'api',
    kind: 'neutral',
    icon: model.localModel ? '🖧' : '☁',
    label: model.localModel ? 'Local' : 'API',
    tooltip: model.localModel
      ? `Runs locally (${model.minVramRequirement}GB VRAM)`
      : 'Hosted API model',
  });
  return out;
}

function applyRules(rules: BadgeRule[], kind: 'strength' | 'weakness'): Badge[] {
  return rules.filter(r => r.when).map(r => ({...r.badge, kind}));
}

function computeBadges(model: AiModel, t: Thresholds, best: BestSets, balancedIds: BalancedIds): Badge[] {
  if (model.deprecated) {
    return [
      {
        id: 'deprecated',
        kind: 'meta',
        icon: '⚠️',
        label: 'Deprecated',
        tooltip: model.deprecationInfo || 'Marked deprecated',
      },
      ...neutralBadges(model),
    ];
  }

  const m = metricsFor(model);
  return [
    ...applyRules(strengthRules(model, m, t, best, balancedIds), 'strength'),
    ...applyRules(weaknessRules(model, m, t), 'weakness'),
    ...neutralBadges(model),
  ];
}

function computeHeadline(badges: Badge[]): string {
  const ids = new Set(badges.map(b => b.id));
  if (ids.has('deprecated')) return 'Deprecated';
  const tier =
    ids.has('best-overall') || ids.has('top-overall') || ids.has('top-intel')
      ? 'Flagship'
      : ids.has('weak-intel')
        ? 'Entry-level'
        : 'Mid-tier';
  const posture =
    ids.has('great-value')
      ? 'great value'
      : ids.has('expensive')
        ? 'premium'
        : ids.has('affordable')
          ? 'budget'
          : '';
  return posture ? `${tier} · ${posture}` : tier;
}

@Injectable({providedIn: 'root'})
export class ModelBadgesService {
  computeProfiles(
    displayModels: AiModel[],
    allModels: AiModel[],
    balancedIds: BalancedIds,
  ): ProfileEntry[] {
    const baseline = allModels.filter(m => !m.deprecated);
    const thresholds = buildThresholds(baseline);
    const best = buildBestSets(baseline);

    return displayModels.map(model => {
      const badges = computeBadges(model, thresholds, best, balancedIds);
      return {
        model,
        headline: computeHeadline(badges),
        badges,
      };
    });
  }
}
