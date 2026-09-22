import { describe, expect, it } from 'vitest';
import { current, itemNeedsTarget } from '../src/core/battle/battle';
import { maxHp } from '../src/core/stats';
import { STATUS_INFO } from '../src/core/battle/statuses';
import type { GameState } from '../src/types/state';
import { autoBattle, content, newGame, reduce, run } from './helpers';

const rules = content.rules;

/** A fight at Kell's perimeter, stepped forward until `who` is the one acting. */
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

const combatant = (s: GameState, id: string) => s.battle!.combatants.find((c) => c.id === id);

describe('three on the field', () => {
  it('caps the active party at three', () => {
    expect(rules.activePartyMax).toBe(3);
    const s = newGame(5);
    expect(s.activeParty).toEqual(['player', 'wren', 'dax']);
    const four = reduce(s, { type: 'RECRUIT', character: 'ilo9' });
    expect(() => reduce(four, { type: 'SET_ACTIVE_PARTY', members: ['player', 'wren', 'dax', 'ilo9'] })).toThrow(/At most 3/);
  });

  it('fields a recruit by standing the newest member down, never the Auditor', () => {
    const s = reduce(newGame(5), { type: 'RECRUIT', character: 'ilo9' });
    expect(s.activeParty).toEqual(['player', 'wren', 'ilo9']);
    expect(s.journal.at(-1)).toMatch(/Dax steps back to the bench/);
  });

  it('trims a four-strong save down to three when it loads, keeping the Auditor', () => {
    const old = { ...newGame(5), activeParty: ['wren', 'dax', 'ilo9', 'player'] };
    old.party = { ...old.party, ilo9: { ...old.party.wren, id: 'ilo9' } };
    const s = reduce(newGame(5), { type: 'LOAD_STATE', state: old });
    expect(s.activeParty).toHaveLength(3);
    expect(s.activeParty[0]).toBe('player');
    expect(s.camps).toBe(rules.camp.perEra);
  });
});

describe('Relay', () => {
  function benchedDax(seed = 7): GameState {
    // Recruiting ILO-9 fields it and benches Dax, who is then the one waiting to be relayed in.
    let s = reduce(newGame(seed), { type: 'RECRUIT', character: 'ilo9' });
    s = { ...s, party: { ...s.party, dax: { ...s.party.dax, hp: 33 } } };
    return s;
  }

  it('swaps a benched member in for a thread, and they finish the turn', () => {
    let s = turnOf(benchedDax(), 'wren');
    const wren = combatant(s, 'wren')!;
    const idx = s.battle!.order.indexOf('wren');
    s = reduce(s, { type: 'BATTLE_RELAY', actor: 'wren', incoming: 'dax' });
    const b = s.battle!;
    expect(current(b)?.id).toBe('dax');
    expect(b.order[idx]).toBe('dax');
    expect(combatant(s, 'wren')).toBeUndefined();
    expect(combatant(s, 'dax')!.threads).toBe(wren.threads - rules.relay.threadCost);
    expect(combatant(s, 'dax')!.hp, 'arrives with the Resolve they had on the bench').toBe(33);
    expect(b.reserve.map((c) => c.id)).toEqual(['wren']);
    expect(b.reserve[0].hp).toBe(wren.hp);
    expect(b.log.at(-1)?.text).toMatch(/Wren falls back and Dax takes the field/);
    expect(b.phase).toBe('player');
  });

  it('never relays the Auditor out, and never someone already standing', () => {
    const s = turnOf(benchedDax(), 'player');
    expect(() => reduce(s, { type: 'BATTLE_RELAY', actor: 'player', incoming: 'dax' })).toThrow(/Auditor/);
    const w = turnOf(benchedDax(), 'wren');
    expect(() => reduce(w, { type: 'BATTLE_RELAY', actor: 'wren', incoming: 'ilo9' })).toThrow(/already on the field/);
    expect(() => reduce(w, { type: 'BATTLE_RELAY', actor: 'wren', incoming: 'hale' })).toThrow(/Nobody/);
  });

  it('brings someone who fell back earlier back at the Resolve they left with', () => {
    let s = turnOf(benchedDax(), 'wren');
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === 'wren' ? { ...c, hp: 21, threads: 3 } : c)) } };
    s = reduce(s, { type: 'BATTLE_RELAY', actor: 'wren', incoming: 'dax' });
    s = reduce(s, { type: 'BATTLE_RELAY', actor: 'dax', incoming: 'wren' });
    expect(current(s.battle!)?.id).toBe('wren');
    expect(combatant(s, 'wren')!.hp).toBe(21);
    expect(combatant(s, 'wren')!.threads).toBe(1);
    expect(s.battle!.reserve.map((c) => c.id)).toEqual(['dax']);
  });

  it('keeps the reserve through a Rewind', () => {
    let s = turnOf(benchedDax(), 'wren');
    s = reduce(s, { type: 'BATTLE_RELAY', actor: 'wren', incoming: 'dax' });
    // Play on until the enemy has taken a turn since the Relay, then undo that turn.
    let acted = false;
    let guard = 40;
    while (guard-- > 0 && !(acted && s.battle!.phase === 'player')) {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); acted = true; }
      else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    expect(s.battle!.rewindPoint?.reserve?.map((c) => c.id)).toEqual(['wren']);
    s = { ...s, battle: { ...s.battle!, tempo: 20 } };
    s = reduce(s, { type: 'BATTLE_REWIND' });
    expect(s.battle!.reserve.map((c) => c.id)).toEqual(['wren']);
  });

  it('pays everyone who stood on the field the full share, and keeps the Resolve they left with', () => {
    let s = turnOf(benchedDax(), 'wren');
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === 'wren' ? { ...c, hp: 21 } : c)) } };
    s = reduce(s, { type: 'BATTLE_RELAY', actor: 'wren', incoming: 'dax' });
    s = autoBattle(s);
    expect(s.battle!.phase).toBe('won');
    const xpBefore = { ...Object.fromEntries(Object.entries(s.party).map(([id, c]) => [id, c.xp])) };
    const capBefore = maxHp(content, content.characters.wren, s.party.wren);
    s = reduce(s, { type: 'BATTLE_FINISH' });
    const gain = (id: string) => s.party[id].xp - xpBefore[id];
    expect(gain('wren')).toBe(gain('player'));
    expect(gain('dax')).toBe(gain('player'));
    // A level gained on the way raises the ceiling and heals by exactly that much, as it always has.
    expect(s.party.wren.hp).toBe(21 + (maxHp(content, content.characters.wren, s.party.wren) - capBefore));
  });
});

describe('Tempo is earned under pressure', () => {
  it('no longer pays for spending threads', () => {
    expect(rules.tempoPerThread).toBe(0);
    let s = turnOf(newGame(9), 'player', 'kell_2312_enforcers');
    // A Warden has no weakness to read, so a plain Strike on it earns nothing.
    const warden = s.battle!.combatants.find((c) => c.side === 'enemy' && c.ref === 'warden_2312')!;
    expect(warden.weakness).toBeUndefined();
    const before = s.battle!.tempo;
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'strike', target: warden.id });
    expect(s.battle!.tempo).toBe(before);
  });

  it('pays for reading the type chart', () => {
    // Dax's Wreck is kinetic; the sentry drones at the perimeter are weak to thermal, so use a
    // fixture with a known weakness instead: give the Auditor a thermal ability for the test.
    let s = turnOf(newGame(9), 'player');
    const drone = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    expect(drone.weakness).toBe('thermal');
    const thermal = Object.values(content.abilities).find((a) => a.damageType === 'thermal' && a.target === 'enemy' && a.cost <= 3)!;
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === 'player' ? { ...c, abilities: [...c.abilities, thermal.id] } : c)) } };
    const before = s.battle!.tempo;
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: thermal.id, target: drone.id });
    const hit = s.battle!.log.some((l) => l.text.includes('weakness'));
    expect(s.battle!.tempo - before).toBe(hit ? rules.tempoOnWeakness : 0);
  });

  it('pays for every Mark laid, and for every hit the party takes', () => {
    let s = turnOf(newGame(9), 'player');
    const drone = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    const before = s.battle!.tempo;
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'audit', target: drone.id });
    expect(s.battle!.tempo - before).toBe(rules.tempoOnMark);

    s = { ...s, battle: { ...s.battle!, tempo: 0 } };
    s = reduce(s, { type: 'BATTLE_END_TURN', actor: 'player' });
    let guard = 20;
    while (guard-- > 0 && s.battle!.phase !== 'enemy') s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    const logBefore = s.battle!.log.length;
    s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    const hits = s.battle!.log.slice(logBefore).filter((l) => l.text.includes(`+${rules.tempoOnHit} Tempo`)).length;
    expect(s.battle!.tempo).toBe(Math.min(rules.tempoMax, hits * rules.tempoOnHit));
  });

  it('hands out one Rewind every fight, whoever is standing', () => {
    let s = newGame(9);
    s = { ...s, activeParty: ['player'] };
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    expect(s.battle!.rewindsLeft).toBe(rules.rewind.base);
  });
});

describe('rest costs something', () => {
  const cur = 'allocation points';
  function tired(seed = 4): GameState {
    const s = newGame(seed);
    const party = { ...s.party };
    for (const id of s.activeParty) party[id] = { ...party[id], hp: 10 };
    return { ...s, party };
  }

  it('charges for a bed at a Deep Site, by the level of the strongest member', () => {
    let s = tired();
    const level = Math.max(...s.activeParty.map((id) => s.party[id].level));
    const cost = rules.rest.perLevel * level;
    const purse = s.inventory.currency[cur];
    s = reduce(s, { type: 'REST' });
    expect(s.inventory.currency[cur]).toBe(purse - cost);
    for (const id of s.activeParty) expect(s.party[id].hp).toBe(maxHp(content, content.characters[id], s.party[id]));
    const broke = { ...tired(), inventory: { ...tired().inventory, currency: { ...tired().inventory.currency, [cur]: 0 } } };
    expect(() => reduce(broke, { type: 'REST' })).toThrow(/costs/);
  });

  it('offers no bed in the field, only a camp, and only so many an era', () => {
    let s = run(tired(), { type: 'TRAVEL', location: 'cooling_perimeter_2312' });
    s = { ...s, dialogue: null, screen: { id: 'hub' } };
    expect(() => reduce(s, { type: 'REST' })).toThrow(/Nowhere to rest/);
    expect(s.camps).toBe(rules.camp.perEra);
    s = reduce(s, { type: 'CAMP' });
    for (const id of s.activeParty) {
      const cap = maxHp(content, content.characters[id], s.party[id]);
      expect(s.party[id].hp).toBe(Math.min(cap, 10 + Math.round(cap * rules.camp.heal)));
    }
    s = reduce(s, { type: 'CAMP' });
    expect(s.camps).toBe(0);
    expect(() => reduce(s, { type: 'CAMP' })).toThrow(/No camps left/);
  });

  it('lets a village with beds sell a rest, and refills camps when the party jumps', () => {
    let s = run(tired(), { type: 'TRAVEL', location: 'kell_village_2312' });
    s = { ...s, dialogue: null, screen: { id: 'hub' } };
    expect(content.locations.kell_village_2312.lodging).toBe(true);
    s = reduce(s, { type: 'REST' });
    expect(s.party.player.hp).toBe(maxHp(content, content.characters.player, s.party.player));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' });
    s = { ...s, dialogue: null, screen: { id: 'hub' }, camps: 0 };
    s = reduce(s, { type: 'TIME_JUMP', era: '2148' });
    expect(s.camps).toBe(rules.camp.perEra);
  });
});

describe('items are free, once a turn, and do what nothing else can', () => {
  function stocked(seed = 3): GameState {
    const s = newGame(seed);
    return { ...s, inventory: { ...s.inventory, items: { ration: 2, splice: 1, steady: 1, dampener: 1, faraday_foil: 1 } } };
  }

  it('costs no thread, but only one a turn', () => {
    let s = turnOf(stocked(), 'player');
    const threads = combatant(s, 'player')!.threads;
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === 'player' ? { ...c, hp: c.maxHp - 30 } : c)) } };
    s = reduce(s, { type: 'BATTLE_ITEM', actor: 'player', item: 'ration', target: 'player' });
    expect(combatant(s, 'player')!.threads).toBe(threads);
    expect(combatant(s, 'player')!.itemUsed).toBe(true);
    expect(s.inventory.items.ration).toBe(1);
    expect(() => reduce(s, { type: 'BATTLE_ITEM', actor: 'player', item: 'ration', target: 'player' })).toThrow(/One item a turn/);
    // Next turn, the Auditor may use another.
    s = reduce(s, { type: 'BATTLE_END_TURN', actor: 'player' });
    let guard = 40;
    while (guard-- > 0 && current(s.battle!)?.id !== 'player') {
      if (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
      else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    expect(combatant(s, 'player')!.itemUsed).toBe(false);
  });

  it('is the only cure for Fear, Target Lock and Bound by terms', () => {
    const cures = new Set(Object.values(content.items).flatMap((i) => i.effect?.cure ?? []));
    for (const [id, info] of Object.entries(STATUS_INFO)) {
      // Marked is laid on enemies, and 'spent' is the hand you lent to a pair tech: neither is a wound to cure.
      if (info.polarity === 'bad' && id !== 'marked' && id !== 'spent') expect(cures.has(id), `${id} needs an item that clears it`).toBe(true);
    }
    // Nothing in the ability set clears a status.
    const clearing = Object.values(content.abilities).filter((a) => JSON.stringify(a).includes('"cure"'));
    expect(clearing).toEqual([]);
  });

  it('clears a status, and refuses when there is nothing to clear', () => {
    let s = turnOf(stocked(), 'player');
    expect(() => reduce(s, { type: 'BATTLE_ITEM', actor: 'player', item: 'splice', target: 'wren' })).toThrow(/nothing Splice would clear/);
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === 'wren' ? { ...c, statuses: [{ id: 'locked', turns: 3 }, { id: 'fear', turns: 2 }] } : c)) } };
    s = reduce(s, { type: 'BATTLE_ITEM', actor: 'player', item: 'splice', target: 'wren' });
    expect(combatant(s, 'wren')!.statuses.map((st) => st.id)).toEqual(['fear']);
    expect(s.battle!.log.at(-1)?.text).toMatch(/Target Lock cleared/);
  });

  it('lowers Entropy with a Dampener and shields the whole party with Foil, with nobody to pick', () => {
    let s = turnOf(stocked(), 'player');
    expect(itemNeedsTarget(content.items.dampener)).toBe(false);
    expect(itemNeedsTarget(content.items.faraday_foil)).toBe(false);
    expect(itemNeedsTarget(content.items.ration)).toBe(true);
    s = { ...s, battle: { ...s.battle!, entropy: 30 } };
    s = reduce(s, { type: 'BATTLE_ITEM', actor: 'player', item: 'dampener', target: 'player' });
    expect(s.battle!.entropy).toBe(10);
    s = reduce(s, { type: 'BATTLE_END_TURN', actor: 'player' });
    let guard = 40;
    while (guard-- > 0 && current(s.battle!)?.id !== 'player') {
      if (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
      else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    s = reduce(s, { type: 'BATTLE_ITEM', actor: 'player', item: 'faraday_foil', target: 'player' });
    for (const c of s.battle!.combatants.filter((c) => c.side === 'party' && !c.down)) {
      expect(c.statuses.some((st) => st.id === 'faraday' && st.turns === 2), c.id).toBe(true);
    }
  });

  it('only heals and revives outside a fight', () => {
    const s = stocked();
    expect(() => reduce(s, { type: 'USE_ITEM', item: 'splice', target: 'player' })).toThrow(/only does anything in a fight/);
  });

  it('is sold and dropped somewhere for each of the four new kinds', () => {
    for (const id of ['splice', 'steady', 'dampener', 'faraday_foil']) {
      expect(Object.values(content.shops).some((sh) => sh.stock.some((st) => st.item === id)), `${id} for sale`).toBe(true);
      expect(Object.values(content.enemies).some((e) => e.drops.some((d) => d.item === id)), `${id} dropped`).toBe(true);
    }
  });
});

describe('the bag holds six', () => {
  it('refuses a seventh consumable at the counter, but not gear', () => {
    let s = run(newGame(3), { type: 'TRAVEL', location: 'kell_village_2312' });
    s = { ...s, dialogue: null, screen: { id: 'hub' }, inventory: { ...s.inventory, items: { ration: 4, splice: 2 }, currency: { ...s.inventory.currency, 'allocation points': 999 } } };
    expect(() => reduce(s, { type: 'SHOP_BUY', item: 'ration' })).toThrow(/bag holds 6/);
    const gear = content.shops.kell_commissary.stock.find((st) => content.items[st.item].kind === 'gear')!;
    expect(() => reduce(s, { type: 'SHOP_BUY', item: gear.item })).not.toThrow();
    s = { ...s, inventory: { ...s.inventory, items: { ration: 5 } } };
    expect(reduce(s, { type: 'SHOP_BUY', item: 'ration' }).inventory.items.ration).toBe(6);
  });

  it('leaves a drop behind when there is no room, and says so', () => {
    let s = newGame(3);
    s = { ...s, inventory: { ...s.inventory, items: { ration: 6 } } };
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    s = { ...s, battle: { ...s.battle!, phase: 'won', pendingRewards: { xp: 10, currency: 5, items: ['ration', 'scrap'], flags: [], levelUps: [] } } };
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.inventory.items.ration).toBe(6);
    expect(s.inventory.items.scrap).toBe(1);
    expect(s.battle!.pendingRewards!.leftBehind).toEqual(['ration']);
    expect(s.battle!.pendingRewards!.items).toEqual(['scrap']);
  });
});
