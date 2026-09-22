import type { ContentDB, EraId } from '../types/content';
import type { CharacterState, DerivedWorld, HistoryEntry, TimelineSnapshot, WorldState } from '../types/state';

export const MAX_SNAPSHOTS = 3;

/**
 * The era visited last in play has the final say. Replaying the same era and site replaces the
 * earlier decision, and editing an era upstream of one you already changed rewrites everything
 * downstream of it at that site: a different 2031 means the 2148 you built no longer happened.
 * Choices at other sites are untouched.
 */
export function activeChoices(history: HistoryEntry[]): HistoryEntry[] {
  let active: HistoryEntry[] = [];
  for (const h of history) {
    active = active.filter((a) => a.site !== h.site || Number(a.era) < Number(h.era));
    active.push(h);
  }
  return [...active].sort((a, b) => a.order - b.order);
}

/** History entries an edit at this era and site would erase, for warning the player first. */
export function choicesOverwrittenBy(history: HistoryEntry[], era: EraId, site: string): HistoryEntry[] {
  return activeChoices(history).filter((a) => a.site === site && Number(a.era) >= Number(era));
}

export function continuityFor(content: ContentDB, world: WorldState, cs: CharacterState): number {
  const def = content.characters[cs.id];
  if (!def) return 100;
  const edits = world.history.filter((h) => h.era === def.homeEra && h.order >= cs.recruitedAt).length;
  const { continuityPerEdit, continuityFloor } = content.rules;
  // Edits to a home era thin it; Entropy breaking over someone tears a piece off for good.
  return Math.max(continuityFloor, 100 - continuityPerEdit * edits - (cs.frayed ?? 0));
}

export function endingFor(ownership: number, sync: number, flags: string[]): string {
  if (ownership >= 50 && flags.includes('youngStrandInParty')) return 'Reconciled';
  if (ownership >= 50 && sync >= -30 && sync <= 30) return 'The Commons';
  if (sync >= 60 && ownership < 50) return 'The Gift';
  if (sync <= -60) return 'The Silence';
  return 'Perpetuity';
}

export function deriveWorld(content: ContentDB, world: WorldState, party: Record<string, CharacterState>): DerivedWorld {
  const active = activeChoices(world.history);
  let ownership = world.baseOwnership;
  let sync = world.baseSync;
  const flags = new Set<string>();
  for (const h of active) {
    const c = content.timelineChoices[h.choiceId];
    if (!c) continue;
    ownership += c.ownershipDelta;
    sync += c.syncDelta;
    for (const f of c.flags) flags.add(f);
    for (const f of c.partyEffects) flags.add(f);
  }
  ownership = clamp(ownership, -100, 100);
  sync = clamp(sync, -100, 100);
  const continuity: Record<string, number> = {};
  for (const cs of Object.values(party)) continuity[cs.id] = continuityFor(content, world, cs);
  const flagList = [...flags];
  return { ownership, sync, flags: flagList, continuity, activeChoices: active, ending: endingFor(ownership, sync, flagList) };
}

export function applyChoice(content: ContentDB, world: WorldState, choiceId: string, now: number): WorldState {
  const c = content.timelineChoices[choiceId];
  if (!c) throw new Error(`Unknown timeline choice ${choiceId}`);
  const entry: HistoryEntry = { order: world.history.length, choiceId, era: c.era, site: c.site };
  const history = [...world.history, entry];
  const snap: TimelineSnapshot = { takenAt: now, label: c.name, history };
  const snapshots = [...world.snapshots, snap].slice(-MAX_SNAPSHOTS);
  return { ...world, history, snapshots };
}

export function markVisited(world: WorldState, era: EraId): WorldState {
  if (world.visitedEras.includes(era)) return world;
  return { ...world, visitedEras: [...world.visitedEras, era] };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
