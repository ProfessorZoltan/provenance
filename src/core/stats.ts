import type { AbilityDef, CharacterDef, ContentDB, NodeDef, PerkDef, StatBlock, StatName } from '../types/content';
import { rngFloat, seedFromString } from './rng';
import type { CharacterState, GameState } from '../types/state';

export interface Passives {
  [key: string]: number;
}

export interface Loadout {
  stats: StatBlock;
  abilities: string[];
  passives: Passives;
}

const GROWING: (keyof StatBlock)[] = ['resolve', 'grit', 'signal', 'noise'];

/**
 * Each level costs `xpPerLevel` more experience than the one before it, so the climb flattens.
 * A linear curve put a completionist past level 150 and made the last act's rewards meaningless.
 */
export function levelForXp(xp: number, xpPerLevel: number): number {
  const n = Math.max(0, xp) / xpPerLevel;
  return 1 + Math.floor((Math.sqrt(1 + 8 * n) - 1) / 2);
}

/** Total experience needed to reach a level, the inverse of levelForXp. */
export function xpForLevel(level: number, xpPerLevel: number): number {
  const l = Math.max(1, level);
  return (xpPerLevel * (l - 1) * l) / 2;
}

/** Base stats scaled by level, plus every owned node's stat deltas, ability grants and passives. */
export function equippedItems(content: ContentDB, cs: CharacterState): string[] {
  return [cs.equipment?.weapon, cs.equipment?.gear].filter((i): i is string => !!i && !!content.items[i]);
}

export function loadout(content: ContentDB, def: CharacterDef, cs: CharacterState): Loadout {
  const growth = 1 + content.rules.statGrowthPerLevel * (cs.level - 1);
  const stats: StatBlock = { ...def.baseStats };
  for (const k of GROWING) stats[k] = Math.round(def.baseStats[k] * growth);
  stats.sync = cs.sync;
  const abilities = [...def.abilities];
  const passives: Passives = {};
  for (const nid of cs.nodes) {
    const node: NodeDef | undefined = content.nodes[nid];
    if (!node) continue;
    for (const e of node.effects) {
      if (e.kind === 'stat') stats[e.stat] += e.delta;
      else if (e.kind === 'ability' && !abilities.includes(e.ability)) abilities.push(e.ability);
      else if (e.kind === 'passive') passives[e.passive] = (passives[e.passive] ?? 0) + (e.value ?? 1);
    }
  }
  for (const pid of cs.perks ?? []) {
    const perk = content.perks[pid];
    if (!perk) continue;
    for (const [k, v] of Object.entries(perk.stats ?? {})) stats[k as StatName] += v as number;
    if (perk.passive) passives[perk.passive] = (passives[perk.passive] ?? 0) + (perk.value ?? 1);
  }
  for (const id of equippedItems(content, cs)) {
    const gear = content.items[id];
    for (const [k, v] of Object.entries(gear.stats ?? {})) {
      const stat = k as StatName;
      stats[stat] = stats[stat] + (v as number);
    }
    for (const a of gear.grants ?? []) if (!abilities.includes(a)) abilities.push(a);
  }
  stats.bandwidth = Math.max(2, Math.min(5, stats.bandwidth));
  stats.resolve = Math.max(1, stats.resolve);
  return { stats, abilities, passives };
}

export function maxHp(content: ContentDB, def: CharacterDef, cs: CharacterState): number {
  return loadout(content, def, cs).stats.resolve;
}

/** The support budget a character carries between beds. */
export function maxNerve(content: ContentDB, cs: CharacterState): number {
  const perks = (cs.perks ?? []).reduce((s, id) => s + (content.perks[id]?.nerve ?? 0), 0);
  return content.rules.nerve.base + content.rules.nerve.perLevel * cs.level + perks;
}

/** Picks still owed: one per level past the first, less the ones already made. Older saves are owed all of theirs. */
export function perksOwed(content: ContentDB, cs: CharacterState): number {
  return Math.max(0, (cs.level - 1) * content.rules.perks.perLevel - (cs.perks?.length ?? 0));
}

/**
 * The options for a character's next pick. They come off the run's seed, the character and the
 * pick number, so the same run offers the same two each time it is looked at, and a different run
 * offers different ones.
 */
export function perkOffer(content: ContentDB, cs: CharacterState, seed: number): PerkDef[] {
  const pool = Object.values(content.perks);
  const n = Math.min(content.rules.perks.choices, pool.length);
  const pick = (cs.perks?.length ?? 0) + 1;
  const order = pool.map((p, i) => ({ p, k: rngFloat((seed ^ seedFromString(`${cs.id}:perk:${pick}:${i}`)) | 0) }))
    .sort((a, b) => a.k - b.k);
  return order.slice(0, n).map((o) => o.p);
}

/** Nerve on hand: a save from before Nerve existed carries a full pool. */
export function nerveOf(content: ContentDB, cs: CharacterState): number {
  const cap = maxNerve(content, cs);
  return Math.max(0, Math.min(cap, cs.nerve ?? cap));
}

const BAD_STATUSES = new Set(['marked', 'bound', 'fear', 'locked']);

/**
 * What an ability costs in Nerve. Damage is free; mending, lifting an ally and laying something on
 * an enemy are not. An ability can name its own price instead.
 */
export function nerveCost(content: ContentDB, ability: AbilityDef): number {
  if (ability.nerve !== undefined) return ability.nerve;
  const c = content.rules.nerve.costs;
  if (ability.heal) return c.heal;
  if (ability.status) return BAD_STATUSES.has(ability.status.id) ? c.debuff : c.buff;
  if (ability.special && ['spawnAlly', 'buyout', 'openWeights', 'settlement', 'marksToTempo'].includes(ability.special)) return c.special;
  return 0;
}

export function partyLoadouts(content: ContentDB, state: GameState): Record<string, Loadout> {
  const out: Record<string, Loadout> = {};
  for (const id of state.activeParty) {
    const def = content.characters[id];
    const cs = state.party[id];
    if (def && cs) out[id] = loadout(content, def, cs);
  }
  return out;
}

export function partySync(state: GameState): number {
  const ids = state.activeParty.filter((id) => state.party[id]);
  if (ids.length === 0) return 0;
  return Math.round(ids.reduce((s, id) => s + state.party[id].sync, 0) / ids.length);
}

export function partyMaxStat(content: ContentDB, state: GameState, stat: 'signal' | 'noise'): number {
  let best = 0;
  for (const l of Object.values(partyLoadouts(content, state))) best = Math.max(best, l.stats[stat]);
  return best;
}

export function abilityDef(content: ContentDB, id: string): AbilityDef {
  const a = content.abilities[id];
  if (!a) throw new Error(`Unknown ability ${id}`);
  return a;
}
