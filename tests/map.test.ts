import { describe, expect, it } from 'vitest';
import { mapFor } from '../src/core/reducer';
import { autoBattle, content, newGame, reduce, run, skipDialogue } from './helpers';

describe('era maps', () => {
  it('gives every era in the slice a map whose nodes cover its locations', () => {
    for (const loc of Object.values(content.locations)) {
      const map = mapFor(content, loc.era);
      expect(map, loc.id).not.toBeNull();
      expect(map!.nodes.some((n) => n.location === loc.id), loc.id).toBe(true);
    }
    expect(mapFor(content, '2312')!.zones.length).toBeGreaterThan(0);
    expect(mapFor(content, '2148')!.zones.length).toBe(2);
  });

  it('arrival places the party at the location node and hub leads back to the map', () => {
    let s = skipDialogue(newGame(5));
    const node = mapFor(content, '2312')!.nodes.find((n) => n.location === 'kell_2312')!;
    expect(s.map.x).toBe(node.x);
    s = reduce(s, { type: 'SET_SCREEN', screen: { id: 'map' } });
    s = reduce(s, { type: 'SET_MAP_POS', x: 431, y: 661 });
    s = reduce(s, { type: 'TRAVEL', location: 'kell_village_2312' });
    expect(s.location).toBe('kell_village_2312');
    expect(s.screen.id).toBe('hub');
    expect(() => reduce(s, { type: 'TRAVEL', location: 'kell_2148' })).toThrow();
  });

  it('a zone encounter returns to the map after the fight, a story ambush returns to the hub', () => {
    let s = skipDialogue(newGame(31));
    s = reduce(s, { type: 'SET_SCREEN', screen: { id: 'map' } });
    s = reduce(s, { type: 'EXPLORE', encounters: ['kell_2312_perimeter'] });
    expect(['scan', 'battle']).toContain(s.screen.id);
    expect(s.battleReturn).toBe('map');
    if (s.screen.id === 'scan') {
      const skipped = reduce(s, { type: 'SCAN_SKIP' });
      expect(skipped.screen.id).toBe('map');
      s = reduce(s, { type: 'SCAN_FIGHT' });
    }
    s = autoBattle(s);
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: s.battleReturn } });
    expect(s.screen.id).toBe('map');
    // Story battle from dialogue.
    s = run(s, { type: 'TIME_JUMP', era: '2148' });
    s = skipDialogue(s, 0);
    expect(s.screen.id).toBe('battle');
    expect(s.battleReturn).toBe('hub');
  });

  it('overlay screens remember whether they were opened from the map', () => {
    let s = skipDialogue(newGame(5));
    s = run(s, { type: 'SET_SCREEN', screen: { id: 'map' } }, { type: 'SET_SCREEN', screen: { id: 'tech', character: 'player' } });
    expect(s.back.id).toBe('map');
    s = run(s, { type: 'SET_SCREEN', screen: s.back }, { type: 'SET_SCREEN', screen: { id: 'hub' } }, { type: 'SET_SCREEN', screen: { id: 'inventory' } });
    expect(s.back.id).toBe('hub');
  });
});
