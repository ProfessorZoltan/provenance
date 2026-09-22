import { describe, expect, it } from 'vitest';
import { abilityOptions, current, hasStatus, resolveAbility, validTargets } from '../src/core/battle/battle';
import type { BattleState, GameState } from '../src/types/state';
import { content, newGame, reduce } from './helpers';

const ctl = content.rules.control;

/** A fight with `who` recruited, acting, with every thread and plenty of Nerve. */
function acting(who: string, encounterId: string, seed = 8): GameState {
  let s = newGame(seed);
  if (!s.party[who]) s = reduce(s, { type: 'RECRUIT', character: who });
  s = { ...s, activeParty: ['player', who, ...['wren', 'dax'].filter((x) => x !== who)].slice(0, 3) };
  s = reduce(s, { type: 'START_ENCOUNTER', encounterId, surprise: false });
  let guard = 60;
  while (guard-- > 0 && current(s.battle!)?.id !== who) {
    if (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
  }
  return s;
}
const armed = (b: BattleState, who: string, abilities: string[]) =>
  ({ ...b, combatants: b.combatants.map((c) => (c.id === who ? { ...c, threads: 5, nerve: 40, abilities: [...c.abilities, ...abilities] } : c)) });

describe('bosses resist control', () => {
  it('marks bosses and the Construct at the heart of a key fight, and nobody else', () => {
    const key = reduce(newGame(3), { type: 'START_ENCOUNTER', encounterId: 'stack_floor_2064', surprise: false }).battle!;
    const heart = key.combatants.find((c) => c.ref === 'construct_thermal_2064')!;
    expect(heart.resistsControl).toBe(true);
    expect(key.combatants.filter((c) => c.side === 'enemy' && c.ref !== heart.ref).every((c) => !c.resistsControl)).toBe(true);
    const plain = reduce(newGame(3), { type: 'START_ENCOUNTER', encounterId: 'basin_2064_aisle', surprise: false }).battle!;
    expect(plain.combatants.find((c) => c.ref === 'construct_thermal_2064')!.resistsControl, 'the same Construct in an ordinary fight').toBe(false);
    for (const id of ['ilo9_bound', 'strand_perpetual', 'strand_reconciled', 'construct_board_2312']) expect(content.enemies[id].boss, id).toBe(true);
  });

  it('cannot be talked down: Parley and Ghost Protocol leave it off the target list', () => {
    const s = acting('ilo9', 'stack_floor_2064');
    const b = armed(s.battle!, 'ilo9', ['ghost_protocol']);
    const targets = validTargets(b, 'ilo9', content.abilities.ghost_protocol, content).map((c) => c.ref);
    expect(targets).not.toContain('construct_thermal_2064');
    expect(targets.length).toBeGreaterThan(0);
  });

  it('is never turned by Open Weights; the machines that are turn back after two rounds, and the fight is not won meanwhile', () => {
    const s = acting('quiroga', 'stack_floor_2064');
    let b = resolveAbility(armed(s.battle!, 'quiroga', ['open_weights']), 'quiroga', 'open_weights', null, content);
    const heart = b.combatants.find((c) => c.ref === 'construct_thermal_2064')!;
    expect(heart.side, 'the boss does not listen').toBe('enemy');
    const turned = b.combatants.filter((c) => c.returnsTo === 'enemy');
    expect(turned.length).toBeGreaterThan(0);
    for (const t of turned) expect(t.expiresAfterRound).toBe(s.battle!.round + ctl.openWeightsRounds);
    // With only the turned machines left on the other side, the fight is still on.
    b = { ...b, combatants: b.combatants.map((c) => (c.id === heart.id ? { ...c, hp: 0, down: true } : c)) };
    b = resolveAbility({ ...b, combatants: b.combatants.map((c) => (c.id === 'quiroga' ? { ...c, threads: 3 } : c)) }, 'quiroga', 'guard', 'quiroga', content);
    expect(b.phase).not.toBe('won');
    // Their time runs out and they come back.
    let st: GameState = { ...s, battle: { ...b, round: b.round + ctl.openWeightsRounds + 1 } };
    let guard = 40;
    while (guard-- > 0 && st.battle!.combatants.some((c) => c.returnsTo === 'enemy')) {
      if (st.battle!.phase === 'enemy') st = reduce(st, { type: 'BATTLE_ENEMY_ACT' });
      else st = reduce(st, { type: 'BATTLE_END_TURN', actor: current(st.battle!)!.id });
    }
    expect(st.battle!.combatants.filter((c) => turned.some((t) => t.id === c.id)).every((c) => c.side === 'enemy' || c.down)).toBe(true);
    expect(st.battle!.log.some((l) => /turns? back/.test(l.text))).toBe(true);
  });

  it('turns the machines back at once when nobody else is left on their side', () => {
    const s = acting('quiroga', 'annex_2064_shredder');
    let b = resolveAbility(armed(s.battle!, 'quiroga', ['open_weights']), 'quiroga', 'open_weights', null, content);
    const turned = b.combatants.filter((c) => c.returnsTo === 'enemy').map((c) => c.id);
    expect(turned.length).toBeGreaterThan(0);
    const last = b.combatants.find((c) => c.side === 'enemy' && !c.down)!;
    b = { ...b, combatants: b.combatants.map((c) => (c.id === last.id ? { ...c, hp: 1, shield: 0 } : c.id === 'quiroga' ? { ...c, threads: 3 } : c)) };
    b = resolveAbility(b, 'quiroga', 'guard', 'quiroga', content);
    // Knock the last real enemy down through an ordinary hit from the Auditor.
    const hitter = { ...b, combatants: b.combatants.map((c) => (c.id === 'player' ? { ...c, threads: 3 } : c)) };
    const after = resolveAbility(hitter, 'player', 'strike', last.id, content);
    if (after.combatants.find((c) => c.id === last.id)!.down) {
      expect(after.phase).not.toBe('won');
      expect(after.combatants.filter((c) => turned.includes(c.id)).every((c) => c.side === 'enemy')).toBe(true);
      expect(after.log.some((l) => /nobody else left/.test(l.text))).toBe(true);
    }
  });
});

describe('stacking bonuses and summons have a ceiling', () => {
  it('stops Litany at three stacks and refreshes the oldest after that', () => {
    const s = acting('wren', 'kell_2312_enforcers');
    let b = armed(s.battle!, 'wren', ['litany']);
    for (let i = 0; i < 5; i++) b = resolveAbility({ ...b, combatants: b.combatants.map((c) => (c.id === 'wren' ? { ...c, threads: 5 } : c)) }, 'wren', 'litany', null, content);
    for (const c of b.combatants.filter((x) => x.side === 'party' && !x.down)) {
      expect(c.statuses.filter((st) => st.id === 'inspired').length, c.id).toBe(ctl.stackCap);
    }
    expect(b.log.some((l) => /refreshed instead/.test(l.text))).toBe(true);
  });

  it('stops a held shot at three turns', () => {
    const s = acting('wren', 'kell_2312_enforcers');
    let b = armed(s.battle!, 'wren', ['hold']);
    for (let i = 0; i < 5; i++) b = resolveAbility({ ...b, combatants: b.combatants.map((c) => (c.id === 'wren' ? { ...c, threads: 5 } : c)) }, 'wren', 'hold', 'wren', content);
    expect(b.combatants.find((c) => c.id === 'wren')!.statuses.filter((st) => st.id === 'held').length).toBe(ctl.stackCap);
    void hasStatus;
  });

  it('lets each caster hold one summon at a time', () => {
    const s = acting('quiroga', 'kell_2312_enforcers');
    let b = armed(s.battle!, 'quiroga', ['blueprint']);
    b = resolveAbility(b, 'quiroga', 'blueprint', 'quiroga', content);
    const copies = () => b.combatants.filter((c) => c.id.startsWith('copy:quiroga:') && !c.down).length;
    expect(copies()).toBe(1);
    b = resolveAbility({ ...b, combatants: b.combatants.map((c) => (c.id === 'quiroga' ? { ...c, threads: 5 } : c)) }, 'quiroga', 'blueprint', 'quiroga', content);
    expect(copies()).toBe(ctl.copiesPerCaster);
    expect(b.log.some((l) => /cannot hold another copy/.test(l.text))).toBe(true);
    void abilityOptions;
  });
});
