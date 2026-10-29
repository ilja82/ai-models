import {Injectable} from '@angular/core';
import {AiModel, hasEstimatedScore, Modality, MODALITY_LABELS, responseTimeOf} from '../models/ai-model.model';
import {Badge, MetricId, PeerGroup, ProfileAlternative, ProfileEntry, ProfileLevel, ProfileMetric} from '../models/profile.model';
import {effortSeries, otherEffortVariants, parseEffortVariantId} from '../models/effort.util';
import {dominators, ParetoAxis} from '../models/pareto.util';
import {formatUsd, scoreText} from '../models/tooltip.util';
import {PEER_GROUP_LABELS, peerGroupOf, VRAM_LIMITS} from '../models/profile.util';

/** The best-balanced model or effort level id of each peer group (closest-to-ideal in cost-vs-intelligence space). */
export type BalancedIds = Record<PeerGroup, string | null>;

const CURRENT_DATE = new Date();
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_MONTH = MS_PER_DAY * 30.4375;
/** A peer group needs this many models for the percentile badges. */
const MIN_RATED_PEERS = 5;

interface Thresholds {
  rated: boolean;
  intelTop: number;
  intelBottom: number;
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
  newestMonths: number;
}

interface BestSets {
  overall: Set<string>;
  overallBest: Set<string>;
}

interface ModelMetrics {
  /** null for a model without benchmark; no intelligence badge applies then. */
  intel: number | null;
  speed: number;
  lat: number;
  ctx: number;
  cost: number;
  value: number;
  months: number;
  cutoffMonths: number;
}

/** Everything a profile is rated against: the active models of one peer group. */
interface PeerContext {
  group: PeerGroup;
  label: string;
  peers: AiModel[];
  /** The peers plus their other effort levels, as in `AppState.paretoCandidates`. */
  candidates: AiModel[];
  thresholds: Thresholds;
  best: BestSets;
  axes: ParetoAxis<AiModel>[];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

const median = (values: number[]) => percentile(values, 0.5);

// Badges treat 0 as "no value", so a missing measurement maps to 0.
function latency(m: AiModel): number {
  return responseTimeOf(m) ?? 0;
}

function monthsAgo(date: string | null): number {
  if (!date) return Infinity;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return Infinity;
  return (CURRENT_DATE.getTime() - d.getTime()) / MS_PER_MONTH;
}

const positive = (v: number | null): number | null => v !== null && v > 0 ? v : null;

function metricsFor(model: AiModel): ModelMetrics {
  const intel = model.overallIntelligence;
  const cost = model.costsToRun ?? 0;
  return {
    intel,
    speed: model.tokensPerSecond ?? 0,
    lat: latency(model),
    ctx: model.contextWindow ?? 0,
    cost,
    value: cost > 0 && intel !== null ? intel / cost : 0,
    months: monthsAgo(model.releaseDate),
    cutoffMonths: monthsAgo(model.cutoffDate),
  };
}

function buildThresholds(baseline: AiModel[]): Thresholds {
  const intel = baseline.map(m => m.overallIntelligence).filter(v => v !== null);
  const speed = baseline.map(m => m.tokensPerSecond ?? 0).filter(v => v > 0);
  const latencies = baseline.map(latency).filter(v => v > 0);
  const contexts = baseline.map(m => m.contextWindow ?? 0).filter(v => v > 0);
  const costs = baseline.map(m => m.costsToRun ?? 0).filter(v => v > 0);
  const values = baseline
    .filter(m => (m.costsToRun ?? 0) > 0 && m.overallIntelligence !== null)
    .map(m => m.overallIntelligence! / m.costsToRun!);
  const ages = baseline.map(m => monthsAgo(m.releaseDate)).filter(v => Number.isFinite(v));

  return {
    rated: baseline.length >= MIN_RATED_PEERS,
    intelTop: percentile(intel, 0.8),
    intelBottom: percentile(intel, 0.2),
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
    newestMonths: percentile(ages, 0.2),
  };
}

function buildBestSets(baseline: AiModel[]): BestSets {
  const ranked = (key: (m: AiModel) => number | null): { top: Set<string>; best: Set<string> } => {
    const sorted = baseline.filter(m => key(m) !== null).sort((a, b) => key(b)! - key(a)!);
    const ids = sorted.slice(0, 3).map(m => m.id);
    return {top: new Set(ids), best: new Set(ids.slice(0, 1))};
  };
  const o = ranked(m => m.overallIntelligence);
  return {
    overall: o.top,
    overallBest: o.best,
  };
}

function paretoAxes(group: PeerGroup): ParetoAxis<AiModel>[] {
  const axes: ParetoAxis<AiModel>[] = [
    {get: m => m.overallIntelligence, higherIsBetter: true},
    {get: m => m.costsToRun, higherIsBetter: false},
  ];
  return group === 'local' ? [...axes, {get: m => positive(m.minVramRequirement), higherIsBetter: false}] : axes;
}

function buildContext(group: PeerGroup, peers: AiModel[]): PeerContext {
  const axes = paretoAxes(group);
  return {
    group,
    label: PEER_GROUP_LABELS[group],
    peers,
    candidates: peers.concat(peers.flatMap(otherEffortVariants)),
    thresholds: buildThresholds(peers),
    best: buildBestSets(peers),
    axes,
  };
}

type BadgeRule = {
  when: boolean;
  /** true = the rule compares with percentiles of the peer group, so it needs `MIN_RATED_PEERS` peers. */
  relative?: boolean;
  badge: Omit<Badge, 'kind'>;
};

/** Which effort levels of a model are Pareto-optimal: the current one, and the efforts of the others. */
interface FrontState {
  current: boolean;
  otherEfforts: string[];
}

function strengthRules(model: AiModel, m: ModelMetrics, ctx: PeerContext, balancedIds: BalancedIds, front: FrontState): BadgeRule[] {
  const {thresholds: t, best, label} = ctx;
  const balancedId = balancedIds[ctx.group];
  const balanced = balancedId === null ? null : parseEffortVariantId(balancedId);
  const topBest = best.overall.has(model.id);
  return [
    {
      when: best.overallBest.has(model.id),
      badge: {
        id: 'best-overall',
        icon: '👑',
        label: `Best ${label} model`,
        tooltip: `#1 by overall intelligence among the ${label} models (${model.overallIntelligence})`,
      },
    },
    {
      when: topBest && !best.overallBest.has(model.id),
      relative: true,
      badge: {
        id: 'top-overall',
        icon: '👑',
        label: `Top 3 ${label}`,
        tooltip: `Top 3 by overall intelligence among the ${label} models (${model.overallIntelligence})`,
      },
    },
    {
      when: balanced?.modelId === model.id,
      badge: {
        id: 'best-balanced-overall',
        icon: '🎯',
        label: balanced?.effort ? `Best balanced ${label} (effort: ${balanced.effort})` : `Best balanced ${label}`,
        tooltip: `Closest to the ideal of low run cost and high overall intelligence among the ${label} models`,
      },
    },
    {
      when: front.current || front.otherEfforts.length > 0,
      badge: {
        id: 'pareto-front',
        icon: '⭐',
        label: front.current ? 'Pareto-optimal' : `Pareto-optimal at effort ${front.otherEfforts.join(', ')}`,
        tooltip: `No other ${label} model or effort level is at least as good on ${axesText(ctx.group)} and better on one`,
      },
    },
    {
      when: m.intel !== null && m.intel >= t.intelTop && !topBest,
      relative: true,
      badge: {
        id: 'top-intel',
        icon: '🧠',
        label: 'Top intelligence',
        tooltip: `Top 20% of the ${label} models on overall intelligence (${m.intel})`,
      },
    },
    {
      when: m.speed >= t.speedTopHigh,
      relative: true,
      badge: {
        id: 'fastest',
        icon: '⚡',
        label: 'Fastest',
        tooltip: `Top 5% throughput of the ${label} models (${m.speed} tok/s)`,
      },
    },
    {
      when: m.speed >= t.speedTop && m.speed < t.speedTopHigh,
      relative: true,
      badge: {
        id: 'very-fast',
        icon: '⚡',
        label: 'Very fast',
        tooltip: `Top 20% throughput of the ${label} models (${m.speed} tok/s)`,
      },
    },
    {
      when: m.lat > 0 && m.lat <= t.latencyBottom,
      relative: true,
      badge: {
        id: 'low-latency',
        icon: '⏱',
        label: 'Low latency',
        tooltip: `Bottom 20% response time of the ${label} models (${m.lat.toFixed(1)}s total)`,
      },
    },
    {
      when: m.ctx >= t.contextTop && m.ctx >= 2 * t.contextMedian,
      relative: true,
      badge: {
        id: 'huge-context',
        icon: '📦',
        label: 'Huge context',
        tooltip: `${(m.ctx / 1000).toFixed(0)}K tokens, ≥2× the median of the ${label} models`,
      },
    },
    {
      when: m.cost > 0 && m.cost <= t.costBottom && m.cost <= 0.5 * t.costMedian,
      relative: true,
      badge: {
        id: 'affordable',
        icon: '💰',
        label: 'Affordable',
        tooltip: `Run cost ≤ ½ the median of the ${label} models`,
      },
    },
    {
      when: m.value >= t.valueTop,
      relative: true,
      badge: {
        id: 'great-value',
        icon: '🏆',
        label: 'Great value',
        tooltip: `Top 20% intelligence per dollar of the ${label} models`,
      },
    },
    {
      when: m.months <= 3 && m.months <= t.newestMonths,
      relative: true,
      badge: {
        id: 'fresh',
        icon: '🆕',
        label: 'Recently released',
        tooltip: `Released ${model.releaseDate}, among the newest 20% of the ${label} models`,
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

function weaknessRules(model: AiModel, m: ModelMetrics, ctx: PeerContext): BadgeRule[] {
  const {thresholds: t, label} = ctx;
  return [
    {
      when: Number.isFinite(m.months) && m.months >= t.oldestMonths && (m.intel === null || m.intel < t.intelTop),
      relative: true,
      badge: {
        id: 'oldest',
        icon: '📅',
        label: 'Old',
        tooltip: `Among the oldest 20% of the ${label} models (released ${model.releaseDate})`,
      },
    },
    {
      when: m.speed > 0 && m.speed <= t.speedBottom,
      relative: true,
      badge: {
        id: 'slow',
        icon: '🐌',
        label: 'Slow',
        tooltip: `Bottom 20% throughput of the ${label} models (${m.speed} tok/s)`,
      },
    },
    {
      when: m.lat > 0 && m.lat >= t.latencyTop,
      relative: true,
      badge: {
        id: 'high-latency',
        icon: '⏳',
        label: 'High latency',
        tooltip: `Top 20% response time of the ${label} models (${m.lat.toFixed(1)}s total)`,
      },
    },
    {
      when: m.ctx > 0 && m.ctx <= t.contextBottom && m.ctx <= 0.5 * t.contextMedian,
      relative: true,
      badge: {
        id: 'small-context',
        icon: '📉',
        label: 'Small context',
        tooltip: `${(m.ctx / 1000).toFixed(0)}K tokens, ≤½ the median of the ${label} models`,
      },
    },
    {
      when: m.cost > 0 && m.cost >= t.costTop && m.cost >= 5 * t.costMedian,
      relative: true,
      badge: {
        id: 'expensive',
        icon: '💸',
        label: 'Expensive',
        tooltip: `Run cost ≥ 5× the median of the ${label} models`,
      },
    },
    {
      when: m.intel !== null && m.intel <= t.intelBottom,
      relative: true,
      badge: {
        id: 'weak-intel',
        icon: '📊',
        label: 'Lower intelligence',
        tooltip: `Bottom 20% of the ${label} models on overall intelligence (${m.intel})`,
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
  return model.reasoning ? [] : [{
    id: 'no-reasoning',
    kind: 'neutral',
    icon: '💬',
    label: 'No reasoning',
    tooltip: 'Answers without thinking tokens',
  }];
}

function applyRules(rules: BadgeRule[], kind: 'strength' | 'weakness', rated: boolean): Badge[] {
  return rules.filter(r => r.when && (rated || !r.relative)).map(r => ({...r.badge, kind}));
}

function deprecatedBadges(model: AiModel): Badge[] {
  return model.deprecated ? [{
    id: 'deprecated',
    kind: 'meta',
    icon: '⚠️',
    label: 'Deprecated',
    tooltip: model.deprecationInfo || 'Marked deprecated',
  }] : [];
}

/** A deprecated model is not a peer, so it is rated against the active models and takes no best or top-3 badge. */
function computeBadges(model: AiModel, ctx: PeerContext, balancedIds: BalancedIds, front: FrontState): Badge[] {
  const m = metricsFor(model);
  return [
    ...deprecatedBadges(model),
    ...applyRules(strengthRules(model, m, ctx, balancedIds, front), 'strength', ctx.thresholds.rated),
    ...applyRules(weaknessRules(model, m, ctx), 'weakness', ctx.thresholds.rated),
    ...neutralBadges(model),
  ];
}

function axesText(group: PeerGroup): string {
  return group === 'local' ? 'intelligence, run cost and VRAM' : 'intelligence and run cost';
}

interface MetricDef {
  id: MetricId;
  label: string;
  get: (m: AiModel) => number | null;
  format: (v: number) => string;
  higherIsBetter: boolean;
  /** True if the value of the model is an estimate; its text then starts with `~`. */
  estimated?: (m: AiModel) => boolean;
}

const METRIC_DEFS: Record<MetricId, MetricDef> = {
  intelligence: {
    id: 'intelligence', label: 'Intelligence', get: m => m.overallIntelligence,
    format: v => String(v), higherIsBetter: true, estimated: hasEstimatedScore,
  },
  cost: {
    id: 'cost', label: 'Run cost', get: m => m.costsToRun,
    format: v => v === 0 ? 'Free' : formatUsd(v), higherIsBetter: false, estimated: m => m.tokensPerRunEstimated,
  },
  speed: {
    id: 'speed', label: 'Speed', get: m => positive(m.tokensPerSecond),
    format: v => `${v} tok/s`, higherIsBetter: true,
  },
  latency: {
    id: 'latency', label: 'Response', get: m => responseTimeOf(m),
    format: v => `${v.toFixed(1)} s`, higherIsBetter: false,
  },
  vram: {
    id: 'vram', label: 'VRAM', get: m => positive(m.minVramRequirement),
    format: v => `${v} GB`, higherIsBetter: false,
  },
  context: {
    id: 'context', label: 'Context', get: m => positive(m.contextWindow),
    format: v => v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`, higherIsBetter: true,
  },
};

function metricIds(group: PeerGroup): MetricId[] {
  return ['intelligence', 'cost', 'speed', 'latency', group === 'local' ? 'vram' : 'context'];
}

/** 1 - (share of the other peers that are better), so the best peer gets 1 and the worst 0. */
function rankOf(def: MetricDef, value: number, model: AiModel, peers: AiModel[]): number | null {
  const others = peers.filter(p => p.id !== model.id).map(def.get).filter(v => v !== null);
  if (others.length === 0) return null;
  const better = others.filter(v => def.higherIsBetter ? v > value : v < value).length;
  return 1 - better / others.length;
}

/** The value of a metric as text, with `~` if the value of the model is an estimate, or n/a without a value. */
function metricText(def: MetricDef, value: number | null, model: AiModel): string {
  return value === null ? 'n/a' : `${def.estimated?.(model) ? '~' : ''}${def.format(value)}`;
}

function computeMetrics(model: AiModel, ctx: PeerContext): ProfileMetric[] {
  return metricIds(ctx.group).map(id => {
    const def = METRIC_DEFS[id];
    const value = def.get(model);
    return {
      id,
      label: def.label,
      value,
      text: metricText(def, value, model),
      rank: value === null ? null : rankOf(def, value, model, ctx.peers),
    };
  });
}

function missingModalities(alt: AiModel, model: AiModel): string[] {
  const names = (list: readonly Modality[], have: readonly Modality[], kind: string) =>
    list.filter(x => !have.includes(x)).map(x => `${MODALITY_LABELS[x]} ${kind}`);
  return [
    ...names(model.inputModalities, alt.inputModalities, 'input'),
    ...names(model.outputModalities, alt.outputModalities, 'output'),
  ];
}

function alternativeReason(alt: AiModel, model: AiModel): string {
  const parts: string[] = [];
  parts.push(alt.overallIntelligence === model.overallIntelligence
    ? 'same intelligence' : `intelligence ${scoreText(alt)} instead of ${scoreText(model)}`);
  const ac = alt.costsToRun!;
  const mc = model.costsToRun!;
  if (ac < mc) parts.push(`${Math.round((1 - ac / mc) * 100)}% lower run cost`);
  if (model.localModel && alt.minVramRequirement < model.minVramRequirement) {
    parts.push(`${alt.minVramRequirement} GB instead of ${model.minVramRequirement} GB VRAM`);
  }
  const missing = missingModalities(alt, model);
  return missing.length === 0 ? parts.join(', ') : `${parts.join(', ')}, but no ${missing.join(', ')}`;
}

/** The peers and effort levels that dominate the model, the same set test as `AppState.usefulModelIds`. */
function betterPeers(model: AiModel, ctx: PeerContext): AiModel[] {
  return dominators(model, ctx.candidates, ctx.axes);
}

/** True if the model is active, has a value on each Pareto axis and no peer or effort level dominates it. */
function isOnFront(model: AiModel, ctx: PeerContext, better: AiModel[]): boolean {
  return !model.deprecated && better.length === 0 && ctx.axes.every(a => a.get(model) !== null);
}

/**
 * The better peer or effort level with all modalities of the model first, then the highest intelligence,
 * the lowest run cost and the lowest VRAM.
 */
function computeAlternative(model: AiModel, better: AiModel[]): ProfileAlternative | null {
  const [alt] = [...better].sort((a, b) =>
    missingModalities(a, model).length - missingModalities(b, model).length
    || b.overallIntelligence! - a.overallIntelligence!
    || a.costsToRun! - b.costsToRun!
    || a.minVramRequirement - b.minVramRequirement);
  return alt ? {model: alt, effort: parseEffortVariantId(alt.id).effort, reason: alternativeReason(alt, model)} : null;
}

/** One row per effort level, in effort order; empty for a model with fewer than 2 levels. */
function computeLevels(model: AiModel, ctx: PeerContext): ProfileLevel[] {
  if (model.efforts.length < 2) return [];
  return effortSeries(model).map(level => {
    const better = betterPeers(level, ctx);
    const onFront = isOnFront(level, ctx, better);
    return {
      effort: level.effort!,
      current: level.id === model.id,
      intelligenceText: metricText(METRIC_DEFS.intelligence, level.overallIntelligence, level),
      costText: metricText(METRIC_DEFS.cost, level.costsToRun, level),
      onFront,
      alternative: onFront ? null : computeAlternative(level, better),
    };
  });
}

/** True if no peer has a higher value; false without a value or with no other peer. */
function isTop(model: AiModel, peers: AiModel[], get: (m: AiModel) => number | null, higherIsBetter: boolean): boolean {
  const own = get(model);
  if (own === null || peers.length < 2) return false;
  return peers.every(p => {
    const v = get(p);
    return v === null || (higherIsBetter ? v <= own : v >= own);
  });
}

/** The largest VRAM limit up to which no local peer has a higher intelligence. */
function vramRole(model: AiModel, ctx: PeerContext): string | null {
  const own = model.overallIntelligence!;
  const vram = model.minVramRequirement;
  if (vram <= 0) return null;
  const limits = VRAM_LIMITS.filter(limit => vram <= limit && ctx.peers.every(p =>
    p.minVramRequirement <= 0 || p.minVramRequirement > limit || (p.overallIntelligence ?? -Infinity) <= own));
  return limits.length === 0 ? null : `best up to ${limits[limits.length - 1]} GB VRAM`;
}

function computeRole(model: AiModel, ctx: PeerContext): string | null {
  const role = ctx.group === 'local' ? vramRole(model, ctx) : null;
  if (role) return role;
  if (isTop(model, ctx.peers, m => m.overallIntelligence !== null && positive(m.costsToRun) !== null
    ? m.overallIntelligence / m.costsToRun! : null, true)) return 'best value';
  if (isTop(model, ctx.peers, m => m.costsToRun, false)) return 'cheapest';
  if (isTop(model, ctx.peers, METRIC_DEFS.speed.get, true)) return 'fastest';
  return null;
}

/**
 * "#3 of 48 local · best up to 32 GB VRAM"; the #1 model has no role, because the rank says it already.
 * A deprecated model shows the rank it would have if it joined the active models.
 */
function computeHeadline(model: AiModel, ctx: PeerContext): string {
  const prefix = model.deprecated ? 'Deprecated · would be ' : '';
  const own = model.overallIntelligence;
  if (own === null) return model.deprecated ? 'Deprecated · No benchmark' : 'No benchmark';
  const scored = ctx.peers.filter(p => p.overallIntelligence !== null);
  const position = 1 + scored.filter(p => p.overallIntelligence! > own).length;
  const count = scored.length + (model.deprecated ? 1 : 0);
  const rank = `${prefix}#${position} of ${count} ${ctx.label}`;
  const role = position === 1 || model.deprecated ? null : computeRole(model, ctx);
  return role ? `${rank} · ${role}` : rank;
}

@Injectable({providedIn: 'root'})
export class ModelBadgesService {
  /**
   * @param displayModels the models to profile
   * @param peerModels the models to rate against; the deprecated ones are left out
   */
  computeProfiles(
    displayModels: AiModel[],
    peerModels: AiModel[],
    balancedIds: BalancedIds,
  ): ProfileEntry[] {
    const active = peerModels.filter(m => !m.deprecated);
    const contexts: Record<PeerGroup, PeerContext> = {
      api: buildContext('api', active.filter(m => peerGroupOf(m) === 'api')),
      local: buildContext('local', active.filter(m => peerGroupOf(m) === 'local')),
    };

    return displayModels.map(model => {
      const ctx = contexts[peerGroupOf(model)];
      const better = betterPeers(model, ctx);
      const levels = computeLevels(model, ctx);
      const front: FrontState = {
        current: isOnFront(model, ctx, better),
        otherEfforts: levels.filter(l => l.onFront && !l.current).map(l => l.effort),
      };
      const anyOnFront = front.current || front.otherEfforts.length > 0;
      return {
        model,
        group: ctx.group,
        peerCount: ctx.peers.length,
        headline: computeHeadline(model, ctx),
        badges: computeBadges(model, ctx, balancedIds, front),
        metrics: computeMetrics(model, ctx),
        alternative: anyOnFront ? null : computeAlternative(model, better),
        levels,
      };
    });
  }
}
