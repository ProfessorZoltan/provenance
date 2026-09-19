import { describe, expect, it } from 'vitest';
import { activeChoices, applyChoice, deriveWorld, endingFor } from '../src/core/timeline';
import { activeVariant } from '../src/core/reducer';
import { conditionContext } from '../src/core/encounter';
import { evalAll } from '../src/core/conditions';
import { content, newGame, reduce, run, skipDialogue } from './helpers';

describe('timeline', () => {
  it('derives Ownership, Sync and flags from history, never storing them', () => {
    const s = newGame();
    const w1 = applyChoice(content, s.world, 'arm_resistance', 1);
    const d1 = deriveWorld(content, w1, s.party);
    expect(d1.ownership).toBe(s.world.baseOwnership + 10);
    expect(d1.sync).toBe(s.world.baseSync - 20);
    expect(d1.flags).toContain('armedResistance');
    expect(d1.flags).toContain('tomasHaleAvailable');
  });

  it('lets the last visit to an era overwrite earlier choices there', () => {
    const s = newGame();
    let w = applyChoice(content, s.world, 'arm_resistance', 1);
    w = applyChoice(content, w, 'let_it_fall', 2);
    expect(activeChoices(w.history).map((h) => h.choiceId)).toEqual(['let_it_fall']);
    const d = deriveWorld(content, w, s.party);
    expect(d.flags).toContain('letItFall');
    expect(d.flags).not.toContain('armedResistance');
    expect(d.ownership).toBe(s.world.baseOwnership);
  });

  it('keeps only the last three timeline snapshots', () => {
    const s = newGame();
    let w = s.world;
    for (let i = 0; i < 5; i++) w = applyChoice(content, w, i % 2 ? 'arm_resistance' : 'let_it_fall', i);
    expect(w.snapshots).toHaveLength(3);
    expect(w.history).toHaveLength(5);
    expect(w.snapshots[2].history).toHaveLength(5);
  });

  it('drops Continuity by 15 per edit to a character\'s home era, floored at 10', () => {
    const s = newGame();
    let w = s.world;
    for (let i = 0; i < 8; i++) w = applyChoice(content, w, 'arm_resistance', i);
    const d = deriveWorld(content, w, s.party);
    expect(d.continuity.dax).toBe(10);
    expect(d.continuity.wren).toBe(100);
    const one = deriveWorld(content, applyChoice(content, s.world, 'arm_resistance', 0), s.party);
    expect(one.continuity.dax).toBe(85);
  });

  it('maps world variables to endings', () => {
    expect(endingFor(60, 0, [])).toBe('The Commons');
    expect(endingFor(20, 70, [])).toBe('The Gift');
    expect(endingFor(0, -70, [])).toBe('The Silence');
    expect(endingFor(0, 0, [])).toBe('Perpetuity');
    expect(endingFor(60, 0, ['youngStrandInParty'])).toBe('Reconciled');
  });

  it('changes Kell Village on return after the 2148 choice', () => {
    let s = skipDialogue(newGame(9));
    expect(s.screen.id).toBe('hub');
    const village = content.locations.kell_village_2312;
    expect(activeVariant(content, s, village)).toBeNull();
    s = reduce(s, { type: 'TIME_JUMP', era: '2148' });
    expect(s.location).toBe('kell_2148');
    expect(s.screen.id).toBe('dialogue');
    s = skipDialogue(s, 0); // Arm the resistance
    expect(s.world.history.map((h) => h.choiceId)).toEqual(['arm_resistance']);
    expect(s.screen.id).toBe('battle');
    expect(s.battle?.surprise).toBe(true);
    s = run(s, { type: 'TIME_JUMP', era: '2312' });
    expect(s.location).toBe('kell_2312');
    s = reduce(s, { type: 'TRAVEL', location: 'kell_village_2312' });
    expect(s.screen.id).toBe('dialogue');
    expect(s.dialogue?.id).toBe('village_armed');
    s = skipDialogue(s);
    const v = activeVariant(content, s, village);
    expect(v?.shop).toBe('kell_armory');
    expect(v?.npcs).toContain('militia_captain');
  });

  it('shows the quiet, watched village when the stronghold is left to fall', () => {
    let s = skipDialogue(newGame(9));
    s = reduce(s, { type: 'TIME_JUMP', era: '2148' });
    s = skipDialogue(s, 1); // Let it fall
    expect(s.world.history.map((h) => h.choiceId)).toEqual(['let_it_fall']);
    s = run(s, { type: 'TIME_JUMP', era: '2312' }, { type: 'TRAVEL', location: 'kell_village_2312' });
    expect(s.dialogue?.id).toBe('village_fall');
    s = skipDialogue(s);
    expect(activeVariant(content, s, content.locations.kell_village_2312)?.shop).toBe('kell_commissary_thin');
  });
});

describe('Port Halden and the Handover', () => {
  it('keeps the two Deep Sites independent: a Halden edit never touches Kell', () => {
    const s = newGame();
    let w = applyChoice(content, s.world, 'arm_resistance', 1); // Kell, 2148
    w = applyChoice(content, w, 'amend_treaty', 2); // Halden, 2064 — earlier era, other site
    expect(activeChoices(w.history).map((h) => h.choiceId).sort()).toEqual(['amend_treaty', 'arm_resistance']);
    const d = deriveWorld(content, w, s.party);
    expect(d.flags).toContain('armedResistance');
    expect(d.flags).toContain('treatyAmended');
  });

  it('lets a 2031 Halden edit overwrite a 2064 one at the same site', () => {
    const s = newGame();
    let w = applyChoice(content, s.world, 'amend_treaty', 1);
    w = applyChoice(content, w, 'expose_buyers', 2);
    // Both are 2064 Halden, so the later one stands alone.
    expect(activeChoices(w.history).map((h) => h.choiceId)).toEqual(['expose_buyers']);
    expect(deriveWorld(content, w, s.party).flags).not.toContain('treatyAmended');
  });

  it('moves Ownership and Sync the way the three Handover options say they do', () => {
    const s = newGame();
    const base = deriveWorld(content, s.world, s.party);
    const after = (id: string) => deriveWorld(content, applyChoice(content, s.world, id, 1), s.party);
    expect(after('amend_treaty').ownership - base.ownership).toBe(30);
    expect(after('amend_treaty').sync - base.sync).toBe(10);
    expect(after('sabotage_vote').ownership - base.ownership).toBe(-10);
    expect(after('sabotage_vote').sync - base.sync).toBe(-30);
    expect(after('expose_buyers').ownership - base.ownership).toBe(40);
    expect(after('expose_buyers').flags).toContain('boardAlerted');
  });

  it('opens the commissary shelves as Ownership rises and thins them as it falls', () => {
    const s = newGame();
    const stocked = (ownership: number) => {
      const w = { ...s.world, baseOwnership: ownership };
      const cctx = conditionContext(content, { ...s, world: w });
      return content.shops.enclave7_commissary.stock.filter((st) => evalAll(st.when, cctx)).length;
    };
    expect(stocked(60)).toBeGreaterThan(stocked(0));
    expect(stocked(0)).toBeGreaterThan(stocked(-60));
    // Rations are allocated no matter what the ledger says.
    expect(stocked(-100)).toBeGreaterThanOrEqual(1);
  });
});
