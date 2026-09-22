// Runs fights and whole eras under a player style, through the real reducer, and measures them.
import { current } from '../../src/core/battle/battle';
import type { Action } from '../../src/core/actions';
import { maxHp, maxNerve } from '../../src/core/stats';
import { difficulty } from '../../src/core/difficulty';
import type { DifficultyId, EraId } from '../../src/types/content';
import type { BattleState, GameState } from '../../src/types/state';
import { partyAt } from '../balance';
import { autoBattle, content, reduce } from '../helpers';
import { noiseFrom, type Policy } from './playstyles';

export interface FightResult {
  id: string; won: boolean; rounds: number; minFrac: number; downs: number; dmgTaken: number;
  entropyIn: number; entropyOut: number; nerveSpent: number; items: number; rewinds: number;
  use: Record<string, number>; dealt: Record<string, number>;
}

const foeHp = (s: GameState) => s.battle!.combatants.filter((c) => c.side === 'enemy').reduce((t, c) => t + (c.down ? 0 : c.hp + c.shield) + (c.bar === 1 && content.enemies[c.ref]?.secondBar ? content.enemies[c.ref].secondBar!.resolve * (c.stand ?? 1) : 0), 0);

/** One fight under a policy. The state that comes back has the finished battle on it, not yet collected. */
export function fight(s: GameState, encounterId: string, policy: Policy | null, seed: number, setup?: (b: BattleState) => BattleState, fallback = false): { s: GameState; r: FightResult } {
  const noise = noiseFrom(seed);
  s = reduce(s, { type: 'START_ENCOUNTER', encounterId, surprise: false });
  if (setup && s.battle) s = { ...s, battle: setup(s.battle) };
  const party0 = s.battle!.combatants.filter((c) => c.side === 'party');
  const nerve0 = party0.reduce((t, c) => t + c.nerve, 0);
  const r: FightResult = { id: encounterId, won: false, rounds: 0, minFrac: 1, downs: 0, dmgTaken: 0, entropyIn: s.battle!.entropy, entropyOut: 0, nerveSpent: 0, items: 0, rewinds: 0, use: {}, dealt: {} };
  let guard = 3000;
  while (s.battle && s.battle.phase !== 'won' && s.battle.phase !== 'lost' && guard-- > 0) {
    const b = s.battle;
    const before = s;
    if (b.phase === 'enemy' || current(b)?.side !== 'party') {
      s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    } else if (!policy) {
      s = autoBattle(s, undefined, 1);
    } else {
      let act: Action | null = null;
      try { act = policy(s, noise); } catch { act = null; }
      const actor = current(b)!;
      if (!act && fallback) { s = autoBattle(s, undefined, 1); continue; }
      try { s = reduce(s, act ?? { type: 'BATTLE_END_TURN', actor: actor.id }); } catch { s = reduce(s, { type: 'BATTLE_END_TURN', actor: actor.id }); }
      if (act?.type === 'BATTLE_ABILITY') {
        r.use[act.ability] = (r.use[act.ability] ?? 0) + 1;
        r.dealt[act.ability] = (r.dealt[act.ability] ?? 0) + Math.max(0, foeHp(before) - foeHp(s));
      }
      if (act?.type === 'BATTLE_ITEM') r.items++;
      if (act?.type === 'BATTLE_REWIND') r.rewinds++;
    }
    if (!s.battle) break;
    const pb = before.battle!.combatants.filter((c) => c.side === 'party' && !c.temporary);
    for (const c of s.battle.combatants.filter((c) => c.side === 'party' && !c.temporary)) {
      r.minFrac = Math.min(r.minFrac, c.hp / c.maxHp);
      const p = pb.find((x) => x.id === c.id);
      if (p && c.hp < p.hp) r.dmgTaken += p.hp - c.hp;
    }
  }
  const b = s.battle!;
  r.won = b.phase === 'won';
  r.rounds = b.round;
  r.downs = b.combatants.filter((c) => c.side === 'party' && c.down && !c.temporary).length;
  r.entropyOut = b.entropy;
  r.nerveSpent = nerve0 - b.combatants.filter((c) => c.side === 'party' && !c.temporary).reduce((t, c) => t + c.nerve, 0);
  return { s, r };
}

export interface EraResult {
  era: string; policy: string; fights: number; wins: number; losses: number; rounds: number[];
  downs: number; worst: number; rests: number; camps: number; broke: number; entropyPeak: number;
  results: FightResult[];
}

const SITE: Record<string, string> = { '2312': 'kell_2312', '2148': 'kell_2148', '2064': 'kell_2064', '2031': 'kell_2031' };

/**
 * An era played through: every fight the era has, ordinary first and hard after, Resolve, Nerve and
 * Entropy carried between them. Between fights the party camps when hurt, and pays for a bed when the
 * camps are gone and the purse allows. A loss sends it back to the Deep Site the way the game does.
 */
export function playEra(era: EraId, level: number, roster: string[], policyName: string, policy: Policy | null, seed: number, purse = 120, diff?: DifficultyId): EraResult {
  let s = partyAt(level, roster, seed);
  s = { ...s, difficulty: diff, location: SITE[era], era, camps: difficulty(content, diff).campsPerEra, entropy: 0,
    inventory: { ...s.inventory, items: { ration: 2, tonic: 1, splice: 1, steady: 1 }, currency: { ...s.inventory.currency, [cur(era)]: purse } } };
  const encs = Object.values(content.encounters).filter((e) => e.era === era && e.tier !== 'key' && !/stairwell/.test(e.id))
    .sort((a, b) => (a.tier === b.tier ? a.id.localeCompare(b.id) : a.tier === 'ordinary' ? -1 : 1));
  const out: EraResult = { era, policy: policyName, fights: 0, wins: 0, losses: 0, rounds: [], downs: 0, worst: 1, rests: 0, camps: 0, broke: 0, entropyPeak: 0, results: [] };
  let i = 0;
  for (const e of encs) {
    const f = fight(s, e.id, policy, seed * 31 + i++, undefined, policyName === 'expert');
    s = f.s;
    out.fights++; out.results.push(f.r);
    out.rounds.push(f.r.rounds); out.downs += f.r.downs > 0 ? 1 : 0; out.worst = Math.min(out.worst, f.r.minFrac);
    out.entropyPeak = Math.max(out.entropyPeak, f.r.entropyOut);
    if (f.r.won) { out.wins++; s = reduce(s, { type: 'BATTLE_FINISH' }); s = { ...s, battle: null, screen: { id: 'hub' }, location: SITE[era] }; }
    else { out.losses++; s = reduce(s, { type: 'BATTLE_FINISH' }); s = reduce(s, { type: 'GAME_OVER_RETURN' }); s = { ...s, location: SITE[era] }; }
    // Recover the way a player would: camp when hurt, a bed when out of camps, go on when broke.
    const hurt = s.activeParty.some((id) => s.party[id].hp < 0.5 * maxHp(content, content.characters[id], s.party[id]) || (s.party[id].nerve ?? 99) < 0.3 * maxNerve(content, s.party[id]));
    if (hurt) {
      if (s.camps > 0) { s = reduce(s, { type: 'CAMP' }); out.camps++; }
      else { try { s = reduce(s, { type: 'REST' }); out.rests++; } catch { out.broke++; } }
    }
  }
  return out;
}

export function cur(era: string): string {
  return era === '2148' ? 'barter tokens' : era === '2312' ? 'allocation points' : 'credits';
}

/** The four floors of the Stack in order, as the endgame is walked: no beds, two camps, bench rotated. */
export function playStack(level: number, roster: string[], policyName: string, policy: Policy | null, seed: number, diff?: DifficultyId): EraResult {
  let s = partyAt(level, roster, seed);
  s = { ...s, difficulty: diff, camps: difficulty(content, diff).campsPerEra, entropy: 0, inventory: { ...s.inventory, items: { ration: 2, tonic: 1, dampener: 1 } } };
  const out: EraResult = { era: 'stack', policy: policyName, fights: 0, wins: 0, losses: 0, rounds: [], downs: 0, worst: 1, rests: 0, camps: 0, broke: 0, entropyPeak: 0, results: [] };
  let i = 0;
  for (const id of ['stack_floor_2031', 'stack_floor_2064', 'stack_floor_2148', 'stack_floor_2312', 'strand_perpetual']) {
    const f = fight(s, id, policy, seed * 17 + i++, undefined, policyName === 'expert');
    s = f.s; out.fights++; out.results.push(f.r); out.rounds.push(f.r.rounds);
    out.downs += f.r.downs > 0 ? 1 : 0; out.worst = Math.min(out.worst, f.r.minFrac); out.entropyPeak = Math.max(out.entropyPeak, f.r.entropyOut);
    if (!f.r.won) { out.losses++; break; }
    out.wins++;
    s = reduce(s, { type: 'BATTLE_FINISH' }); s = { ...s, battle: null, screen: { id: 'hub' } };
    const frac = (id: string) => s.party[id].hp / maxHp(content, content.characters[id], s.party[id]);
    const bench = Object.keys(s.party).filter((id) => id !== 'player').sort((a, b) => frac(b) - frac(a));
    s = reduce(s, { type: 'SET_ACTIVE_PARTY', members: ['player', ...bench.slice(0, content.rules.activePartyMax - 1)] });
    if (s.camps > 0 && (s.entropy >= 60 || s.activeParty.some((id) => frac(id) < 0.55 || (s.party[id].nerve ?? 99) < 8))) { s = reduce(s, { type: 'CAMP' }); out.camps++; }
  }
  return out;
}
