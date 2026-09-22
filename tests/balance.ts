import type { GameState } from '../src/types/state';
import { levelForXp, maxHp, maxNerve, xpForLevel } from '../src/core/stats';
import { abilityOptions } from '../src/core/battle/battle';
import { autoBattle, content, newGame, reduce } from './helpers';

/** Where a party is expected to be, in levels, when it first meets each era's fights. */
export const ERA_LEVEL: Record<string, number> = { '2312': 4, '2148': 8, '2064': 12, '2031': 16 };
export const KEY_LEVEL = 20;

/** How long a fight of each tier should run, in rounds. */
export const BANDS: Record<'ordinary' | 'hard' | 'key', [number, number]> = {
  ordinary: [1, 4],
  hard: [3, 8],
  key: [7, 20],
};

/** The roster at a given level, with every skill point spent on the cheapest reachable node. */
export function partyAt(level: number, members: string[], seed = 5): GameState {
  let s = newGame(seed);
  const xp = xpForLevel(level, content.rules.xpPerLevel);
  const party = { ...s.party };
  for (const id of members) {
    if (!party[id]) {
      party[id] = { id, xp: 0, level: 1, skillPoints: 0, nodes: [], sync: 0, hp: 0, recruitedAt: 0,
        equipment: { weapon: null, gear: null } };
    }
  }
  const lv = levelForXp(xp, content.rules.xpPerLevel);
  for (const id of Object.keys(party)) party[id] = { ...party[id], xp, level: lv, skillPoints: 1 + lv, nodes: [] };
  s = { ...s, party, activeParty: members.slice(0, content.rules.activePartyMax) };
  for (let guard = 0; guard < 400; guard++) {
    let did = false;
    for (const id of Object.keys(s.party)) {
      if (s.party[id].skillPoints <= 0) continue;
      const own = new Set(s.party[id].nodes);
      const pool = Object.values(content.nodes)
        .filter((n) => n.character === id && !own.has(n.id))
        .sort((a, b) => a.cost - b.cost || a.row - b.row);
      for (const n of pool) {
        try { s = reduce(s, { type: 'UNLOCK_NODE', character: id, node: n.id }); did = true; break; } catch { /* not reachable yet */ }
      }
    }
    if (!did) break;
  }
  const healed = { ...s.party };
  for (const id of Object.keys(healed)) healed[id] = { ...healed[id], hp: maxHp(content, content.characters[id], healed[id]), nerve: maxNerve(content, healed[id]) };
  return { ...s, party: healed };
}

/** The same competent player every balance-sensitive test uses. */
export const playBattle = autoBattle;

/**
 * The other way people play: top everyone up, keep the party buffed, and only then hit something.
 * A party that can out-heal what it is taking turns a fight into attrition, so the bands have to
 * survive this as well as the straightforward version.
 */
export function playSustain(state: GameState): GameState {
  return autoBattle(state, (s) => {
    const b = s.battle!;
    const actor = b.combatants.find((c) => c.id === b.order[b.turnIndex]);
    if (!actor || actor.side !== 'party') return null;
    const options = abilityOptions(b, actor.id, content);
    const afford = (id: string) => !!options.find((o) => o.ability.id === id)?.usable;
    const mine = b.combatants.filter((c) => c.side === 'party' && !c.down);
    // Heal early and often, but not on every scratch: a person still wants the fight to end.
    const hurt = mine.filter((c) => c.hp < c.maxHp * 0.7).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    if (hurt) {
      const heal = actor.abilities.find((a) => afford(a) && !!content.abilities[a].heal);
      if (heal) {
        const def = content.abilities[heal];
        const target = def.target === 'ally' ? hurt.id : null;
        return { type: 'BATTLE_ABILITY', actor: actor.id, ability: heal, target };
      }
    }
    // Then keep the buffs up, once each, on an actor with threads to spare.
    const buff = actor.threads > 1 ? actor.abilities.find((a) => afford(a) && !content.abilities[a].damageType
      && !content.abilities[a].heal && content.abilities[a].target !== 'enemy'
      && !actor.statuses.some((st) => st.id === content.abilities[a].special)) : undefined;
    if (buff) {
      const def = content.abilities[buff];
      return { type: 'BATTLE_ABILITY', actor: actor.id, ability: buff, target: def.target === 'ally' ? actor.id : null };
    }
    return null;   // nothing to keep up: fall through to hitting things
  });
}

/** The party a typical run is fielding: the three you always have, plus the first recruit. */
export const TYPICAL = ['player', 'wren', 'dax', 'ilo9'];
/** The leanest party the game can hand you: every other recruit is optional. */
export const CORE = ['player', 'wren', 'dax'];

/** Fights met before the party exists are measured with the party the player actually has. */
const SOLO: Record<string, { members: string[]; level: number }> = {
  office_2312_stairwell: { members: ['player'], level: 1 },
};

export interface Measurement {
  id: string;
  tier: 'ordinary' | 'hard' | 'key';
  level: number;
  rounds: number;
  wins: number;
  runs: number;
}

/** Median rounds over a few seeds, so one lucky roll does not decide a tuning pass. */
export function measure(encounterId: string, seeds = [11, 29, 47], roster = TYPICAL, atLevel?: number): Measurement {
  const enc = content.encounters[encounterId];
  const solo = SOLO[encounterId];
  const level = atLevel ?? (solo ? solo.level : enc.tier === 'key' ? KEY_LEVEL : ERA_LEVEL[enc.era]);
  const members = solo && !atLevel ? solo.members : roster;
  const rounds: number[] = [];
  let wins = 0;
  for (const seed of seeds) {
    let s = partyAt(level, members, seed);
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId, surprise: false });
    s = playBattle(s);
    if (s.battle?.phase === 'won') wins++;
    rounds.push(s.battle?.round ?? 0);
  }
  rounds.sort((a, b) => a - b);
  return { id: encounterId, tier: enc.tier, level, rounds: rounds[Math.floor(rounds.length / 2)], wins, runs: seeds.length };
}
