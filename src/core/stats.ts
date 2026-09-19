import type { AbilityDef, CharacterDef, ContentDB, NodeDef, StatBlock, StatName } from '../types/content';
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

export function levelForXp(xp: number, xpPerLevel: number): number {
  return 1 + Math.floor(Math.max(0, xp) / xpPerLevel);
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
