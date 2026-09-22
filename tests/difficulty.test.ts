import { describe, expect, it } from 'vitest';
import { current, resolveAbility } from '../src/core/battle/battle';
import { DIFFICULTIES, difficulty } from '../src/core/difficulty';
import { restCost } from '../src/core/reducer';
import type { DifficultyId } from '../src/types/content';
import type { BattleState, GameState } from '../src/types/state';
import { content, newGame, newRun, reduce } from './helpers';

const rules = content.rules;
const on = (id: DifficultyId, seed = 4): GameState => ({ ...newGame(seed), difficulty: id });
const fightOn = (id: DifficultyId, encounterId: string, seed = 4): BattleState =>
  reduce(on(id, seed), { type: 'START_ENCOUNTER', encounterId, surprise: false }).battle!;
const foes = (b: BattleState) => b.combatants.filter((c) => c.side === 'enemy');

describe('difficulty presets', () => {
  it('Standard is the base rules, and an older save with no difficulty plays Standard', () => {
    const std = difficulty(content, 'standard');
    expect(std).toMatchObject({ enemyDamage: 1, enemyResolve: 1, restPerLevel: rules.rest.perLevel, campsPerEra: rules.camp.perEra, rewinds: rules.rewind.base, ruthless: 0, echoGrace: 0 });
    expect(difficulty(content, undefined)).toEqual(std);
    expect(rules.difficulty.default).toBe('standard');
  });

  it('runs from gentlest to harshest on every lever', () => {
    const d = DIFFICULTIES.map((id) => difficulty(content, id));
    for (let i = 1; i < d.length; i++) {
      expect(d[i].enemyDamage, d[i].id).toBeGreaterThanOrEqual(d[i - 1].enemyDamage);
      expect(d[i].enemyResolve, d[i].id).toBeGreaterThanOrEqual(d[i - 1].enemyResolve);
      expect(d[i].restPerLevel, d[i].id).toBeGreaterThanOrEqual(d[i - 1].restPerLevel);
      expect(d[i].campsPerEra, d[i].id).toBeLessThanOrEqual(d[i - 1].campsPerEra);
      expect(d[i].rewinds, d[i].id).toBeLessThanOrEqual(d[i - 1].rewinds);
      expect(d[i].ruthless, d[i].id).toBeGreaterThanOrEqual(d[i - 1].ruthless);
    }
  });

  it('is chosen at New Game, with that setting\'s camps', () => {
    const s = reduce(newRun(9), { type: 'NEW_GAME', seed: 9, lean: 'commons', difficulty: 'story' });
    expect(s.difficulty).toBe('story');
    expect(s.camps).toBe(difficulty(content, 'story').campsPerEra);
    expect(reduce(newRun(9), { type: 'NEW_GAME', seed: 9, lean: 'commons' }).difficulty).toBe('standard');
  });

  it('can be changed between fights but not during one, and never hands back spent camps', () => {
    let s = { ...on('story'), camps: 3 };
    s = reduce(s, { type: 'SET_DIFFICULTY', difficulty: 'hard' });
    expect(s.difficulty).toBe('hard');
    expect(s.camps).toBe(difficulty(content, 'hard').campsPerEra);
    s = reduce(s, { type: 'SET_DIFFICULTY', difficulty: 'story' });
    expect(s.camps, 'going easier does not refill the camps').toBe(difficulty(content, 'hard').campsPerEra);
    const inFight = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    expect(() => reduce(inFight, { type: 'SET_DIFFICULTY', difficulty: 'audit' })).toThrow(/fight/);
  });

  it('prices a bed by the setting', () => {
    const level = Math.max(...on('standard').activeParty.map((id) => on('standard').party[id].level));
    for (const id of DIFFICULTIES) expect(restCost(content, on(id)), id).toBe(difficulty(content, id).restPerLevel * level);
  });
});

describe('what a difficulty does to a fight', () => {
  it('scales enemy Resolve by the setting', () => {
    const std = foes(fightOn('standard', 'kell_2312_perimeter'));
    const hard = foes(fightOn('hard', 'kell_2312_perimeter'));
    const story = foes(fightOn('story', 'kell_2312_perimeter'));
    std.forEach((c, i) => {
      expect(hard[i].maxHp).toBe(Math.round(content.enemies[c.ref].stats.resolve * c.stand! * difficulty(content, 'hard').enemyResolve));
      expect(story[i].maxHp).toBeLessThan(c.maxHp);
    });
  });

  it('gives later eras more Resolve, ordinary fights most', () => {
    const b = fightOn('standard', 'kell_2031_terrace');
    const drone = foes(b)[0];
    const scale = rules.eraScale['2031']!.ordinary!;
    expect(scale).toBeGreaterThan(1);
    expect(drone.maxHp).toBe(Math.round(content.enemies[drone.ref].stats.resolve * rules.tierScale.ordinary * scale));
    expect(rules.eraScale['2312'], 'the first era is left as it was').toBeUndefined();
  });

  it('multiplies every hit an enemy lands', () => {
    // The same board, the same roll, the same enemy turn: only the setting differs.
    let s = on('standard', 6);
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    while (s.battle!.phase !== 'enemy') s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    const taken = (st: GameState) => {
      const before = st.battle!.combatants.filter((c) => c.side === 'party').reduce((t, c) => t + c.hp, 0);
      const after = reduce(st, { type: 'BATTLE_ENEMY_ACT' }).battle!.combatants.filter((c) => c.side === 'party').reduce((t, c) => t + c.hp, 0);
      return before - after;
    };
    const base = taken(s);
    const harder = taken({ ...s, battle: { ...s.battle!, difficulty: 'audit' } });
    expect(base).toBeGreaterThan(0);
    expect(harder / base).toBeCloseTo(difficulty(content, 'audit').enemyDamage, 0);
    expect(harder).toBeGreaterThan(base);
  });

  it('turns a share of each enemy side on the weakest', () => {
    const count = (id: DifficultyId) => foes(fightOn(id, 'kell_2312_enforcers')).filter((c) => c.targeting === 'weakest').length;
    expect(count('standard')).toBe(0);
    expect(count('hard')).toBe(1);
    expect(count('audit')).toBe(3);
  });

  it('starts every fight with the setting\'s Rewinds', () => {
    // The Auditor alone, so no anchor adds one.
    const alone = (id: DifficultyId) => reduce({ ...on(id), activeParty: ['player'] }, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false }).battle!.rewindsLeft;
    expect(alone('story')).toBe(2);
    expect(alone('standard')).toBe(1);
    expect(alone('audit')).toBe(0);
  });

  it('lets an ordinary hit scratch an Echo on Story, and nowhere else', () => {
    const hit = (id: DifficultyId) => {
      let s = { ...on(id, 3), activeParty: ['player', 'wren', 'dax'] };
      s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'graveyard_echoes', surprise: false });
      const b = s.battle!;
      const echo = foes(b).find((c) => c.family === 'echo')!;
      const dax = b.combatants.find((c) => c.id === 'dax')!;
      // Locked, so the hit cannot miss and the only question is whether it lands.
      const ready = { ...b, combatants: b.combatants.map((c) => (c.id === 'dax' ? { ...c, threads: 5 } : c.id === echo.id ? { ...c, statuses: [{ id: 'locked', turns: 2 }] } : c)), order: ['dax', ...b.order.filter((x) => x !== 'dax')], turnIndex: 0, phase: 'player' as const };
      const after = resolveAbility(ready, dax.id, 'strike', echo.id, content);
      return echo.hp - after.combatants.find((c) => c.id === echo.id)!.hp;
    };
    expect(hit('standard')).toBe(0);
    expect(hit('hard')).toBe(0);
    expect(hit('story')).toBeGreaterThan(0);
  });
});
