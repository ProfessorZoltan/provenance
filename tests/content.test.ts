import { describe, expect, it } from 'vitest';
import { NPC_NAMES } from '../src/core/reducer';
import { content } from './helpers';
import hubSource from '../src/ui/screens/hub.ts?raw';

describe('content', () => {
  it('covers four eras, six party members and every enemy family', () => {
    expect(Object.keys(content.characters).sort()).toEqual(['dax', 'hale', 'ilo9', 'mara', 'player', 'wren']);
    expect([...new Set(Object.values(content.locations).map((l) => l.era))].sort()).toEqual(['2031', '2064', '2148', '2312']);
    const families = new Set(Object.values(content.enemies).map((e) => e.family));
    expect([...families].sort()).toEqual(['construct', 'drone', 'echo', 'warden']);
    for (const era of ['2031', '2064', '2148', '2312']) {
      expect(Object.values(content.enemies).some((e) => e.era === era), era).toBe(true);
      expect(Object.values(content.scores).some((s) => s.era === era && s.id.startsWith('battle')), era).toBe(true);
      expect(Object.values(content.scores).some((s) => s.era === era && s.id.startsWith('hub')), era).toBe(true);
      expect(Object.values(content.maps).some((m) => m.era === era), era).toBe(true);
    }
  });

  it('gives every Deep Site a stop in all four eras, each reachable from the others', () => {
    for (const site of ['kell', 'halden', 'basin']) {
      const stops = Object.values(content.locations).filter((l) => l.kind === 'deepSite' && l.site === site);
      expect(stops.map((s) => s.era).sort(), site).toEqual(['2031', '2064', '2148', '2312']);
      for (const s of stops) {
        // A Deep Site reaches every era it existed in except the one you are standing in.
        expect([...s.timeLinks].sort(), s.id).toEqual(['2031', '2064', '2148', '2312'].filter((e) => e !== s.era));
      }
    }
  });

  it('gives each character a full tree with one condition node, a contradiction pair and era nodes', () => {
    for (const id of Object.keys(content.characters)) {
      const nodes = Object.values(content.nodes).filter((n) => n.character === id);
      expect(nodes.length, id).toBeGreaterThanOrEqual(14);
      expect(nodes.filter((n) => n.type === 'condition'), id).toHaveLength(1);
      const contradictions = nodes.filter((n) => n.type === 'contradiction');
      expect(contradictions, id).toHaveLength(2);
      expect(contradictions[0].excludes).toContain(contradictions[1].id);
      expect(contradictions[1].excludes).toContain(contradictions[0].id);
      const eraNodes = nodes.filter((n) => n.type === 'era');
      expect(eraNodes.length, `${id} era nodes`).toBeGreaterThanOrEqual(2);
      for (const n of eraNodes) expect(n.era, n.id).toBeTruthy();
    }
  });

  it('keeps every Construct honest about its second bar', () => {
    const constructs = Object.values(content.enemies).filter((e) => e.family === 'construct');
    expect(constructs.length).toBeGreaterThan(0);
    for (const c of constructs) {
      expect(c.secondBar, c.id).toBeDefined();
      expect(c.secondBar!.resolve, c.id).toBeGreaterThan(0);
      expect(c.secondBar!.flavor, c.id).toBeTruthy();
    }
  });

  it('gates every surprise-only encounter behind a story beat', () => {
    const ambushes = Object.values(content.encounters).filter((e) => e.surprise === 'always');
    expect(ambushes.length).toBeGreaterThan(0);
    for (const a of ambushes) expect(a.story, a.id).toBe(true);
  });

  it('only sells gear that a character could wear', () => {
    for (const shop of Object.values(content.shops)) {
      for (const row of shop.stock) {
        const item = content.items[row.item];
        if (item.kind !== 'gear') continue;
        expect(item.slot, item.id).toBeTruthy();
        for (const who of item.onlyFor ?? []) expect(content.characters[who], `${item.id} is for ${who}`).toBeDefined();
      }
    }
  });

  it('leaves no item in the catalog that a player could never get hold of', () => {
    const sold = new Set(Object.values(content.shops).flatMap((s) => s.stock.map((r) => r.item)));
    const dropped = new Set(Object.values(content.enemies).flatMap((e) => (e.drops ?? []).map((d) => d.item)));
    const rewarded = new Set(Object.values(content.quests).flatMap((q) => q.rewards.items));
    for (const item of Object.values(content.items)) {
      expect(sold.has(item.id) || dropped.has(item.id) || rewarded.has(item.id), item.id).toBe(true);
    }
  });

  it('gives every location four parallax layers and one ambient animation', () => {
    for (const loc of Object.values(content.locations)) {
      expect(loc.background.layers, loc.id).toHaveLength(4);
      expect(loc.background.layers.some((l) => l.ambient), loc.id).toBe(true);
    }
  });
});

describe('teaching the systems', () => {
  it('has Wren explain threads, Tempo, Rewind, Fork and Entropy in the Act 1 intro', () => {
    const text = content.dialogues.intro_2312.lines.map((l) => l.text).join(' ');
    for (const term of ['thread', 'Slack', 'Tempo', 'Rewind', 'Fork', 'Entropy']) {
      expect(text, term).toContain(term);
    }
  });

  it('lets the player ask Wren to go over the gauges again', () => {
    const choice = content.dialogues.wren_hub.lines.flatMap((l) => l.choices ?? []).find((c) => c.next === 'wren_tempo_lesson');
    expect(choice).toBeDefined();
    const lesson = content.dialogues.wren_tempo_lesson.lines.map((l) => l.text).join(' ');
    expect(lesson).toContain('Rewind');
    expect(lesson).toContain('Fork');
    expect(lesson).toContain('Entropy');
    expect(lesson).toMatch(/two points|Two points/i);
  });
})

describe('presentation of people', () => {
  it('names every speaker and every NPC a location offers', () => {
    const speakers = new Set<string>();
    for (const d of Object.values(content.dialogues)) for (const l of d.lines) speakers.add(l.speaker);
    for (const l of Object.values(content.locations)) {
      for (const n of [...l.npcs, ...(l.variants ?? []).flatMap((v) => v.npcs)]) speakers.add(n);
    }
    speakers.delete('narrator');
    const unnamed = [...speakers].filter((s) => !NPC_NAMES[s] && !content.characters[s]);
    expect(unnamed, `these would show as raw ids: ${unnamed.join(', ')}`).toEqual([]);
  });
});

describe('no dead ends', () => {
  it('never puts a condition node behind a fight the party might not be able to win', () => {
    // An Echo answers only Chronal damage, so an encounter holding one must not be the only
    // source of a flag anything else depends on.
    const echoFights = new Set(Object.values(content.encounters)
      .filter((e) => e.enemies.some((g) => content.enemies[g.enemy].family === 'echo'))
      .flatMap((e) => e.rewardFlags ?? []));
    const conditionFlags = Object.values(content.nodes)
      .filter((n) => n.type === 'condition' && n.condition?.startsWith('flag:'))
      .map((n) => n.condition!.slice('flag:'.length));
    const dialogueFlags = new Set(Object.values(content.dialogues).flatMap((d) => d.lines.flatMap(
      (l) => [...(l.setFlags ?? []), ...(l.choices ?? []).flatMap((c) => c.setFlags ?? [])])));
    const questFlags = new Set(Object.values(content.quests).flatMap((q) => q.rewards.flags));
    const safeFights = new Set(Object.values(content.encounters)
      .filter((e) => !e.enemies.some((g) => content.enemies[g.enemy].family === 'echo'))
      .flatMap((e) => e.rewardFlags ?? []));
    for (const flag of conditionFlags) {
      const reachable = dialogueFlags.has(flag) || questFlags.has(flag) || safeFights.has(flag)
        || Object.values(content.timelineChoices).some((c) => c.flags.includes(flag));
      expect(reachable, `${flag} is only reachable through an Echo fight`).toBe(true);
      void echoFights;
    }
  });

  it('gives every recruitable character a way into the party', () => {
    const recruits = new Set(Object.values(content.dialogues).flatMap((d) => d.lines.flatMap(
      (l) => [l.action, ...(l.choices ?? []).map((c) => c.action)])).filter((a): a is string => !!a)
      .filter((a) => a.startsWith('recruit:')).map((a) => a.slice('recruit:'.length)));
    for (const id of Object.keys(content.characters)) {
      if (['player', 'wren', 'dax'].includes(id)) continue; // Act 1, always.
      expect(recruits.has(id), `${id} can never be recruited`).toBe(true);
    }
  });
});

describe('site-specific presentation', () => {
  it('names the way down at every Deep Site rather than talking about a chapel everywhere', () => {
    const sites = new Set(Object.values(content.locations).filter((l) => l.kind === 'deepSite').map((l) => l.site));
    const labels = [...hubSource.matchAll(/^ {2}(\w+): '([^']+)',$/gm)].reduce<Record<string, string>>(
      (acc, m) => ({ ...acc, [m[1]]: m[2] }), {});
    for (const site of sites) expect(labels[site], `${site} has no way-down label`).toBeTruthy();
    expect(new Set(Object.values(labels)).size, 'each site describes its own descent').toBe(Object.keys(labels).length);
  });
});
