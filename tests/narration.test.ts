import { beforeEach, describe, expect, it } from 'vitest';
import { advanceNarration, currentPage, narrationPending, resetNarration, syncNarration } from '../src/ui/narration';
import type { BattleLogEntry, BattleState } from '../src/types/state';
import { content, newGame, reduce } from './helpers';

function battle(seed = 5, enc = 'kell_2312_perimeter'): BattleState {
  return reduce(newGame(seed), { type: 'START_ENCOUNTER', encounterId: enc, surprise: false }).battle!;
}

/** Entries are created once and reused, exactly as the battle engine appends them. */
function entries(texts: string[]): BattleLogEntry[] {
  return texts.map((text) => ({ turn: 1, text, kind: 'hit' }));
}

function withLog(b: BattleState, log: BattleLogEntry[]): BattleState {
  return { ...b, log };
}

describe('battle narration', () => {
  beforeEach(() => resetNarration());

  it('queues every consequential line and skips turn bookkeeping', () => {
    const b = battle();
    const base: BattleState = { ...b, log: [
      { turn: 1, text: 'flavor', kind: 'info' },
      { turn: 1, text: "Auditor's turn: 3 threads.", kind: 'system' },
      { turn: 1, text: 'Auditor uses Strike on Sentry Drone 1: 23 kinetic damage.', kind: 'hit' },
    ] };
    const page = syncNarration(base);
    expect(page?.map((l) => l.text)).toEqual(['flavor', 'Auditor uses Strike on Sentry Drone 1: 23 kinetic damage.']);
    expect(narrationPending()).toBe(true);
    advanceNarration();
    expect(narrationPending()).toBe(false);
  });

  it('pages long enemy turns three lines at a time', () => {
    const b = { ...battle(), log: [] };
    syncNarration(b);
    syncNarration(withLog(b, entries(['one', 'two', 'three', 'four', 'five'])));
    expect(currentPage()?.map((l) => l.text)).toEqual(['one', 'two', 'three']);
    expect(advanceNarration()?.map((l) => l.text)).toEqual(['four', 'five']);
    expect(advanceNarration()).toBeNull();
  });

  it('only reports a page as new when the box was empty, so sound plays once', () => {
    const b = { ...battle(), log: [] };
    const log = entries(['one', 'two', 'three', 'four']);
    syncNarration(b);
    expect(syncNarration(withLog(b, log.slice(0, 1)))).not.toBeNull();
    expect(syncNarration(withLog(b, log))).toBeNull();
    expect(narrationPending()).toBe(true);
  });

  it('starts over for a new battle', () => {
    syncNarration(withLog({ ...battle(1), log: [] }, entries(['a', 'b'])));
    expect(narrationPending()).toBe(true);
    syncNarration({ ...battle(2, 'kell_2148_walls'), log: [] });
    expect(narrationPending()).toBe(false);
  });

  it('drops the undone turn on a Rewind but still narrates the Rewind itself', () => {
    const b = { ...battle(), log: [] };
    const opening = entries(['the enemy acts', 'and acts again']);
    syncNarration(b);
    syncNarration(withLog(b, opening));
    expect(narrationPending()).toBe(true);
    advanceNarration();
    expect(narrationPending()).toBe(false);
    // The Rewind keeps nothing of that turn and appends its own line.
    const rewound: BattleLogEntry[] = [{ turn: 1, text: 'Rewind: the turn is undone.', kind: 'tempo', ability: 'Rewind' }];
    const page = syncNarration(withLog(b, rewound));
    expect(page?.map((l) => l.text)).toEqual(['Rewind: the turn is undone.']);
  });

  it('never re-narrates a line the Rewind left in place', () => {
    const b = { ...battle(), log: [] };
    const kept = entries(['flavor line']);
    syncNarration(withLog(b, kept));
    advanceNarration();
    const after: BattleLogEntry[] = [...kept, { turn: 1, text: 'Rewind: the turn is undone.', kind: 'tempo' }];
    const page = syncNarration(withLog(b, after));
    expect(page?.map((l) => l.text)).toEqual(['Rewind: the turn is undone.']);
  });

  it('names actor, ability and target on every damage line the engine writes', () => {
    let s = reduce(newGame(3), { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    while (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    const hits = s.battle!.log.filter((l) => l.kind === 'hit');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.actor, h.text).toBeTruthy();
      expect(h.target, h.text).toBeTruthy();
      expect(h.ability, h.text).toBeTruthy();
      expect(h.text).toContain(h.ability!);
      expect(h.text).toContain(h.target!);
    }
    void content;
  });
});
