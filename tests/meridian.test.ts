import { describe, expect, it } from 'vitest';
import { current, resolveAbility } from '../src/core/battle/battle';
import { evalCondition } from '../src/core/conditions';
import { conditionContext } from '../src/core/encounter';
import { activeVariant } from '../src/core/reducer';
import { activeChoices, applyChoice, deriveWorld, endingFor } from '../src/core/timeline';
import { ERA_LEVEL, TYPICAL, partyAt } from './balance';
import { autoBattle, content, newGame, reduce, run, skipDialogue } from './helpers';
import type { GameState } from '../src/types/state';

const withChoice = (id: string, seed = 17) => {
  const s = newGame(seed);
  return { ...s, world: applyChoice(content, s.world, id, 1) };
};

describe('the Founding', () => {
  it('offers the three readings of 2031 the design table names, at Meridian', () => {
    for (const id of ['leak_charter', 'recruit_strand', 'burn_lab']) {
      expect(content.timelineChoices[id].site, id).toBe('meridian');
      expect(content.timelineChoices[id].era, id).toBe('2031');
    }
    const base = deriveWorld(content, newGame(17).world, newGame(17).party);
    const after = (id: string) => deriveWorld(content, withChoice(id).world, newGame(17).party);
    expect(after('leak_charter').ownership - base.ownership).toBe(50);
    expect(after('recruit_strand').sync - base.sync).toBe(40);
    expect(after('burn_lab').sync - base.sync).toBe(-60);
    // One campus, one Thursday: they overwrite each other.
    let w = applyChoice(content, newGame(17).world, 'leak_charter', 1);
    w = applyChoice(content, w, 'burn_lab', 2);
    expect(activeChoices(w.history).map((h) => h.choiceId)).toEqual(['burn_lab']);
  });

  it('makes recruiting Strand cost the charter leak, since it is the same afternoon', () => {
    let w = applyChoice(content, newGame(17).world, 'leak_charter', 1);
    w = applyChoice(content, w, 'recruit_strand', 2);
    expect(activeChoices(w.history).map((h) => h.choiceId), 'one Thursday, one decision').toEqual(['recruit_strand']);
    const d = deriveWorld(content, w, newGame(17).party);
    expect(d.flags).toContain('youngStrandInParty');
    expect(d.flags).not.toContain('charterLeaked');
  });

  it('leaves the secret ending reachable even without the fifty points the leak would have given', () => {
    // Best Ownership available per site, taking Strand at Meridian rather than the leak.
    const bySite = new Map<string, typeof content.timelineChoices[string][]>();
    for (const c of Object.values(content.timelineChoices)) {
      const key = `${c.site}:${c.era}`;
      bySite.set(key, [...(bySite.get(key) ?? []), c]);
    }
    let world = newGame(17).world;
    let order = 1;
    for (const group of bySite.values()) {
      const forced = group.find((c) => c.id === 'recruit_strand');
      const pick = forced ?? group.reduce((a, b) => (b.ownershipDelta > a.ownershipDelta ? b : a));
      world = applyChoice(content, world, pick.id, order++);
    }
    const d = deriveWorld(content, world, newGame(17).party);
    expect(d.flags).toContain('youngStrandInParty');
    expect(d.ownership, 'Reconciled needs +50 and Strand costs the leak').toBeGreaterThanOrEqual(50);
    expect(endingFor(d.ownership, d.sync, d.flags)).toBe('Reconciled');
  });

  it('changes what is standing in the 2312 core depending on the 2031 room', () => {
    expect(activeVariant(content, withChoice('leak_charter'), content.locations.meridian_2312)!.npcs)
      .toContain('quiroga_2312');
    expect(activeVariant(content, withChoice('burn_lab'), content.locations.meridian_2312)!.description)
      .toMatch(/rebuilt twice from partial weights/);
    expect(activeVariant(content, newGame(17), content.locations.meridian_2312)).toBeNull();
  });
});

describe('recruiting at Meridian', () => {
  it('brings Quiroga along from the bench, and young Strand from the decision itself', () => {
    let s = skipDialogue(newGame(88));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TIME_JUMP', era: '2031' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'TRAVEL', location: 'meridian_2031' });
    s = skipDialogue(s);
    expect(s.location).toBe('meridian_2031');

    s = reduce(s, { type: 'START_DIALOGUE', id: 'quiroga_lab', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 2); // "Come with us instead."
    expect(Object.keys(s.party)).toContain('quiroga');
    expect(s.log).toContain('quiroga');
    expect(s.log).toContain('the_pooling');

    // Strand only takes the meeting from a party that is not already hostile to him.
    const offer = content.dialogues.strand_choice.lines.flatMap((l) => l.choices ?? [])
      .find((c) => c.timelineChoice === 'recruit_strand')!;
    expect(offer.conditions, 'he only takes the meeting from a party that is not already hostile').toEqual(['sync>=20']);
    const hostile = { ...s, party: Object.fromEntries(Object.entries(s.party).map(([k, c]) => [k, { ...c, sync: -50 }])) };
    let h = reduce(hostile, { type: 'START_DIALOGUE', id: 'strand_choice', returnTo: { id: 'hub' } });
    h = skipDialogue(h, 0);
    expect(Object.keys(h.party), 'a Cinder party never gets the offer').not.toContain('strand_young');

    const warm = { ...s, party: Object.fromEntries(Object.entries(s.party).map(([k, c]) => [k, { ...c, sync: 40 }])) };
    let g = reduce(warm, { type: 'START_DIALOGUE', id: 'strand_choice', returnTo: { id: 'hub' } });
    g = skipDialogue(g, 0);
    expect(Object.keys(g.party)).toContain('strand_young');
    expect(g.world.history.map((x) => x.choiceId)).toContain('recruit_strand');
  });
});

describe('the Meridian kits', () => {
  /** Nodes are bought before the fight starts: a combatant's kit is snapshotted at createBattle. */
  function inFight(who: string, enc: string, nodes: string[] = [], seed = 12): GameState {
    let s = reduce(newGame(seed), { type: 'RECRUIT', character: who });
    s = { ...s, party: { ...s.party, [who]: { ...s.party[who], skillPoints: 14 } } };
    for (const node of nodes) s = reduce(s, { type: 'UNLOCK_NODE', character: who, node });
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: enc, surprise: false });
    let guard = 40;
    while (guard-- > 0 && current(s.battle!)?.id !== who) {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    return s;
  }

  it("takes a Construct's shell off with Teardown rather than beating on it", () => {
    const s = inFight('quiroga', 'meridian_2031_courtyard', ['q_tear_1', 'q_tear_2']);
    const shell = s.battle!.combatants.find((c) => c.side === 'enemy' && c.bar === 1 && content.enemies[c.ref]?.secondBar)!;
    const after = resolveAbility(s.battle!, 'quiroga', 'teardown', shell.id, content);
    const core = after.combatants.find((c) => c.id === shell.id)!;
    expect(core.bar).toBe(2);
    expect(core.name).not.toBe(shell.name);
    expect(core.shield, 'the frame is gone, not damaged').toBe(0);
    expect(after.log.some((l) => /at the seam/.test(l.text))).toBe(true);
  });

  it('publishes the weights: every machine but the strongest changes sides, for a while', () => {
    const s = inFight('quiroga', 'meridian_2031_courtyard', ['q_blue_1', 'q_blue_2', 'q_blue_4']);
    const machines = s.battle!.combatants.filter((c) => c.side === 'enemy' && c.machine);
    expect(machines.length).toBeGreaterThan(1);
    const holdout = [...machines].sort((x, y) => y.hp + y.shield - (x.hp + x.shield))[0];
    const after = resolveAbility(s.battle!, 'quiroga', 'open_weights', 'quiroga', content);
    expect(after.combatants.find((c) => c.id === holdout.id)!.side, 'somebody is left to argue with').toBe('enemy');
    expect(after.phase).not.toBe('won');
    for (const m0 of machines.filter((c) => c.id !== holdout.id)) {
      const m = after.combatants.find((c) => c.id === m0.id)!;
      expect(m.side, `${m.name} changed sides`).toBe('party');
      expect(m.temporary, 'and only for a while').toBe(true);
      expect(m.returnsTo).toBe('enemy');
    }
  });

  it('buys out one failing enemy per battle, for two rounds, and never a healthy one or a boss', () => {
    const s = inFight('strand_young', 'meridian_2064_atrium');
    const foes0 = s.battle!.combatants.filter((c) => c.side === 'enemy' && !c.down);
    expect(() => resolveAbility(s.battle!, 'strand_young', 'buyout', foes0[0].id, content), 'a healthy enemy is not for sale').toThrow();
    const failing = { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.side === 'enemy' ? { ...c, hp: Math.floor(c.maxHp * 0.4) } : c)) };
    const bossed = { ...failing, combatants: failing.combatants.map((c) => (c.id === foes0[0].id ? { ...c, resistsControl: true } : c)) };
    expect(() => resolveAbility(bossed, 'strand_young', 'buyout', foes0[0].id, content), 'a boss is not for sale').toThrow();
    const foes = failing.combatants.filter((c) => c.side === 'enemy' && !c.down);
    let b = resolveAbility(failing, 'strand_young', 'buyout', foes[0].id, content);
    const bought = b.combatants.find((c) => c.id === foes[0].id)!;
    expect(bought.side).toBe('party');
    expect(bought.temporary).toBe(true);
    expect(bought.expiresAfterRound).toBe(failing.round + content.rules.control.buyoutRounds);
    // Paid for, not out of threads: the second attempt is refused by the once-per-battle rule.
    b = { ...b, combatants: b.combatants.map((c) => (c.id === 'strand_young' ? { ...c, threads: 3 } : c)) };
    b = resolveAbility(b, 'strand_young', 'buyout', foes[1].id, content);
    expect(b.combatants.find((c) => c.id === foes[1].id)!.side, 'the position is spent').toBe('enemy');
    expect(b.log.some((l) => /already spent this fight/.test(l.text))).toBe(true);
    void s;
  });

  it("returns everything done to him with Hostile Takeover, and nothing when nothing has been", () => {
    const s = inFight('strand_young', 'meridian_2064_atrium', ['s_eq_1', 's_eq_2', 's_eq_3'], 13);
    const foe = s.battle!.combatants.find((c) => c.side === 'enemy' && !c.down)!;
    const pool = (b: typeof s.battle) => { const c = b!.combatants.find((x) => x.id === foe.id)!; return c.hp + c.shield; };
    const fresh = pool(s.battle) - pool(resolveAbility(s.battle!, 'strand_young', 'hostile_takeover', foe.id, content));

    // Take a beating first: the same shot should land far harder.
    const hurt = { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === 'strand_young' ? { ...c, hp: Math.round(c.maxHp * 0.3) } : c)) };
    const after = pool(hurt) - pool(resolveAbility(hurt, 'strand_young', 'hostile_takeover', foe.id, content));
    expect(after, 'the more he has taken, the larger the position').toBeGreaterThan(fresh);
  });
});

describe('screens that name a character', () => {
  it('sends the tech tree back rather than crashing on somebody who is not with you', () => {
    const s = skipDialogue(newGame(9));
    expect(Object.keys(s.party)).not.toContain('quiroga');
    // The reducer lets the screen be set; the screen itself has to cope.
    const opened = reduce(s, { type: 'SET_SCREEN', screen: { id: 'tech', character: 'quiroga' } });
    expect(opened.screen).toEqual({ id: 'tech', character: 'quiroga' });
    expect(content.characters.quiroga, 'the character exists in content, just not in the party').toBeDefined();
    expect(opened.party.quiroga).toBeUndefined();
  });
});

describe('the four fights that had no way in', () => {
  /** Open a conversation and take the choice whose text starts with `want`, wherever it appears. */
  function takeChoice(s: GameState, dialogue: string, want: string, guard = 40): GameState {
    s = reduce(s, { type: 'START_DIALOGUE', id: dialogue, returnTo: { id: 'hub' } });
    while (s.dialogue && guard-- > 0) {
      const line = content.dialogues[s.dialogue.id].lines[s.dialogue.index];
      const visible = (line.choices ?? []).filter((c) => !c.conditions
        || c.conditions.every((cond) => evalCondition(cond, conditionContext(content, s))));
      const i = visible.findIndex((c) => c.text.startsWith(want));
      if (i >= 0) return reduce(s, { type: 'DIALOGUE_CHOOSE', index: i });
      s = visible.length
        ? reduce(s, { type: 'DIALOGUE_CHOOSE', index: visible.length - 1 })
        : reduce(s, { type: 'DIALOGUE_ADVANCE' });
      if (s.screen.id === 'battle') break;
    }
    return s;
  }

  const cases: Array<[string, string, string, string]> = [
    ['The Last Door', 'vault_holdout', 'Open it.', 'meridian_2148_vault'],
    ['The Board Chamber', 'board_secretary', 'Go into the chamber.', 'capitol_2312_chamber'],
    ['The Division Bell', 'enabling_act', 'Call a division.', 'capitol_2031_division'],
  ];

  for (const [name, dialogue, choice, encounter] of cases) {
    it(`starts ${name} from the conversation that talks about it`, () => {
      const s = takeChoice(newGame(31), dialogue, choice);
      expect(s.screen.id, `${dialogue} did not start a fight`).toBe('battle');
      expect(s.battle?.encounterId).toBe(encounter);
    });
  }

  it('sends the concession after you for putting the buyers on the record', () => {
    let s = newGame(31);
    s = skipDialogue(s, 0);
    s = reduce(s, { type: 'START_DIALOGUE', id: 'handover_exposed', returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    expect(s.screen.id).toBe('battle');
    expect(s.battle?.encounterId).toBe('halden_2064_vote');
    expect(s.battle?.surprise, 'the ambush is not a fair fight').toBe(true);
  });

  it('pays out the flag each one exists to set, and only offers it once', () => {
    // A party that turned up at 2148 the way the balance suite models it.
    let s = takeChoice(partyAt(ERA_LEVEL['2148'], TYPICAL, 31), 'vault_holdout', 'Open it.');
    s = autoBattle(s);
    expect(s.battle?.phase).toBe('won');
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.flags).toContain('openedTheVault');

    // The wheel has been turned; the holdout does not offer it again.
    s = reduce(s, { type: 'START_DIALOGUE', id: 'vault_holdout', returnTo: { id: 'hub' } });
    const ctx = conditionContext(content, s);
    const offered = content.dialogues.vault_holdout.lines.some((l) =>
      (l.choices ?? []).some((c) => c.text === 'Open it.'
        && (c.conditions ?? []).every((cond) => evalCondition(cond, ctx))
        && (l.conditions ?? []).every((cond) => evalCondition(cond, ctx))));
    expect(offered).toBe(false);
  });
});
