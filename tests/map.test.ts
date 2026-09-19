import { describe, expect, it } from 'vitest';
import mapSource from '../src/ui/screens/map.ts?raw';
import { evalAll } from '../src/core/conditions';
import { conditionContext } from '../src/core/encounter';
import { createReducer, mapFor } from '../src/core/reducer';
import { autoBattle, content, newGame, reduce, run, skipDialogue } from './helpers';

describe('era maps', () => {
  it('gives every era in the slice a map whose nodes cover its locations', () => {
    for (const loc of Object.values(content.locations)) {
      const map = mapFor(content, loc.era);
      expect(map, loc.id).not.toBeNull();
      // A place reached only from somewhere else is deliberately not on the map.
      if (loc.offMap) continue;
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

  it('hides a node whose requires are unmet, location or encounter, and refuses to travel there', () => {
    const s = skipDialogue(newGame(5));
    const gated = { ...content.maps.map_2312, nodes: content.maps.map_2312.nodes.map((n) =>
      (n.location === 'kell_village_2312' ? { ...n, requires: ['flag:nobodyHasThis'] } : n)) };
    const gatedContent = { ...content, maps: { ...content.maps, map_2312: gated } };
    const cctx = conditionContext(gatedContent, s);
    const visible = gated.nodes.filter((n) => evalAll(n.requires, cctx)).map((n) => n.id);
    expect(visible).not.toContain('kell_village_2312');
    expect(visible).toContain('kell_2312');
    // The encounter node the village quest unlocks is gated the same way, and already was.
    expect(visible).not.toContain('village_gate');
    expect(() => createReducer(gatedContent)(s, { type: 'TRAVEL', location: 'kell_village_2312' })).toThrow();
  });

  it('puts every Deep Site on the same map in every era, joined by road', () => {
    for (const era of ['2031', '2064', '2148', '2312'] as const) {
      const map = mapFor(content, era)!;
      const sites = map.nodes.filter((n) => n.location && content.locations[n.location]?.kind === 'deepSite');
      expect(sites.map((n) => content.locations[n.location!].site).sort(), era)
        .toEqual(['basin', 'capitol', 'halden', 'kell', 'meridian']);
      expect(map.roads.length, era).toBeGreaterThanOrEqual(5);
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

describe('three regions on one map', () => {
  it('shows a window of the world and clamps the camera to its edges', () => {
    for (const era of ['2031', '2064', '2148', '2312'] as const) {
      const map = mapFor(content, era)!;
      expect(map.width, era).toBeGreaterThan(2000);
      // Every location is inside the walkable box the map screen clamps the party to.
      for (const n of map.nodes) {
        expect(n.x >= 30 && n.x <= map.width - 30, `${map.id}/${n.id} x`).toBe(true);
        expect(n.y >= 180 && n.y <= map.height - 40, `${map.id}/${n.id} y`).toBe(true);
      }
    }
  });

  it('gives the Basin its own road, waypoints and wilds in every era it has them', () => {
    const basinWaypoints: Record<string, string[]> = {
      '2031': ['basin_work_camp_2031'], '2064': [],
      '2148': ['ash_camp_2148', 'the_fens_2148'], '2312': ['cooling_perimeter_2312'],
    };
    for (const [era, wps] of Object.entries(basinWaypoints)) {
      const map = mapFor(content, era as '2031')!;
      const ids = map.nodes.map((n) => n.id);
      expect(ids, era).toContain(`basin_${era}`);
      for (const w of wps) expect(ids, `${era}/${w}`).toContain(w);
      // The Basin sits inland, east of both coastal sites.
      const basin = map.nodes.find((n) => n.id === `basin_${era}`)!;
      for (const n of map.nodes.filter((x) => /^(kell|halden)_/.test(x.id))) {
        expect(basin.x, `${era}: basin is east of ${n.id}`).toBeGreaterThan(n.x);
      }
    }
  });
});

describe('map icons', () => {
  it('draws every icon a map node asks for rather than falling back to the village', () => {
    const drawn = new Set([...mapSource.matchAll(/^ {2}(\w+): \(era\) =>/gm)].map((m) => m[1]));
    for (const map of Object.values(content.maps)) {
      for (const n of map.nodes) {
        expect(n.icon, `${map.id}/${n.id} has no icon`).toBeTruthy();
        expect(drawn.has(n.icon!), `${map.id}/${n.id} asks for an icon that is not drawn: ${n.icon}`).toBe(true);
      }
    }
  });
});
