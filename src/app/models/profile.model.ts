import {AiModel} from './ai-model.model';

export type BadgeKind = 'strength' | 'weakness' | 'neutral' | 'meta';

export interface Badge {
  id: string;
  label: string;
  kind: BadgeKind;
  icon: string;
  tooltip: string;
}

/** The models a profile is rated against: the same hosting only. */
export type PeerGroup = 'api' | 'local';

export type MetricId = 'intelligence' | 'cost' | 'speed' | 'latency' | 'vram' | 'context';

export interface ProfileMetric {
  id: MetricId;
  label: string;
  value: number | null;
  /** The formatted value, or "n/a" without a value. */
  text: string;
  /** 1 = best, 0 = worst of the peer group; null without a value or with fewer than 2 peers. */
  rank: number | null;
}

/** A model or effort level of the peer group that dominates the profile model on intelligence, run cost and (local) VRAM. */
export interface ProfileAlternative {
  /** The model with the values of the level; its id is `<model id>@<effort>` for a level other than the current. */
  model: AiModel;
  /** The effort of a level other than the current; null for the model itself. */
  effort: string | null;
  reason: string;
}

/** One measured effort level of the profile model, rated like a model. */
export interface ProfileLevel {
  effort: string;
  /** True for the level the model entry stands for. */
  current: boolean;
  /** The score, with `~` if it is estimated. */
  intelligenceText: string;
  /** The run cost, with `~` if its token counts are estimated. */
  costText: string;
  onFront: boolean;
  /** The better entry; null on the Pareto front or without a better entry. */
  alternative: ProfileAlternative | null;
}

export interface ProfileEntry {
  model: AiModel;
  group: PeerGroup;
  /** The number of active models in the peer group. */
  peerCount: number;
  headline: string;
  badges: Badge[];
  metrics: ProfileMetric[];
  /** The better entry for the model; null if the model or one of its effort levels is Pareto-optimal. */
  alternative: ProfileAlternative | null;
  /** One row per effort level; empty for a model with fewer than 2 levels. */
  levels: ProfileLevel[];
}

export type ProfileSort = 'intelligence' | 'value' | 'cost' | 'speed' | 'release';

export type ProfileGrouping = 'none' | 'hosting' | 'vram';

/** One card: a model, plus its local twin if both are shown and the cards are not grouped. */
export interface ProfileCard {
  entry: ProfileEntry;
  twin: ProfileEntry | null;
}

export interface ProfileSection {
  id: string;
  /** Empty for the single section without grouping. */
  label: string;
  cards: ProfileCard[];
}
