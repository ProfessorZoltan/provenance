import { describe, expect, it } from 'vitest';
import { createBattle, current, resolveAbility } from '../src/core/battle/battle';
import { loadout, xpForLevel } from '../src/core/stats';
import { activeChoices, applyChoice, deriveWorld } from '../src/core/timeline';
import { evalAll } from '../src/core/conditions';
import { conditionContext } from '../src/core/encounter';
import { learn, logSuperseded } from '../src/core/reducer';
import { content, newGame, reduce, run } from './helpers';
import type { GameState } from '../src/types/state';

function recruited(seed = 11): GameState {
  return reduce(newGame(seed), { type: 'RECRUIT', character: 'ilo9' });
}

describe('roster', () => {
  it('fields a recruit automatically and caps the active party', () => {
    const s = recruited();
    expect(Object.keys(s.party)).toContain('ilo9');
    expect(s.activeParty).toContain('ilo9');
    expect(s.activeParty.length).toBeLessThanOrEqual(content.rules.activePartyMax);
    expect(s.flags).toContain('recruited:ilo9');
  });

  it('benches and fields members, and never benches the Auditor', () => {
    let s = recruited();
    s = reduce(s, { type: 'SET_ACTIVE_PARTY', members: ['player', 'wren'] });
    expect(s.activeParty).toEqual(['player', 'wren']);
    expect(Object.keys(s.party)).toHaveLength(4);
    expect(() => reduce(s, { type: 'SET_ACTIVE_PARTY', members: ['wren', 'dax'] })).toThrow(/Auditor/);
    expect(() => reduce(s, { type: 'SET_ACTIVE_PARTY', members: ['player', 'wren', 'dax', 'ilo9', 'player'] })).toThrow();
  });

  it('only takes the active party into a fight', () => {
    let s = recruited();
    s = reduce(s, { type: 'SET_ACTIVE_PARTY', members: ['player', 'ilo9'] });
    const b = createBattle(content, s, 'kell_2312_perimeter', false);
    expect(b.combatants.filter((c) => c.side === 'party').map((c) => c.id).sort()).toEqual(['ilo9', 'player']);
  });

  it('pays benched members a reduced share of the experience', () => {
    let s = recruited();
    s = reduce(s, { type: 'SET_ACTIVE_PARTY', members: ['player', 'wren'] });
    const before = { dax: s.party.dax.xp, wren: s.party.wren.xp };
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    let guard = 200;
    while (s.battle && s.battle.phase !== 'won' && s.battle.phase !== 'lost' && guard-- > 0) {
      const b = s.battle;
      if (b.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      const actor = current(b)!;
      const enemy = b.combatants.find((c) => c.side === 'enemy' && !c.down);
      if (!enemy) break;
      s = actor.threads >= 1
        ? reduce(s, { type: 'BATTLE_ABILITY', actor: actor.id, ability: 'strike', target: enemy.id })
        : reduce(s, { type: 'BATTLE_END_TURN', actor: actor.id });
    }
    s = reduce(s, { type: 'BATTLE_FINISH' });
    const activeGain = s.party.wren.xp - before.wren;
    const benchedGain = s.party.dax.xp - before.dax;
    expect(activeGain).toBeGreaterThan(0);
    expect(benchedGain).toBe(Math.round(activeGain * content.rules.benchedXpShare));
  });
});

describe('equipment', () => {
  it('applies gear stats, returns the replaced piece and refuses gear meant for someone else', () => {
    let s = newGame(4);
    s = { ...s, inventory: { ...s.inventory, items: { ...s.inventory.items, ash_blade: 1, wren_censer: 1 } } };
    const before = loadout(content, content.characters.dax, s.party.dax).stats.grit;
    s = reduce(s, { type: 'EQUIP', character: 'dax', item: 'ash_blade' });
    expect(loadout(content, content.characters.dax, s.party.dax).stats.grit).toBe(before + 10);
    expect(s.inventory.items.ash_blade).toBe(0);
    expect(() => reduce(s, { type: 'EQUIP', character: 'dax', item: 'wren_censer' })).toThrow(/not for/);
    s = reduce(s, { type: 'UNEQUIP', character: 'dax', slot: 'weapon' });
    expect(s.inventory.items.ash_blade).toBe(1);
    expect(loadout(content, content.characters.dax, s.party.dax).stats.grit).toBe(before);
  });

  it('carries gear into battle', () => {
    let s = newGame(4);
    s = { ...s, inventory: { ...s.inventory, items: { ...s.inventory.items, dax_hammer: 1 } } };
    const plain = createBattle(content, s, 'kell_2312_perimeter', false).combatants.find((c) => c.id === 'dax')!;
    s = reduce(s, { type: 'EQUIP', character: 'dax', item: 'dax_hammer' });
    const armed = createBattle(content, s, 'kell_2312_perimeter', false).combatants.find((c) => c.id === 'dax')!;
    expect(armed.stats.grit).toBe(plain.stats.grit + 14);
    expect(armed.stats.latency).toBe(plain.stats.latency + 6);
  });
});

describe('recruitment and departure', () => {
  it('drops a member whose leave condition comes true, but never the Auditor', () => {
    let s = recruited();
    expect(content.characters.ilo9.leavesIf).toBeTruthy();
    const hostile = Object.fromEntries(Object.entries(s.party).map(([k, v]) => [k, { ...v, sync: -90 }]));
    s = { ...s, party: hostile };
    s = reduce(s, { type: 'TIMELINE_CHOICE', choice: 'arm_resistance' });
    expect(Object.keys(s.party)).not.toContain('ilo9');
    expect(s.activeParty).not.toContain('ilo9');
    expect(s.flags).toContain('left:ilo9');
    expect(Object.keys(s.party)).toContain('player');
  });

  it('starts a recruit near the party rather than at level one', () => {
    let s = newGame(4);
    const xp = xpForLevel(5, content.rules.xpPerLevel);
    const party = Object.fromEntries(Object.entries(s.party).map(([k, v]) => [k, { ...v, xp }]));
    s = reduce({ ...s, party }, { type: 'RECRUIT', character: 'ilo9' });
    expect(s.party.ilo9.xp).toBe(xp);
    expect(s.party.ilo9.level).toBe(5);
    expect(s.party.ilo9.skillPoints).toBeGreaterThan(1);
  });
});

describe('editing upstream', () => {
  it('erases a downstream choice at the same site, and leaves other sites alone', () => {
    const s = newGame(6);
    let w = applyChoice(content, s.world, 'arm_resistance', 0);
    w = applyChoice(content, w, 'free_ilo9', 1);
    w = applyChoice(content, w, 'keep_retreat_common', 2);
    const active = activeChoices(w.history).map((h) => h.choiceId);
    expect(active, '2031 at Kell rewrites 2148 at Kell').not.toContain('arm_resistance');
    expect(active, 'the graveyard is a different place').toContain('free_ilo9');
    expect(active).toContain('keep_retreat_common');
  });

  it('leaves an upstream choice standing when a later era is edited afterwards', () => {
    const s = newGame(6);
    let w = applyChoice(content, s.world, 'keep_retreat_common', 0);
    w = applyChoice(content, w, 'arm_resistance', 1);
    const active = activeChoices(w.history).map((h) => h.choiceId);
    expect(active).toEqual(['keep_retreat_common', 'arm_resistance']);
    const d = deriveWorld(content, w, s.party);
    expect(d.flags).toContain('retreatCommon');
    expect(d.flags).toContain('armedResistance');
  });
});

describe('enemy variety', () => {
  it('a Construct keeps fighting on its core after the shell breaks', () => {
    const s = newGame(8);
    const b = createBattle(content, s, 'graveyard_construct', false);
    const target = b.combatants.find((c) => c.family === 'construct')!;
    expect(target.bar).toBe(1);
    const ready = { ...b, phase: 'player' as const, turnIndex: b.order.indexOf('dax'),
      combatants: b.combatants.map((c) => (c.id === 'dax' ? { ...c, threads: 9, stats: { ...c.stats, grit: 999 } } : c)) };
    const after = resolveAbility(ready, 'dax', 'wreck', target.id, content);
    const now = after.combatants.find((c) => c.id === target.id)!;
    expect(now.down, 'the shell breaking is not a kill').toBe(false);
    expect(now.bar).toBe(2);
    expect(now.name).toBe(content.enemies[target.ref].secondBar!.name);
    expect(now.immunities, 'the core is a human under the plating').toContain('signal');
    expect(after.log.at(-1)!.text).toContain('shell splits');
  });

  it('ILO-9 forks a copy that fights and then dissolves', () => {
    let s = reduce(recruited(9), { type: 'SET_ACTIVE_PARTY', members: ['player', 'ilo9'] });
    s = { ...s, party: { ...s.party, ilo9: { ...s.party.ilo9, nodes: ['i_frk_1'] } } };
    const b = createBattle(content, s, 'kell_2312_perimeter', false);
    const ready = { ...b, phase: 'player' as const, turnIndex: b.order.indexOf('ilo9'),
      combatants: b.combatants.map((c) => (c.id === 'ilo9' ? { ...c, threads: 4 } : c)) };
    const forked = resolveAbility(ready, 'ilo9', 'instance', null, content);
    const copy = forked.combatants.find((c) => c.temporary);
    expect(copy, 'a copy joins the party side').toBeDefined();
    expect(copy!.side).toBe('party');
    expect(forked.order).toContain(copy!.id);
    expect(copy!.expiresAfterRound).toBe(forked.round + 2);
    // A copy falling is not a party wipe.
    const enemy = forked.combatants.find((c) => c.side === 'enemy')!;
    const alone = {
      ...forked,
      phase: 'enemy' as const,
      turnIndex: forked.order.indexOf(enemy.id),
      combatants: forked.combatants.map((c) => {
        if (c.id === enemy.id) return { ...c, threads: 2 };
        return c.side === 'party' && !c.temporary ? { ...c, down: true, hp: 0 } : c;
      }),
    };
    const out = resolveAbility(alone, enemy.id, 'drone_dart', copy!.id, content);
    expect(out.phase, 'the party is down, so the fight is lost even with a copy standing').toBe('lost');
  });
});

describe('era nodes', () => {
  it('can only be bought while standing in their era', () => {
    let s = newGame(12);
    s = { ...s, party: { ...s.party, player: { ...s.party.player, skillPoints: 9 } } };
    expect(() => reduce(s, { type: 'UNLOCK_NODE', character: 'player', node: 'p_era_2148' })).toThrow();
    s = run(s, { type: 'TIME_JUMP', era: '2148' });
    s = reduce(s, { type: 'UNLOCK_NODE', character: 'player', node: 'p_era_2148' });
    expect(s.party.player.nodes).toContain('p_era_2148');
    expect(() => reduce(s, { type: 'UNLOCK_NODE', character: 'player', node: 'p_era_2031' })).toThrow();
  });
});

describe('the case log entry for a companion', () => {
  it('is written on recruitment and survives being benched', () => {
    let s = recruited();
    s = learn(content, s);
    expect(s.log, 'joining writes the entry').toContain('ilo9');

    // Four recruits and only three open seats: somebody has to sit out.
    s = reduce(s, { type: 'SET_ACTIVE_PARTY', members: ['player'] });
    expect(s.activeParty).not.toContain('ilo9');

    s = learn(content, s);
    expect(s.log, 'benching does not unwrite what the Auditor already knows').toContain('ilo9');
    expect(logSuperseded(content, s), 'nor strike it through').not.toContain('ilo9');
  });

  it('is written for every companion the game can recruit', () => {
    for (const id of ['wren', 'dax', 'ilo9', 'mara', 'hale']) {
      const entry = content.log[id];
      expect(entry, `${id} has a case-log entry`).toBeDefined();
      expect(entry.when, `${id}'s entry keys off recruitment, not the active party`)
        .toEqual([`flag:recruited:${id}`]);
    }
  });
});

describe('a companion on the bench', () => {
  /** The lines and choices a conversation would actually show in this state. */
  function visible(s: GameState, id: string) {
    const ctx = conditionContext(content, s);
    const lines = content.dialogues[id].lines.filter((l) => evalAll(l.conditions, ctx));
    return {
      lines,
      choices: lines.flatMap((l) => (l.choices ?? []).filter((c) => evalAll(c.conditions, ctx)).map((c) => c.text)),
    };
  }

  const bench = (s: GameState, id: string) =>
    reduce(s, { type: 'SET_ACTIVE_PARTY', members: s.activeParty.filter((a) => a !== id) });

  /** Each offer sits behind a story flag; without it the scene is silent and proves nothing. */
  const ready = (flags: string[]) => {
    const s = newGame(19);
    return {
      ...s,
      flags: [...s.flags, ...flags],
      party: Object.fromEntries(Object.entries(s.party).map(([k, c]) => [k, { ...c, sync: 40 }])),
    };
  };

  const scenes: Array<[string, string, string, string[]]> = [
    ['hale', 'hale_ridge', 'Come with us. You know the ground.', ['armedResistance']],
    ['mara', 'mara_vesely', 'We change what already happened. Come and see.', ['treatyAmended']],
    ['quiroga', 'quiroga_lab', 'Come with us instead. There is more of this than one Thursday.', ['metQuiroga']],
    ['strand_young', 'strand_young_2031', 'Come with us. See it. Then decide what you sign.', []],
  ];

  for (const [id, dialogue, offer, flags] of scenes) {
    it(`does not re-offer ${id} to a party that already has them`, () => {
      const before = ready(flags);
      const reach = (s: GameState) => {
        const here = visible(s, dialogue);
        const onward = here.lines.map((l) => l.next).filter((n): n is string => !!n);
        return [...here.choices, ...onward.flatMap((n) => visible(s, n).choices)];
      };
      // The scene has to be live in the first place, or this proves nothing.
      expect(reach(before), `${dialogue} never offers ${id} at all`).toContain(offer);

      const joined = reduce(before, { type: 'RECRUIT', character: id });
      const benched = bench(joined, id);
      expect(benched.activeParty).not.toContain(id);

      expect(reach(benched), `${dialogue} still offers to recruit a benched ${id}`).not.toContain(offer);
      expect(visible(benched, dialogue).lines.length, `${dialogue} has nothing to say`).toBeGreaterThan(0);
    });
  }

  it('keeps the Meridian timeline edits reachable after Quiroga joins', () => {
    // Her second-visit line was the only door to quiroga_choice, and recruiting her shut it:
    // leak_charter (+50 Ownership) and burn_lab became unreachable for the rest of the run.
    const joined = reduce(ready(['metQuiroga']), { type: 'RECRUIT', character: 'quiroga' });
    for (const s of [joined, bench(joined, 'quiroga')]) {
      const ctx = conditionContext(content, s);
      const onward = content.dialogues.quiroga_lab.lines
        .filter((l) => evalAll(l.conditions, ctx)).map((l) => l.next).filter(Boolean);
      expect(onward, 'Thursday is still decidable').toContain('quiroga_choice');
      const offered = visible(s, 'quiroga_choice').choices;
      expect(offered).toContain('Put the charter in front of the press before the vote.');
      expect(offered).toContain('Burn the room. The weights are on tape and the tape is in there.');
      expect(offered, 'but she is already with you').not.toContain(
        'Come with us instead. There is more of this than one Thursday.');
    }
  });
});
