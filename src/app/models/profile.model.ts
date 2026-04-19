import {AiModel} from './ai-model.model';

export type BadgeKind = 'strength' | 'weakness' | 'neutral' | 'meta';

export interface Badge {
  id: string;
  label: string;
  kind: BadgeKind;
  icon: string;
  tooltip: string;
}

export interface ProfileEntry {
  model: AiModel;
  headline: string;
  badges: Badge[];
}
