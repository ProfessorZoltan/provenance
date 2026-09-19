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
    for (const era of ['2031', '2064', '2148', '2312'] as const) {
      const map = mapFor(content, era)!;
      expect(map.zones.length, era).toBeGreaterThan(0);
      // Both Deep Sites share one map per era, so nothing may sit off the edge of it.
      for (const n of map.nodes) {
        expect(n.x > n.radius && n.x < map.width - n.radius, `${map.id}/${n.id} x`).toBe(true);
        expect(n.y > 150 && n.y < map.height - n.radius, `${map.id}/${n.id} y`).toBe(true);
      }
      for (const z of map.zones) {
        expect(z.x + z.w <= map.width, `${map.id}/${z.id}`).toBe(true);
        expect(z.y + z.h <= map.height, `${map.id}/${z.id}`).toBe(true);
      }
    }
  });

  it('puts both Deep Sites on the same map in every era, joined by road', () => {
    for (const era of ['2031', '2064', '2148', '2312'] as const) {
      const map = mapFor(content, era)!;
      const sites = map.nodes.filter((n) => n.location && content.locations[n.location]?.kind === 'deepSite');
      expect(sites.map((n) => content.locations[n.location!].site).sort(), era).toEqual(['halden', 'kell']);
      expect(map.roads.length, era).toBeGreaterThanOrEqual(2);
    }
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
