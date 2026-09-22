import { describe, expect, it } from 'vitest';
import { current, resolveAbility } from '../src/core/battle/battle';
import { maxHp, maxNerve, nerveCost, nerveOf } from '../src/core/stats';
import { deriveWorld } from '../src/core/timeline';
import type { Combatant, GameState } from '../src/types/state';
import { autoBattle, content, newGame, reduce, run } from './helpers';

const rules = content.rules;

function turnOf(s: GameState, who: string, encounterId = 'kell_2312_perimeter'): GameState {
  s = reduce(s, { type: 'START_ENCOUNTER', encounterId, surprise: false });
  let guard = 60;
  while (guard-- > 0 && current(s.battle!)?.id !== who) {
    if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
    s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
  }
  expect(current(s.battle!)?.id).toBe(who);
  return s;
}
const combatant = (s: GameState, id: string) => s.battle!.combatants.find((c) => c.id === id)!;
const patch = (s: GameState, id: string, fn: (c: Combatant) => Partial<Combatant>): GameState =>
  ({ ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)) } });

describe('Nerve', () => {
  it('prices abilities by their shape: damage is free, mending and laying things on people is not', () => {
    expect(nerveCost(content, content.abilities.strike)).toBe(0);
    expect(nerveCost(content, content.abilities.mend)).toBe(rules.nerve.costs.heal);
    expect(nerveCost(content, content.abilities.litany)).toBe(rules.nerve.costs.buff);
    expect(nerveCost(content, content.abilities.audit)).toBe(rules.nerve.costs.debuff);
    expect(nerveCost(content, content.abilities.guard)).toBe(rules.nerve.costs.buff);
    // Enemies pay nothing: their kits are not budgeted.
    const s = turnOf(newGame(3), 'player');
    expect(s.battle!.combatants.filter((c) => c.side === 'enemy').every((c) => c.maxNerve === 0)).toBe(true);
  });

  it('is spent in a fight, gates the ability when it runs out, and is carried out of the fight', () => {
    let s = turnOf(newGame(3), 'player');
    const foe = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    const before = combatant(s, 'player').nerve;
    expect(before).toBe(maxNerve(content, s.party.player));
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'audit', target: foe.id });
    expect(combatant(s, 'player').nerve).toBe(before - rules.nerve.costs.debuff);
    expect(s.battle!.log.some((l) => l.text.includes('spends 2 Nerve'))).toBe(true);
    s = patch(s, 'player', () => ({ nerve: 1, threads: 3 }));
    expect(() => reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'audit', target: foe.id })).toThrow(/Needs 2 Nerve/);
    s = autoBattle(s);
    const left = combatant(s, 'player').nerve;
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.party.player.nerve).toBe(left);
    expect(s.party.player.nerve).toBeLessThan(maxNerve(content, s.party.player));
  });

  it('comes back with a bed, a camp, or a tonic, and a save from before it carries a full pool', () => {
    let s = newGame(3);
    s = { ...s, party: { ...s.party, wren: { ...s.party.wren, nerve: 2 } }, inventory: { ...s.inventory, items: { tonic: 1 } } };
    const cap = maxNerve(content, s.party.wren);
    const camped = reduce({ ...s, location: 'cooling_perimeter_2312' }, { type: 'CAMP' });
    expect(camped.party.wren.nerve).toBe(Math.min(cap, 2 + Math.round(cap * rules.nerve.campShare)));
    const rested = reduce(s, { type: 'REST' });
    expect(rested.party.wren.nerve).toBe(cap);
    const dosed = reduce(s, { type: 'USE_ITEM', item: 'tonic', target: 'wren' });
    expect(dosed.party.wren.nerve).toBe(Math.min(cap, 2 + 6));
    const old = { ...s.party.wren };
    delete (old as { nerve?: number }).nerve;
    expect(nerveOf(content, old)).toBe(cap);
  });
});

describe('Entropy carried between fights', () => {
  it('comes into a fight where the last one left it, and leaves with you', () => {
    let s = { ...newGame(3), entropy: 33 };
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    expect(s.battle!.entropy).toBe(33);
    expect(s.battle!.log.some((l) => l.text.includes('Entropy comes in at 33'))).toBe(true);
    s = autoBattle(s);
    const out = s.battle!.entropy;
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.entropy).toBe(out);
    expect(out).toBeGreaterThan(33);
  });

  it('creeps every round, and jumps when the enemy pulls on time', () => {
    let s = reduce(newGame(3), { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    const start = s.battle!.entropy;
    let guard = 40;
    while (guard-- > 0 && s.battle!.round < 3) {
      if (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
      else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    expect(s.battle!.entropy).toBe(start + 2 * rules.entropyFlow.perRound);
    // A Chronal move with no pull of its own still frays time when an enemy makes it.
    const b = s.battle!;
    const foe = b.combatants.find((c) => c.side === 'enemy')!;
    const chronal = { ...content.abilities.echo_mimic, id: 'test_chronal', damageType: 'chronal' as const, entropyDelta: 0 };
    const patched = { ...content, abilities: { ...content.abilities, test_chronal: chronal } };
    const armed = { ...b, phase: 'enemy' as const, turnIndex: b.order.indexOf(foe.id), combatants: b.combatants.map((c) => (c.id === foe.id ? { ...c, threads: 5, abilities: [chronal.id] } : c)) };
    const after = resolveAbility(armed, foe.id, chronal.id, 'player', patched);
    expect(after.entropy).toBe(b.entropy + rules.entropyFlow.enemyChronal);
    // One with a pull of its own is not counted twice.
    const own = resolveAbility({ ...armed, combatants: armed.combatants.map((c) => (c.id === foe.id ? { ...c, abilities: ['echo_fracture'] } : c)) }, foe.id, 'echo_fracture', 'player', content);
    expect(own.entropy).toBe(b.entropy + Math.round(content.abilities.echo_fracture.entropyDelta * rules.damageScale));
  });

  it('lets out with a bed and a camp, and nothing else', () => {
    const s = { ...newGame(3), entropy: 80 };
    expect(reduce(s, { type: 'REST' }).entropy).toBe(80 - rules.entropyFlow.restDecay);
    expect(reduce({ ...s, location: 'cooling_perimeter_2312' }, { type: 'CAMP' }).entropy).toBe(80 - rules.entropyFlow.campDecay);
    expect(run(s, { type: 'TRAVEL', location: 'kell_village_2312' }).entropy).toBe(80);
  });

  it('fraying: Chronal cuts deeper for both sides and Tempo comes twice as fast', () => {
    const fray = rules.entropyTiers.fray;
    let s = turnOf(newGame(3), 'player');
    const foe = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    const quiet = patch(s, 'player', () => ({ threads: 3, abilities: ['discrepancy'], nerve: 30 }));
    const frayed = { ...quiet, battle: { ...quiet.battle!, entropy: fray.at } };
    const dmg = (st: GameState) => {
      const after = resolveAbility(st.battle!, 'player', 'discrepancy', foe.id, content);
      return foe.hp - after.combatants.find((c) => c.id === foe.id)!.hp;
    };
    const plain = dmg(quiet);
    const hot = dmg(frayed);
    expect(hot).toBeGreaterThan(plain);
    expect(hot).toBeLessThanOrEqual(Math.ceil(plain * (1 + fray.chronalBonus)) + 2);
    // Marking pays double past the line.
    s = { ...s, battle: { ...s.battle!, entropy: fray.at, tempo: 0 } };
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'audit', target: foe.id });
    expect(s.battle!.tempo).toBe(rules.tempoOnMark * fray.tempoMultiplier);
  });

  it('slipping: a turn can belong to another version of you, who swings at anyone', () => {
    let seen = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = reduce({ ...newGame(seed), entropy: rules.entropyTiers.slip.at }, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_enforcers', surprise: false });
      // Hold Entropy at the line by ignoring the creep: what we want is the slip roll itself.
      let guard = 30;
      while (guard-- > 0 && s.battle && s.battle.phase !== 'won' && s.battle.phase !== 'lost') {
        if (s.battle.log.some((l) => l.text.includes('slips.'))) { seen = true; break; }
        if (s.battle.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
        else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle)!.id });
      }
      if (seen) {
        const line = s.battle!.log.findIndex((l) => l.text.includes('slips.'));
        const next = s.battle!.log[line + 1];
        expect(next?.kind, 'the slipped swing is a hit on someone').toBe('hit');
        break;
      }
    }
    expect(seen, 'over eight seeds at the slipping line, someone slips').toBe(true);
  });

  it('breaking: at the ceiling a piece of someone’s Continuity goes for good, and the gauge falls back', () => {
    let s = turnOf(newGame(3), 'player');
    const foe = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    s = { ...s, battle: { ...s.battle!, entropy: rules.entropyTiers.break.at } };
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'strike', target: foe.id });
    const b = s.battle!;
    expect(b.fractures).toHaveLength(1);
    expect(b.entropy).toBe(rules.entropyFlow.afterBreak);
    expect(b.log.some((l) => l.text.includes('Entropy breaks over'))).toBe(true);
    const who = b.fractures[0];
    expect(combatant(s, who).continuity).toBe(100 - rules.entropyTiers.break.continuityLoss);
    s = autoBattle(s);
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.party[who].frayed).toBe(rules.entropyTiers.break.continuityLoss);
    expect(deriveWorld(content, s.world, s.party).continuity[who]).toBe(100 - rules.entropyTiers.break.continuityLoss);
    expect(s.journal.at(-1)).toMatch(/Entropy broke over/);
  });
});

describe('Continuity on the field', () => {
  function thinned(id: string, continuity: number): GameState {
    const s = newGame(3);
    return { ...s, party: { ...s.party, [id]: { ...s.party[id], frayed: 100 - continuity } } };
  }

  it('sets the Resolve ceiling: less of your own timeline, less to stand on', () => {
    const full = reduce(newGame(3), { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    const thin = reduce(thinned('dax', 40), { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    const a = combatant(full, 'dax'), b = combatant(thin, 'dax');
    expect(b.continuity).toBe(40);
    const floor = rules.continuityCombat.resolveFloor;
    expect(b.maxHp).toBe(Math.round(a.maxHp * (floor + (1 - floor) * 0.4)));
    expect(b.hp).toBeLessThanOrEqual(b.maxHp);
    // The bed still fills the character sheet's ceiling; the fight takes what Continuity leaves.
    expect(maxHp(content, content.characters.dax, thin.party.dax)).toBe(a.maxHp);
  });

  it('flickers below the line: some turns go by without them', () => {
    let flickered = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = reduce({ ...thinned('dax', rules.continuityFloor), seed }, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_enforcers', surprise: false });
      s = { ...s, battle: { ...s.battle!, rng: seed * 7919 } };
      let guard = 40;
      while (guard-- > 0 && s.battle && s.battle.phase !== 'won' && s.battle.phase !== 'lost') {
        if (s.battle.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
        else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle)!.id });
      }
      flickered += s.battle!.log.filter((l) => l.text.includes('Dax flickers')).length;
    }
    expect(flickered).toBeGreaterThan(0);
    const steady = reduce(thinned('dax', 80), { type: 'START_ENCOUNTER', encounterId: 'kell_2312_enforcers', surprise: false });
    expect(steady.battle!.log.some((l) => l.text.includes('flickers'))).toBe(false);
  });

  it('cuts deeper with Chronal the thinner it is', () => {
    const cut = (continuity: number) => {
      let s = turnOf(thinned('player', continuity), 'player');
      const foe = s.battle!.combatants.find((c) => c.side === 'enemy')!;
      s = patch(s, 'player', () => ({ threads: 3, abilities: ['discrepancy'], nerve: 30 }));
      const after = resolveAbility(s.battle!, 'player', 'discrepancy', foe.id, content);
      return foe.hp - after.combatants.find((c) => c.id === foe.id)!.hp;
    };
    expect(cut(20)).toBeGreaterThan(cut(100));
  });
});
