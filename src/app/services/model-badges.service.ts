import {Injectable} from '@angular/core';
import {AiModel, IntelligenceMetric} from '../models/ai-model.model';
import {Badge, ProfileEntry} from '../models/profile.model';

const CURRENT_DATE = new Date();
const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface Thresholds {
  intelTop: number;
  intelBottom: number;
  speedTop: number;
  speedTopHigh: number;
  speedBottom: number;
  latencyTop: number;
  latencyBottom: number;
  contextTop: number;
  contextBottom: number;
  costTop: number;
  costBottom: number;
  valueTop: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

function getIntel(m: AiModel, metric: IntelligenceMetric): number {
  if (metric === 'coding') return m.codingIntelligence;
  if (metric === 'agentic') return m.agenticIntelligence;
  return m.overallIntelligence;
}

function latency(m: AiModel): number {
  return m.inputProcessingTime + m.thinkingTime + m.outputTime;
}

function monthsAgo(releaseDate: string): number {
  const d = new Date(releaseDate);
  if (Number.isNaN(d.getTime())) return Infinity;
  return (CURRENT_DATE.getTime() - d.getTime()) / (MS_PER_DAY * 30.4375);
}

function buildThresholds(baseline: AiModel[], metric: IntelligenceMetric): Thresholds {
  const intel = baseline.map(m => getIntel(m, metric));
  const speed = baseline.map(m => m.tokensPerSecond).filter(v => v > 0);
  const latencies = baseline.map(latency).filter(v => v > 0);
  const contexts = baseline.map(m => m.contextWindow);
  const costs = baseline.map(m => m.costsToRun).filter(v => v > 0);
  const values = baseline
    .filter(m => m.costsToRun > 0)
    .map(m => getIntel(m, metric) / m.costsToRun);

  return {
    intelTop: percentile(intel, 0.8),
    intelBottom: percentile(intel, 0.2),
    speedTop: percentile(speed, 0.8),
    speedTopHigh: percentile(speed, 0.95),
    speedBottom: percentile(speed, 0.2),
    latencyTop: percentile(latencies, 0.8),
    latencyBottom: percentile(latencies, 0.2),
    contextTop: percentile(contexts, 0.8),
    contextBottom: percentile(contexts, 0.25),
    costTop: percentile(costs, 0.8),
    costBottom: percentile(costs, 0.25),
    valueTop: percentile(values, 0.8),
  };
}

function computeBadges(
  model: AiModel,
  t: Thresholds,
  metric: IntelligenceMetric,
  usefulIds: Set<string>,
): Badge[] {
  const badges: Badge[] = [];
  const metricLabel = metric === 'coding' ? 'coding' : metric === 'agentic' ? 'agentic' : 'overall';

  if (model.deprecated) {
    badges.push({
      id: 'deprecated',
      kind: 'meta',
      icon: '⚠️',
      label: 'Deprecated',
      tooltip: model.deprecationInfo || 'Marked deprecated',
    });
  }

  const intel = getIntel(model, metric);
  const speed = model.tokensPerSecond;
  const lat = latency(model);
  const ctx = model.contextWindow;
  const cost = model.costsToRun;
  const value = cost > 0 ? intel / cost : 0;
  const months = monthsAgo(model.releaseDate);

  if (!model.deprecated) {
    if (usefulIds.has(model.id)) {
      badges.push({
        id: 'pareto',
        kind: 'strength',
        icon: '★',
        label: 'Pareto-efficient',
        tooltip: 'Best intelligence at this price point — no visible model is both smarter and cheaper',
      });
    }

    if (intel >= t.intelTop) {
      badges.push({
        id: 'top-intel',
        kind: 'strength',
        icon: '🧠',
        label: 'Top intelligence',
        tooltip: `Top 20% on ${metricLabel} intelligence (${intel})`,
      });
    }

    if (speed >= t.speedTopHigh) {
      badges.push({
        id: 'fastest',
        kind: 'strength',
        icon: '⚡',
        label: 'Fastest',
        tooltip: `Top 5% throughput (${speed} tok/s)`,
      });
    } else if (speed >= t.speedTop) {
      badges.push({
        id: 'very-fast',
        kind: 'strength',
        icon: '⚡',
        label: 'Very fast',
        tooltip: `Top 20% throughput (${speed} tok/s)`,
      });
    }

    if (lat > 0 && lat <= t.latencyBottom) {
      badges.push({
        id: 'low-latency',
        kind: 'strength',
        icon: '⏱',
        label: 'Low latency',
        tooltip: `Bottom 20% response time (${lat.toFixed(1)}s total)`,
      });
    }

    if (ctx >= t.contextTop) {
      badges.push({
        id: 'huge-context',
        kind: 'strength',
        icon: '📦',
        label: 'Huge context',
        tooltip: `${(ctx / 1000).toFixed(0)}K tokens — top 20%`,
      });
    }

    if (cost > 0 && cost <= t.costBottom) {
      badges.push({
        id: 'affordable',
        kind: 'strength',
        icon: '💰',
        label: 'Affordable',
        tooltip: `Bottom 25% run cost ($${cost.toFixed(2)}/M tokens)`,
      });
    }

    if (value >= t.valueTop) {
      badges.push({
        id: 'great-value',
        kind: 'strength',
        icon: '🏆',
        label: 'Great value',
        tooltip: 'Top 20% intelligence-per-dollar',
      });
    }

    if (model.codingIntelligence - model.overallIntelligence >= 3) {
      badges.push({
        id: 'coding-specialist',
        kind: 'strength',
        icon: '💻',
        label: 'Coding specialist',
        tooltip: `Coding intelligence (${model.codingIntelligence}) beats overall (${model.overallIntelligence})`,
      });
    }

    if (model.agenticIntelligence - model.overallIntelligence >= 3) {
      badges.push({
        id: 'agentic-specialist',
        kind: 'strength',
        icon: '🤖',
        label: 'Agentic specialist',
        tooltip: `Agentic intelligence (${model.agenticIntelligence}) beats overall (${model.overallIntelligence})`,
      });
    }

    if (months <= 6) {
      badges.push({
        id: 'fresh',
        kind: 'strength',
        icon: '🆕',
        label: 'Recently released',
        tooltip: `Released ${model.releaseDate}`,
      });
    }

    if (model.localModel && model.minVramRequirement > 0 && model.minVramRequirement <= 16) {
      badges.push({
        id: 'low-vram',
        kind: 'strength',
        icon: '🖥',
        label: 'Runs on laptop',
        tooltip: `Needs only ${model.minVramRequirement}GB VRAM`,
      });
    }
  }

  if (!model.deprecated && months > 18 && intel < t.intelTop) {
    badges.push({
      id: 'outdated',
      kind: 'weakness',
      icon: '📅',
      label: 'Outdated',
      tooltip: `Released ${model.releaseDate} — over 18 months old`,
    });
  }

  if (speed > 0 && speed <= t.speedBottom) {
    badges.push({
      id: 'slow',
      kind: 'weakness',
      icon: '🐌',
      label: 'Slow',
      tooltip: `Bottom 20% throughput (${speed} tok/s)`,
    });
  }

  if (lat > 0 && lat >= t.latencyTop) {
    badges.push({
      id: 'high-latency',
      kind: 'weakness',
      icon: '⏳',
      label: 'High latency',
      tooltip: `Top 20% response time (${lat.toFixed(1)}s total)`,
    });
  }

  if (ctx <= t.contextBottom) {
    badges.push({
      id: 'small-context',
      kind: 'weakness',
      icon: '📉',
      label: 'Small context',
      tooltip: `${(ctx / 1000).toFixed(0)}K tokens — bottom 25%`,
    });
  }

  if (cost > 0 && cost >= t.costTop) {
    badges.push({
      id: 'expensive',
      kind: 'weakness',
      icon: '💸',
      label: 'Expensive',
      tooltip: `Top 20% run cost ($${cost.toFixed(2)}/M tokens)`,
    });
  }

  if (intel <= t.intelBottom) {
    badges.push({
      id: 'weak-intel',
      kind: 'weakness',
      icon: '📊',
      label: 'Lower intelligence',
      tooltip: `Bottom 20% on ${metricLabel} intelligence (${intel})`,
    });
  }

  if (model.localModel && model.minVramRequirement >= 48) {
    badges.push({
      id: 'heavy-vram',
      kind: 'weakness',
      icon: '🏋',
      label: 'Heavy VRAM',
      tooltip: `Needs ${model.minVramRequirement}GB VRAM`,
    });
  }

  if (model.reasoning) {
    badges.push({
      id: 'reasoning',
      kind: 'neutral',
      icon: '🧩',
      label: 'Reasoning model',
      tooltip: 'Uses chain-of-thought / thinking tokens',
    });
  }

  badges.push({
    id: model.localModel ? 'local' : 'api',
    kind: 'neutral',
    icon: model.localModel ? '🖧' : '☁',
    label: model.localModel ? 'Local' : 'API',
    tooltip: model.localModel
      ? `Runs locally (${model.minVramRequirement}GB VRAM)`
      : 'Hosted API model',
  });

  return badges;
}

function computeHeadline(badges: Badge[]): string {
  const ids = new Set(badges.map(b => b.id));
  const strengths = badges.filter(b => b.kind === 'strength').length;
  const weaknesses = badges.filter(b => b.kind === 'weakness').length;

  if (ids.has('deprecated')) return 'Deprecated — avoid';
  if (ids.has('outdated') && strengths === 0) return 'Outdated';
  if (ids.has('pareto') && ids.has('top-intel')) return 'Frontier model';
  if (ids.has('coding-specialist') && (ids.has('great-value') || ids.has('affordable'))) return 'Budget coder';
  if (ids.has('agentic-specialist')) return 'Agent-tuned';
  if (ids.has('great-value') && (ids.has('fastest') || ids.has('very-fast'))) return 'Fast & cheap';
  if (ids.has('top-intel') && ids.has('expensive')) return 'Premium flagship';
  if (ids.has('low-vram') && (ids.has('great-value') || ids.has('affordable'))) return 'Home-lab pick';
  if (ids.has('fastest') || ids.has('very-fast')) return 'Speed-focused';
  if (ids.has('huge-context')) return 'Long-context specialist';
  if (strengths >= 3 && weaknesses <= 1) return 'Balanced all-rounder';
  if (strengths === 0 && weaknesses >= 2) return 'Niche / limited';
  return 'General-purpose';
}

@Injectable({providedIn: 'root'})
export class ModelBadgesService {
  computeProfiles(
    displayModels: AiModel[],
    allModels: AiModel[],
    metric: IntelligenceMetric,
    usefulIds: Set<string>,
  ): ProfileEntry[] {
    const baseline = allModels.filter(m => !m.deprecated);
    const thresholds = buildThresholds(baseline, metric);

    return displayModels.map(model => {
      const badges = computeBadges(model, thresholds, metric, usefulIds);
      return {
        model,
        headline: computeHeadline(badges),
        badges,
      };
    });
  }
}
