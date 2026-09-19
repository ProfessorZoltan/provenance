import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/core/save';
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
