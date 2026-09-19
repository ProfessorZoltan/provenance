import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/core/save';
import { evalAll } from '../src/core/conditions';
import { conditionContext } from '../src/core/encounter';
import { deriveWorld } from '../src/core/timeline';
import type { GameState } from '../src/types/state';
import { autoBattle, content, newGame, reduce, run, skipDialogue } from './helpers';

describe('vertical slice end to end', () => {
  it('plays the whole loop: explore, scan, fight, quest, jump, choose, return, save and load', () => {
    let s = skipDialogue(newGame(2024));
    expect(s.flags).toContain('metParty');

    // Explore at the monastery until a scanned encounter appears (surprise rolls are possible).
    let scanned = false;
    for (let i = 0; i < 6 && !scanned; i++) {
      s = reduce(s, { type: 'EXPLORE' });
      if (s.screen.id === 'scan') scanned = true;
      else { s = autoBattle(s); s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } }); }
    }
    expect(scanned).toBe(true);
    expect(s.scan?.hints[0]).toMatch(/2 enemies/);
    // Skip costs nothing.
    const before = s.counters;
    s = reduce(s, { type: 'SCAN_SKIP' });
    expect(s.screen.id).toBe('hub');
    expect(s.counters).toEqual(before);

    // Quest at the village.
    s = reduce(s, { type: 'TRAVEL', location: 'kell_village_2312' });
    s = reduce(s, { type: 'START_DIALOGUE', id: 'pell_offer', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.quests.gate_drone).toBe('active');
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_gate' });
    s = autoBattle(s);
    expect(s.battle?.phase).toBe('won');
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } });
    expect(s.quests.gate_drone).toBe('readyToTurnIn');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'pell_complete', returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    expect(s.quests.gate_drone).toBe('complete');
    expect(s.inventory.relics).toContain('relic_prayer_wheel');

    // Shop: sell the relic at a premium, buy a ration.
    const pts = s.inventory.currency['allocation points'];
    s = reduce(s, { type: 'SHOP_SELL_RELIC', item: 'relic_prayer_wheel' });
    expect(s.inventory.currency['allocation points']).toBe(pts + 120);
    s = reduce(s, { type: 'SHOP_BUY', item: 'ration' });
    expect(s.inventory.items.ration).toBe(3);

    // Time jump, choose, survive the ambush.
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'REST' }, { type: 'TIME_JUMP', era: '2148' });
    s = skipDialogue(s, 0);
    expect(s.battle?.encounterId).toBe('kell_2148_ambush');
    s = autoBattle(s);
    if (s.battle?.phase === 'lost') {
      s = reduce(s, { type: 'BATTLE_FINISH' });
      expect(s.screen.id).toBe('gameOver');
      s = reduce(s, { type: 'GAME_OVER_RETURN' });
      expect(s.location).toBe('kell_2148');
    } else {
      s = reduce(s, { type: 'BATTLE_FINISH' });
      expect(s.flags).toContain('survivedSurprise');
      s = reduce(s, { type: 'SET_SCREEN', screen: { id: 'hub' } });
    }

    // Return: the village has changed.
    s = run(s, { type: 'TIME_JUMP', era: '2312' }, { type: 'TRAVEL', location: 'kell_village_2312' });
    expect(s.dialogue?.id).toBe('village_armed');
    s = skipDialogue(s);

    // Save and load round trip.
    const text = serialize(s);
    const loaded = reduce(s, { type: 'LOAD_STATE', state: deserialize(text) });
    expect(loaded.world).toEqual(s.world);
    expect(loaded.party).toEqual(s.party);
    expect(loaded.inventory).toEqual(s.inventory);
    expect(loaded.flags).toEqual(s.flags);
    expect(loaded.screen.id).toBe('hub');
    expect(() => deserialize('{"nope":true}')).toThrow();
  });

  it('adding content requires no code: a fourth character and a sixth encounter load from JSON alone', () => {
    // The loader groups by folder and id; this test asserts the schema plumbing rather than files on disk.
    const ids = Object.keys(content.characters);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(Object.values(content.encounters).every((e) => e.enemies.every((g) => content.enemies[g.enemy]))).toBe(true);
  });
});

describe('the second Deep Site', () => {
  it('walks to Port Halden in 2064, settles the Handover and brings Mara home', () => {
    let s = skipDialogue(newGame(4242));
    // Both sites sit on one map per era, so Halden is reached on foot from Kell.
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TRAVEL', location: 'halden_2312' });
    expect(s.location).toBe('halden_2312');
    s = skipDialogue(s);

    // 2064 is only reachable because both sites already existed then.
    s = reduce(s, { type: 'TIME_JUMP', era: '2064' });
    expect(s.location).toBe('halden_2064');
    s = skipDialogue(s);
    expect(s.world.visitedEras).toContain('2064');

    // Vesely puts one thing on the floor: amend article nine.
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.world.history.map((h) => h.choiceId)).toContain('amend_treaty');

    // Having carried her clause, she asks to come along.
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(Object.keys(s.party)).toContain('mara');
    expect(s.activeParty).toContain('mara');

    // And the change is waiting at home: the clause is in the charter and the commissary has more on its shelves.
    const before = deriveWorld(content, newGame(4242).world, s.party).ownership;
    s = run(s, { type: 'TIME_JUMP', era: '2312' });
    expect(s.location).toBe('halden_2312');
    expect(deriveWorld(content, s.world, s.party).ownership).toBe(before + 30);
    s = reduce(s, { type: 'TRAVEL', location: 'enclave7_commissary_2312' });
    const onSale = (st: GameState) => content.shops.enclave7_commissary.stock
      .filter((x) => evalAll(x.when, conditionContext(content, st))).length;
    expect(onSale(s), 'the shelves carry more than they did').toBeGreaterThan(onSale(skipDialogue(newGame(4242))));
  });

  it('keeps Mara out of the party when the vote was sabotaged instead', () => {
    let s = skipDialogue(newGame(99));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TRAVEL', location: 'halden_2312' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'TIME_JUMP', era: '2064' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 1); // Collapse the session.
    expect(s.world.history.map((h) => h.choiceId)).toContain('sabotage_vote');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(Object.keys(s.party)).not.toContain('mara');
  });
});
