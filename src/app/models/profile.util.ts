import {AiModel, byIntelligenceDesc, releaseTimeOf} from './ai-model.model';
import {PeerGroup, ProfileCard, ProfileEntry, ProfileGrouping, ProfileSection, ProfileSort} from './profile.model';

/** Upper VRAM limits in GB of the local classes; a larger model is in the last class. */
export const VRAM_LIMITS = [16, 32, 128] as const;

export const PEER_GROUP_LABELS: Record<PeerGroup, string> = {api: 'API', local: 'local'};

export const PROFILE_SORT_LABELS: Record<ProfileSort, string> = {
  intelligence: 'Intelligence',
  value: 'Value',
  cost: 'Run cost',
  speed: 'Speed',
  release: 'Release',
};

export const PROFILE_GROUPING_LABELS: Record<ProfileGrouping, string> = {
  none: 'None',
  hosting: 'API / local',
  vram: 'VRAM class',
};

export function peerGroupOf(model: Pick<AiModel, 'localModel'>): PeerGroup {
  return model.localModel ? 'local' : 'api';
}

/** The API entry id of a local entry, by the `-local` id suffix; null for an API entry. */
export function apiTwinId(model: Pick<AiModel, 'id' | 'localModel'>): string | null {
  return model.localModel && model.id.endsWith('-local') ? model.id.slice(0, -'-local'.length) : null;
}

/** Index into `VRAM_LIMITS` (or its length for the largest class); null without a VRAM value. */
export function vramClassOf(vram: number): number | null {
  if (vram <= 0) return null;
  const i = VRAM_LIMITS.findIndex(limit => vram <= limit);
  return i === -1 ? VRAM_LIMITS.length : i;
}

function vramClassLabel(index: number | null): string {
  if (index === null) return 'Local, VRAM unknown';
  if (index === 0) return `Local, up to ${VRAM_LIMITS[0]} GB VRAM`;
  if (index === VRAM_LIMITS.length) return `Local, over ${VRAM_LIMITS[index - 1]} GB VRAM`;
  return `Local, ${VRAM_LIMITS[index - 1] + 1} to ${VRAM_LIMITS[index]} GB VRAM`;
}

function valueOf(m: AiModel): number | null {
  return m.overallIntelligence !== null && m.costsToRun !== null && m.costsToRun > 0
    ? m.overallIntelligence / m.costsToRun : null;
}

const SORT_KEYS: Record<ProfileSort, { get: (m: AiModel) => number | null; higherIsBetter: boolean }> = {
  intelligence: {get: m => m.overallIntelligence, higherIsBetter: true},
  value: {get: valueOf, higherIsBetter: true},
  cost: {get: m => m.costsToRun, higherIsBetter: false},
  speed: {get: m => m.tokensPerSecond !== null && m.tokensPerSecond > 0 ? m.tokensPerSecond : null, higherIsBetter: true},
  release: {get: releaseTimeOf, higherIsBetter: true},
};

/** Best first by the key; deprecated models and missing values last; ties by intelligence, then release. */
export function sortProfiles(entries: ProfileEntry[], sort: ProfileSort): ProfileEntry[] {
  const key = SORT_KEYS[sort];
  return [...entries].sort((x, y) => {
    const a = x.model;
    const b = y.model;
    if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
    const va = key.get(a);
    const vb = key.get(b);
    const fa = va !== null && Number.isFinite(va);
    const fb = vb !== null && Number.isFinite(vb);
    if (fa !== fb) return fa ? -1 : 1;
    if (fa && fb && va !== vb) return key.higherIsBetter ? vb! - va! : va! - vb!;
    const intelDiff = byIntelligenceDesc(a, b);
    if (intelDiff !== 0) return intelDiff;
    return (b.releaseDate || '').localeCompare(a.releaseDate || '');
  });
}

function mergeTwins(entries: ProfileEntry[]): ProfileCard[] {
  const byId = new Map(entries.map(e => [e.model.id, e]));
  const localOf = new Map<string, ProfileEntry>();
  for (const e of entries) {
    const apiId = apiTwinId(e.model);
    if (apiId !== null && byId.has(apiId)) localOf.set(apiId, e);
  }
  const merged = new Set([...localOf.values()].map(e => e.model.id));
  return entries
    .filter(e => !merged.has(e.model.id))
    .map(e => ({entry: e, twin: localOf.get(e.model.id) ?? null}));
}

const single = (entry: ProfileEntry): ProfileCard => ({entry, twin: null});

/** Splits sorted entries into sections; keeps the order inside each section. Leaves out empty sections. */
export function groupProfiles(entries: ProfileEntry[], grouping: ProfileGrouping): ProfileSection[] {
  if (grouping === 'none') return [{id: 'all', label: '', cards: mergeTwins(entries)}];

  const api: ProfileSection = {id: 'api', label: 'API models', cards: entries.filter(e => !e.model.localModel).map(single)};
  const local = entries.filter(e => e.model.localModel);
  if (grouping === 'hosting') {
    return [api, {id: 'local', label: 'Local models', cards: local.map(single)}].filter(s => s.cards.length > 0);
  }

  const classes = [...VRAM_LIMITS.keys(), VRAM_LIMITS.length, null];
  const sections = classes.map(c => ({
    id: `vram-${c ?? 'unknown'}`,
    label: vramClassLabel(c),
    cards: local.filter(e => vramClassOf(e.model.minVramRequirement) === c).map(single),
  }));
  return [api, ...sections].filter(s => s.cards.length > 0);
}
