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

/** A model of the peer group that dominates the profile model on intelligence, run cost and (local) VRAM. */
export interface ProfileAlternative {
  model: AiModel;
  reason: string;
}

export interface ProfileEntry {
  model: AiModel;
  group: PeerGroup;
  /** The number of active models in the peer group. */
  peerCount: number;
  headline: string;
  badges: Badge[];
  metrics: ProfileMetric[];
  alternative: ProfileAlternative | null;
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
