import type { ContentDB, EncounterDef } from '../types/content';
import type { GameState, ScanState } from '../types/state';
import { evalCondition, type ConditionContext } from './conditions';
import { roll, rollInt } from './rng';
import { partyLoadouts, partyMaxStat, partySync } from './stats';
import { deriveWorld } from './timeline';

export function conditionContext(content: ContentDB, state: GameState, entropy = 0): ConditionContext {
  const derived = deriveWorld(content, state.world, state.party);
  return {
    flags: [...state.flags, ...derived.flags],
    visitedEras: state.world.visitedEras,
    party: state.activeParty,
    era: state.era,
    quests: state.quests,
    stats: {
      signal: partyMaxStat(content, state, 'signal'),
      noise: partyMaxStat(content, state, 'noise'),
      sync: partySync(state),
      ownership: derived.ownership,
      entropy,
    },
  };
}

export function ambushChance(content: ContentDB, state: GameState, enc: EncounterDef): number {
  if (enc.surprise === 'never') return 0;
  if (enc.surprise === 'always') return 100;
  const loads = partyLoadouts(content, state);
  const noises = Object.values(loads).map((l) => l.stats.noise);
  const avgNoise = noises.length ? noises.reduce((a, b) => a + b, 0) / noises.length : 0;
  const perception = Math.max(...enc.enemies.map((e) => content.enemies[e.enemy]?.perception ?? 0));
  let chance = content.rules.surprise.base;
  if (avgNoise < perception) chance += content.rules.surprise.noiseBelowPerception;
  return chance;
}

/** Build the Scan card: enemy count and flavor always; everything else depends on the party. */
export function buildScan(content: ContentDB, state: GameState, encounterId: string, surprise: boolean): ScanState {
  const enc = content.encounters[encounterId];
  const ctx = conditionContext(content, state);
  const count = enc.enemies.reduce((s, e) => s + e.count, 0);
  const hints: string[] = [`${count} ${count === 1 ? 'enemy' : 'enemies'}. ${enc.flavor}`];
  const chance = ambushChance(content, state, enc);
  for (const h of enc.scanHints) {
    if (!evalCondition(h.when, ctx)) continue;
    hints.push(h.when === 'noise>=40' ? `Ambush chance: ${chance}%.` : h.text);
  }
  if (ctx.stats.noise >= 40 && !enc.scanHints.some((h) => h.when === 'noise>=40')) hints.push(`Ambush chance: ${chance}%.`);
  return { encounterId, surprise, hints, ambushChance: chance };
}

/** Pick an encounter from the location's pool and roll for surprise. Returns null when the pool is empty. */
export function rollEncounter(content: ContentDB, state: GameState, pool?: string[]): { encounterId: string; surprise: boolean; rng: number; cancelledBy: string | null } | null {
  const loc = content.locations[state.location];
  const list = pool && pool.length ? pool : loc?.encounters ?? [];
  if (!loc || list.length === 0) return null;
  let rng = state.rng;
  let idx: number;
  [idx, rng] = rollInt(rng, list.length);
  const encounterId = list[idx];
  const enc = content.encounters[encounterId];
  const chance = ambushChance(content, state, enc);
  let r: number;
  [r, rng] = roll(rng);
  let surprise = r * 100 < chance;
  let cancelledBy: string | null = null;
  // A member with Noise >= 60 cancels one surprise per region by taking the hit alone.
  if (surprise && enc.surprise === 'roll') {
    const noisy = Object.entries(partyLoadouts(content, state)).find(([, l]) => l.stats.noise >= 60);
    if (noisy && !state.flags.includes(`surpriseCancelled:${loc.site}:${loc.era}`)) {
      surprise = false;
      cancelledBy = noisy[0];
    }
  }
  return { encounterId, surprise, rng, cancelledBy };
}
