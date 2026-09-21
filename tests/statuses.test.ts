import { describe, expect, it } from 'vitest';
import { createBattle, endTurn, enemyTurn, resolveAbility } from '../src/core/battle/battle';
import { STATUS_INFO, statusChips, statusSentence } from '../src/core/battle/statuses';
import { content, newGame } from './helpers';
import type { BattleState } from '../src/types/state';

/** Every status the content can actually inflict. */
const inflicted = [...new Set(Object.values(content.abilities)
  .map((a) => a.status?.id).filter((id): id is string => !!id))];

/** A fight with `who` up next and enough threads to act, so the test is about the status. */
function fightWith(ability: string, encounter = 'kell_2312_gate', seed = 21): { b: BattleState; actorId: string } {
  const base = createBattle(content, { ...newGame(seed), location: content.encounters[encounter].location }, encounter, false);
  const actor = base.combatants.find((c) => c.side === 'party' && c.abilities.includes(ability));
  if (!actor) throw new Error(`nobody in this fight has ${ability}`);
  const b: BattleState = {
    ...base,
    phase: 'player',
    turnIndex: base.order.indexOf(actor.id),
    combatants: base.combatants.map((c) => (c.id === actor.id ? { ...c, threads: 9 } : c)),
  };
  return { b, actorId: actor.id };
}

describe('what a status does', () => {
  it('is described for every status the game can inflict', () => {
    expect(inflicted.length).toBeGreaterThan(5);
    for (const id of inflicted) {
      const info = STATUS_INFO[id];
      expect(info, `${id} has no description, so the player is told a name and nothing else`).toBeDefined();
      expect(info.effect(content.rules).length, `${id}'s effect is empty`).toBeGreaterThan(10);
      expect(info.polarity === 'good' || info.polarity === 'bad').toBe(true);
    }
  });

  it('reads the tuning rather than repeating it', () => {
    const real = statusSentence('marked', 3, content.rules);
    expect(real).toContain(`${Math.round(content.rules.markBonus * 100)}% more damage`);
    // Retune the mark and the sentence follows, because it is the same number.
    const louder = statusSentence('marked', 3, { ...content.rules, markBonus: 0.5 });
    expect(louder).toContain('50% more damage');
  });

  it('names the duration, and says when something runs until it is spent', () => {
    expect(statusSentence('guard', 1, content.rules)).toContain('for 1 turn');
    expect(statusSentence('marked', 3, content.rules)).toContain('for 3 turns');
    expect(statusSentence('held', 9, content.rules)).toContain('until it is spent');
  });
});

describe('the battle log', () => {
  it('says what a status did and how long it lasts, the moment it lands', () => {
    let { b, actorId } = fightWith('audit');
    const foe = b.combatants.find((c) => c.side === 'enemy')!;
    b = resolveAbility(b, actorId, 'audit', foe.id, content);
    const line = b.log.find((l) => l.text.includes('Marked'))!;
    expect(line, 'the mark is announced').toBeDefined();
    expect(line.text).toContain('25% more damage');
    expect(line.text).toContain('for 3 turns');
    expect(line.kind, 'a status against you reads as a warning').toBe('warn');
  });

  it('says when a status wears off, rather than letting it vanish', () => {
    let { b, actorId } = fightWith('guard');
    b = resolveAbility(b, actorId, 'guard', null, content);
    expect(b.combatants.find((c) => c.id === actorId)!.statuses.map((s) => s.id)).toContain('guard');

    // Guard runs one turn. Take the order all the way round to this combatant again.
    b = endTurn(b, actorId, content);
    for (let i = 0; i < b.order.length * 3; i++) {
      if (b.phase === 'won' || b.phase === 'lost') break;
      const cur = b.combatants.find((c) => c.id === b.order[b.turnIndex])!;
      if (cur.id === actorId) break;
      b = cur.side === 'enemy' ? enemyTurn(b, content) : endTurn(b, cur.id, content);
    }
    expect(b.combatants.find((c) => c.id === actorId)!.statuses.map((s) => s.id),
      'one turn means one turn').not.toContain('guard');
    expect(b.log.map((l) => l.text).join(' '), 'and the player is told why the number moved')
      .toContain('Guard on');
  });
});

describe('the status chips on a card', () => {
  it('collapses stacks into one row with a count and the longest timer', () => {
    let { b } = fightWith('guard');
    const hale = b.combatants.find((c) => c.side === 'party')!;
    b = {
      ...b,
      combatants: b.combatants.map((c) => (c.id === hale.id
        ? { ...c, statuses: [{ id: 'held', turns: 9 }, { id: 'held', turns: 7 }, { id: 'marked', turns: 2 }] }
        : c)),
    };
    const chips = statusChips(b.combatants.find((c) => c.id === hale.id)!, content.rules);
    const held = chips.find((s) => s.id === 'held')!;
    expect(held.count, 'two charges, one row').toBe(2);
    expect(held.turns, 'the longest one sets the timer').toBe(9);
    expect(held.polarity).toBe('good');
    expect(chips.find((s) => s.id === 'marked')!.polarity).toBe('bad');
    expect(chips[0].id, 'longest first').toBe('held');
  });
});
