import type { ContentDB, DamageType, EncounterDef } from '../types/content';
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
      continuity: Math.min(100, ...state.activeParty.map((id) => derived.continuity[id] ?? 100)),
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

/**
 * Who in the party notices that nothing they carry will touch something out there, and what they
 * say about it. The check is honest about the type rules: Signal only bites machines, and Overload
 * takes Signal away entirely, so neither counts as an answer to a Warden.
 */
function cannotTouch(content: ContentDB, state: GameState, enc: EncounterDef): string | null {
  const loads = partyLoadouts(content, state);
  const overloaded = partySync(state) <= content.rules.overloadSync;
  const types = new Set<DamageType>();
  for (const l of Object.values(loads)) {
    for (const id of l.abilities) {
      const t = content.abilities[id]?.damageType;
      if (!t) continue;
      if (t === 'signal' && overloaded) continue;
      types.add(t);
    }
  }
  const untouchable = enc.enemies
    .map((g) => content.enemies[g.enemy])
    .filter((e): e is NonNullable<typeof e> => !!e)
    .filter((e) => ![...types].some((t) => !e.immunities.includes(t) && !(t === 'signal' && !e.machine)));
  if (!untouchable.length) return null;
  const what = untouchable[0];
  // What *would* land on it, whether or not anyone in the party can do that yet.
  const ALL: DamageType[] = ['kinetic', 'thermal', 'signal', 'chronal'];
  const answers = ALL.filter((t) => !what.immunities.includes(t) && !(t === 'signal' && !what.machine));
  const need = answers.length === 1 ? answers[0] : what.weakness;
  const line = (who: string, text: string) => `${who}: ${text}`;
  if (state.activeParty.includes('wren')) {
    return line('Wren', `Nothing any of us is carrying will land on that. ${need === 'chronal' ? 'It is standing a little to one side of now; you have to hit it there.' : 'We are not equipped for it.'}`);
  }
  if (state.activeParty.includes('ilo9')) {
    return line('ILO-9', `I have run the party's kit against that thing four hundred times. Every pass returns zero. ${need === 'chronal' ? 'Chronal is the only column with a number in it.' : 'We do not have the answer to it yet.'}`);
  }
  if (state.activeParty.includes('dax')) {
    return line('Dax', `I have hit things like that before. It does not care. ${need === 'chronal' ? 'It is not properly here to be hit.' : 'Leave it.'}`);
  }
  return line('The Auditor', `Nothing in this party's kit is rated against that. ${need === 'chronal' ? 'It is a Chronal problem and we have no Chronal.' : 'We are not equipped for it.'}`);
}

/** Build the Scan card: enemy count and flavor always; everything else depends on the party. */
export function buildScan(content: ContentDB, state: GameState, encounterId: string, surprise: boolean): ScanState {
  const enc = content.encounters[encounterId];
  const ctx = conditionContext(content, state);
  const count = enc.enemies.reduce((s, e) => s + e.count, 0);
  const hints: string[] = [`${count} ${count === 1 ? 'enemy' : 'enemies'}. ${enc.flavor}`];
  // The party's own read on whether this is winnable comes before anything a stat gate unlocks.
  const blind = cannotTouch(content, state, enc);
  if (blind) hints.push(blind);
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
