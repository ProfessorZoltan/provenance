import { describe, expect, it } from 'vitest';
import { learn, logSuperseded, mapFor } from '../src/core/reducer';
import { evalAll } from '../src/core/conditions';
import { conditionContext } from '../src/core/encounter';
import { applyChoice } from '../src/core/timeline';
import { autoBattle, content, newGame, newRun, opening, reduce, run, skipDialogue } from './helpers';
import type { GameState } from '../src/types/state';

/** Walk the whole terminal chain: reconcile, trace, history, charter. */
function workTheLedger(s: GameState): GameState {
  for (let i = 0; i < 6 && !s.flags.includes('fileFlagged'); i++) {
    s = reduce(s, { type: 'START_DIALOGUE', id: 'terminal', returnTo: { id: 'room', room: 'allocation_office' } });
    s = skipDialogue(s, 0);
  }
  return s;
}

describe('the opening', () => {
  it('shows what the Enclave is like before it asks anyone to doubt it', () => {
    const s = opening(77);
    expect(s.screen).toEqual({ id: 'intro', slide: 0 });
    expect(content.intro.opening.slides.length, 'more than one frame, or it is a splash').toBeGreaterThan(2);
  });

  it('walks the frames one at a time and hands over to the office', () => {
    let s = opening(77);
    const slides = content.intro.opening.slides.length;
    for (let i = 1; i < slides; i++) {
      s = reduce(s, { type: 'INTRO_ADVANCE' });
      expect(s.screen).toEqual({ id: 'intro', slide: i });
    }
    s = reduce(s, { type: 'INTRO_ADVANCE' });
    expect(s.screen.id, 'the last frame opens the prologue').toBe('dialogue');
    expect(s.dialogue?.id).toBe('prologue_open');
  });

  it('can be skipped outright, landing in the same place', () => {
    const skipped = reduce(opening(77), { type: 'INTRO_SKIP' });
    expect(skipped.screen.id).toBe('dialogue');
    expect(skipped.dialogue?.id).toBe('prologue_open');
    expect(skipped.location).toBe('allocation_office_2312');
  });

  it('shows the Enclave working before it shows what that costs', () => {
    const [good, ...rest] = content.intro.opening.slides;
    const all = content.intro.opening.slides.map((x) => x.lines.join(' ')).join(' ');
    expect(good.lines.join(' ')).toMatch(/not one of them has ever missed a meal/);
    expect(rest.length).toBeGreaterThan(2);
    expect(all, 'and it ends on the query the game is about').toMatch(/without a single query/i);
  });
});

describe('the prologue', () => {
  it('starts alone in the Allocation Office with the quarter open', () => {
    const s = newRun(77);
    expect(s.screen.id).toBe('dialogue');
    expect(s.dialogue?.id).toBe('prologue_open');
    expect(Object.keys(s.party)).toEqual(['player']);
    expect(s.flags).toContain('prologue');
    expect(s.location).toBe('allocation_office_2312');
    const after = skipDialogue(s);
    expect(after.screen).toEqual({ id: 'room', room: 'allocation_office' });
  });

  it('finds the budget line one query at a time, and the last query flags the file', () => {
    let s = skipDialogue(newRun(77));
    s = reduce(s, { type: 'START_DIALOGUE', id: 'terminal', returnTo: { id: 'room', room: 'allocation_office' } });
    s = skipDialogue(s, 0);
    expect(s.flags).toContain('foundDiscrepancy');
    expect(s.flags).not.toContain('foundHoldings');

    s = workTheLedger(s);
    for (const f of ['foundHoldings', 'foundTheLine', 'readCharter', 'fileFlagged']) expect(s.flags, f).toContain(f);
  });

  it('will not let the Auditor walk out on an open quarter, and opens the door once flagged', () => {
    let s = skipDialogue(newRun(77));
    s = reduce(s, { type: 'START_DIALOGUE', id: 'prologue_door', returnTo: { id: 'room', room: 'allocation_office' } });
    const early = content.dialogues.prologue_door.lines[s.dialogue!.index];
    expect(early.choices, 'no way out yet').toBeUndefined();
    s = skipDialogue(s);

    s = workTheLedger(s);
    s = reduce(s, { type: 'START_DIALOGUE', id: 'prologue_door', returnTo: { id: 'room', room: 'allocation_office' } });
    expect(content.dialogues.prologue_door.lines[s.dialogue!.index].choices).toBeDefined();
    s = skipDialogue(s, 0);
    expect(s.flags).toContain('fleeing');
    expect(s.location).toBe('allocation_office_2312');
  });

  it('runs the valley road, meets Wren at the door and hands off to the game proper', () => {
    let s = workTheLedger(skipDialogue(newRun(77)));
    s = reduce(s, { type: 'START_DIALOGUE', id: 'prologue_door', returnTo: { id: 'room', room: 'allocation_office' } });
    s = skipDialogue(s, 0);

    // The interception only exists while the Auditor is being chased.
    const gated = content.maps.map_2312.nodes.find((n) => n.id === 'valley_road')!;
    expect(gated.requires).toEqual(['flag:fleeing']);
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'office_2312_stairwell', from: 'map' });
    expect(s.battle!.combatants.filter((c) => c.side === 'party')).toHaveLength(1);
    s = autoBattle(s);
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'map' } });

    s = reduce(s, { type: 'TRAVEL', location: 'kell_2312' });
    expect(s.dialogue?.id, 'Wren is in the doorway').toBe('kell_arrive_2312');
    s = skipDialogue(s);
    expect(Object.keys(s.party).sort()).toEqual(['dax', 'player', 'wren']);
    expect(s.flags).toContain('metParty');
    expect(s.flags).not.toContain('fleeing');
    expect(s.flags).not.toContain('prologue');
    expect(s.location).toBe('kell_2312');
  });

  it('can be skipped on a replay, landing exactly where the old opening did', () => {
    const s = skipDialogue(newGame(77));
    expect(s.location).toBe('kell_2312');
    expect(Object.keys(s.party).sort()).toEqual(['dax', 'player', 'wren']);
    expect(s.flags).toContain('metParty');
    expect(s.screen.id).toBe('hub');
    // Skipping twice is a no-op rather than a second recruitment.
    expect(reduce(s, { type: 'PROLOGUE_SKIP' })).toEqual(s);
  });
});

describe('the case log', () => {
  it('starts empty and fills itself as the Auditor learns things', () => {
    const fresh = newRun(5);
    expect(fresh.log).toEqual([]);
    let s = skipDialogue(fresh);
    s = reduce(s, { type: 'START_DIALOGUE', id: 'terminal', returnTo: { id: 'room', room: 'allocation_office' } });
    s = skipDialogue(s, 0);
    expect(s.log).toContain('the_quarter');
    expect(content.log.the_quarter.source).toBe('Allocation Office terminal, 2312');
  });

  it('keeps what it learned even after the century it came from is rewritten', () => {
    let s = skipDialogue(newGame(5));
    s = { ...s, world: applyChoice(content, s.world, 'amend_treaty', 1) };
    s = learn(content, s);
    expect(s.log).toContain('article_nine');
    expect(logSuperseded(content, s).has('article_nine')).toBe(false);

    // Sabotage the vote instead and the clause never happened -- but the note stays, struck through.
    s = { ...s, world: applyChoice(content, s.world, 'sabotage_vote', 2) };
    s = learn(content, s);
    expect(s.log, 'nothing is unlearned').toContain('article_nine');
    expect(logSuperseded(content, s).has('article_nine'), 'but it is no longer true').toBe(true);
  });

  it('counts unread entries and clears them when the log is opened', () => {
    let s = skipDialogue(newGame(5));
    expect(s.log.length).toBeGreaterThan(0);
    expect(s.log.length - s.logRead, 'everything is new at first').toBe(s.log.length);
    s = reduce(s, { type: 'SET_SCREEN', screen: { id: 'log' } });
    expect(s.logRead).toBe(s.log.length);
    expect(s.back.id, 'the log remembers where it was opened from').toBe('hub');
  });

  it('gives every entry a source of its own, apart from what it says', () => {
    for (const e of Object.values(content.log)) {
      expect(e.source, e.id).toBeTruthy();
      expect(e.detail.includes(e.source), `${e.id} repeats its source inside its detail`).toBe(false);
      expect(e.when.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe('dialogue actions that open another conversation', () => {
  it('does not let the conversation you left clobber the one an action opened', () => {
    let s = skipDialogue(newRun(31));
    for (let i = 0; i < 6 && !s.flags.includes('fileFlagged'); i++) {
      s = reduce(s, { type: 'START_DIALOGUE', id: 'terminal', returnTo: { id: 'room', room: 'allocation_office' } });
      s = skipDialogue(s, 0);
    }
    s = reduce(s, { type: 'START_DIALOGUE', id: 'prologue_door', returnTo: { id: 'room', room: 'allocation_office' } });
    s = reduce(s, { type: 'DIALOGUE_CHOOSE', index: 0 });
    // The flee action opens the flight scene; the door conversation must not overwrite it.
    expect(s.dialogue?.id).toBe('flight_open');
    expect(s.screen.id).toBe('dialogue');
    s = skipDialogue(s);
    expect(s.screen.id, 'and it lets out onto the map').toBe('map');
  });

  it('gives the lone Auditor a fight on the valley road she can actually win', () => {
    let s = skipDialogue(newRun(31));
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'office_2312_stairwell', from: 'map' });
    expect(s.battle!.combatants.filter((c) => c.side === 'party')).toHaveLength(1);
    for (const seed of [3, 11, 29, 74, 108]) {
      let run = reduce(newRun(seed), { type: 'START_ENCOUNTER', encounterId: 'office_2312_stairwell', from: 'map' });
      run = autoBattle(run);
      expect(run.battle?.phase, `seed ${seed}`).toBe('won');
    }
  });
});

describe('the road out of the office', () => {
  it('offers only Kell while the Auditor is still running', () => {
    // Reported from a real run: walking into Kell Village first, where everyone greets you as
    // someone who has come down from the monastery you have not been to yet.
    let s = reduce(newRun(77), { type: 'PROLOGUE_SKIP' });
    s = { ...s, flags: [...s.flags.filter((f) => f !== 'fleeing'), 'fleeing'] };
    const open = (st: GameState) => mapFor(content, st.era)!.nodes
      .filter((n) => evalAll(n.requires, conditionContext(content, st)))
      .map((n) => n.id);
    const fleeing = open(s);
    expect(fleeing, 'the monastery is the one place to go').toContain('kell_2312');
    for (const elsewhere of ['kell_village_2312', 'halden_2312', 'capitol_2312', 'meridian_2312', 'strand_memorial_2312']) {
      expect(fleeing, `${elsewhere} should wait`).not.toContain(elsewhere);
    }
    // Arriving at Kell clears the flight and the coast opens up.
    const arrived = { ...s, flags: s.flags.filter((f) => f !== 'fleeing') };
    expect(open(arrived)).toContain('kell_village_2312');
    expect(open(arrived).length).toBeGreaterThan(fleeing.length);
  });
});
