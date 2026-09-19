import { describe, expect, it } from 'vitest';
import { activeVariant } from '../src/core/reducer';
import { applyChoice, deriveWorld, endingFor } from '../src/core/timeline';
import { maxHp } from '../src/core/stats';
import { autoBattle, content, newGame, reduce, run, skipDialogue } from './helpers';
import type { GameState } from '../src/types/state';

/** An endgame party: the stack is the last thing in the game and is costed like it. */
function levelled(s: GameState, xp = 900): GameState {
  const party = Object.fromEntries(Object.entries(s.party).map(([id, c]) => {
    const level = 1 + Math.floor(xp / content.rules.xpPerLevel);
    return [id, { ...c, xp, level, skillPoints: 12, hp: maxHp(content, content.characters[id], { ...c, xp, level }) }];
  }));
  return { ...s, party };
}

/** Stand in the Steward's core knowing who is in the fourth chair. */
function atTheCore(seed = 404): GameState {
  let s = skipDialogue(newGame(seed));
  s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TRAVEL', location: 'meridian_2312' });
  s = skipDialogue(s);
  s = reduce(s, { type: 'START_DIALOGUE', id: 'board_secretary', returnTo: { id: 'hub' } });
  return skipDialogue(s);
}

/** Walk the four floors, winning each. */
function descend(s: GameState): GameState {
  for (const [dialogue, flag] of [['floor_2031', 'floor2031'], ['floor_2064', 'floor2064'],
    ['floor_2148', 'floor2148'], ['floor_2312', 'floor2312']] as const) {
    s = reduce(s, { type: 'START_DIALOGUE', id: dialogue, returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    expect(s.screen.id, dialogue).toBe('battle');
    s = autoBattle(s);
    if (s.battle?.phase !== 'won') return s;
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } });
    expect(s.flags, flag).toContain(flag);
  }
  return s;
}

describe('the stack', () => {
  it('opens under the core only once you know who is in the fourth chair', () => {
    let s = skipDialogue(newGame(404));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TRAVEL', location: 'meridian_2312' });
    s = skipDialogue(s);
    expect(s.flags).not.toContain('knowsStrand');
    const gate = content.locations.meridian_2312.actions!.find((a) => a.dialogue === 'stack_enter')!;
    expect(gate.requires).toEqual(['flag:knowsStrand']);

    s = atTheCore();
    expect(s.flags).toContain('knowsStrand');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'stack_enter', returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    expect(s.location).toBe('meridian_stack');
    expect(s.log).toContain('the_stack');
    // It is not a Deep Site: you are already in all four eras, so there is nowhere to jump to.
    expect(content.locations.meridian_stack.timeLinks).toEqual([]);
    expect(content.locations.meridian_stack.offMap).toBe(true);
  });

  it('offers one floor at a time, in order, and the chair only at the bottom', () => {
    const actions = content.locations.meridian_stack.actions!;
    const floors = actions.filter((a) => a.dialogue.startsWith('floor_'));
    expect(floors.map((f) => f.hint)).toEqual(['2031', '2064', '2148', '2312']);
    // Each floor needs the one above it and disappears once taken.
    expect(floors[0].requires).toEqual(['!flag:floor2031']);
    expect(floors[3].requires).toEqual(['flag:floor2148', '!flag:floor2312']);
    expect(actions.find((a) => a.dialogue === 'the_chair_itself')!.requires).toEqual(['flag:floor2312']);
  });

  it('walks all four floors and reaches the chair', () => {
    let s = levelled(atTheCore());
    s = reduce(s, { type: 'START_DIALOGUE', id: 'stack_enter', returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    s = descend(s);
    expect(s.flags).toContain('floor2312');
    for (const era of ['2031', '2064', '2148', '2312']) {
      expect(content.encounters[`stack_floor_${era}`].era, era).toBe(era);
    }
  });
});

describe('the chair', () => {
  it('breaks into a second bar with a person in it, and its own art', () => {
    const boss = content.enemies.strand_perpetual;
    expect(boss.secondBar).toBeDefined();
    expect(boss.rig).toBe('strand_perpetual_phase1');
    expect(boss.secondBar!.rig).toBe('strand_perpetual_phase2');
    expect(boss.secondBar!.immunities, 'the core is a man; Signal stops').toContain('signal');
    expect(boss.secondBar!.weakness).toBe('chronal');

    let s = reduce(newGame(404), { type: 'START_ENCOUNTER', encounterId: 'strand_perpetual' });
    const shell = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    expect(shell.shield).toBeGreaterThan(0);
    // Beat the shell down and the core stands up in its place, not a corpse.
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === shell.id ? { ...c, hp: 1, shield: 0 } : c)) } };
    s = autoBattle(s, undefined, 60);
    const after = s.battle!.combatants.find((c) => c.id === shell.id)!;
    expect(after.bar === 2 || after.down, 'the shell split or the fight ended').toBe(true);
  });

  it('is a duel instead when young Strand is standing there with the ledger to back him', () => {
    const offers = content.dialogues.the_chair_itself.lines.flatMap((l) => l.choices ?? []);
    const duel = offers.find((c) => c.action === 'battle:strand_reconciled')!;
    expect(duel.conditions).toEqual(['party:strand_young', 'ownership>=50']);
    expect(offers.filter((c) => c.action === 'battle:strand_perpetual')).toHaveLength(2);
    // The duellist has nothing inside him that is not him.
    expect(content.enemies.strand_reconciled.secondBar).toBeUndefined();
    expect(content.enemies.strand_reconciled.machine).toBe(false);
  });
});

describe('the endings', () => {
  it('ships one for each of the five outcomes the timeline can reach', () => {
    const names = Object.values(content.endings).map((e) => e.name).sort();
    expect(names).toEqual(['Perpetuity', 'Reconciled', 'The Commons', 'The Gift', 'The Silence']);
    for (const e of Object.values(content.endings)) {
      expect(e.epilogue.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.coda, e.id).toBeTruthy();
    }
    // Every ending endingFor() can return has a page to show for it.
    for (const [own, sync, flags] of [[60, 0, []], [20, 70, []], [0, -70, []], [0, 0, []], [60, 0, ['youngStrandInParty']]] as const) {
      const name = endingFor(own, sync, [...flags]);
      expect(Object.values(content.endings).some((e) => e.name === name), name).toBe(true);
    }
  });

  it('hands off to the epilogue when the last fight is won, and not before', () => {
    expect(content.encounters.strand_perpetual.endsRun).toBe(true);
    expect(content.encounters.strand_reconciled.endsRun).toBe(true);
    expect(content.encounters.stack_floor_2312.endsRun).toBeUndefined();

    let s = reduce(newGame(404), { type: 'START_ENCOUNTER', encounterId: 'stack_floor_2031' });
    s = autoBattle(s);
    if (s.battle?.phase === 'won') {
      s = reduce(s, { type: 'BATTLE_FINISH' });
      expect(s.screen.id, 'an ordinary floor goes to the result screen').toBe('battleResult');
    }

    // Force a win on the last fight rather than grinding it out.
    let f = reduce(newGame(404), { type: 'START_ENCOUNTER', encounterId: 'strand_perpetual' });
    f = { ...f, battle: { ...f.battle!, phase: 'won', pendingRewards: { xp: 0, currency: 0, items: [], flags: [], levelUps: [] } } };
    f = reduce(f, { type: 'BATTLE_FINISH' });
    expect(f.screen.id).toBe('ending');
    expect(f.flags).toContain('runFinished');
    expect(f.battle).toBeNull();
  });

  it('reads the epilogue off the same two values that have been moving all game', () => {
    const party = newGame(404).party;
    let w = newGame(404).world;
    for (const id of ['leak_charter', 'expose_buyers', 'name_the_beneficiary', 'arm_resistance']) {
      w = applyChoice(content, w, id, 1);
    }
    const d = deriveWorld(content, w, party);
    expect(d.ending).toBe(endingFor(d.ownership, d.sync, d.flags));
    expect(Object.values(content.endings).some((e) => e.name === d.ending)).toBe(true);
    // Nothing about the stack itself changes the outcome.
    expect(activeVariant(content, { ...newGame(404), world: w }, content.locations.meridian_stack)).toBeNull();
  });
});

describe('the stack is costed like the end of the game', () => {
  const run = (enc: string, xp: number) => {
    let s = newGame(404);
    const party = Object.fromEntries(Object.entries(s.party).map(([id, c]) => {
      const level = 1 + Math.floor(xp / content.rules.xpPerLevel);
      return [id, { ...c, xp, level, skillPoints: 12, hp: maxHp(content, content.characters[id], { ...c, xp, level }) }];
    }));
    s = reduce({ ...s, party }, { type: 'START_ENCOUNTER', encounterId: enc });
    return autoBattle(s, undefined, 800).battle?.phase;
  };

  it('lets an endgame party through every floor, pressing nothing cleverer than Strike', () => {
    for (const enc of ['stack_floor_2031', 'stack_floor_2064', 'stack_floor_2148', 'stack_floor_2312']) {
      expect(run(enc, 900), enc).toBe('won');
    }
  });

  it('does not let a party that has barely left Kell walk into the chair and win', () => {
    // The floors are survivable; the chair is not, on a party that skipped the whole middle.
    expect(run('strand_perpetual', 100)).toBe('lost');
    expect(run('strand_reconciled', 100)).toBe('lost');
    expect(run('strand_perpetual', 900), 'and it is beatable once the run has actually happened').toBe('won');
    expect(run('strand_reconciled', 900)).toBe('won');
  });
});
