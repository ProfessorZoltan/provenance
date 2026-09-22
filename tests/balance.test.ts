import { describe, expect, it } from 'vitest';
import { buildScan } from '../src/core/encounter';
import type { DamageType } from '../src/types/content';
import { content, reduce } from './helpers';
import { BANDS, CORE, ERA_LEVEL, KEY_LEVEL, TYPICAL, measure, partyAt, playBattle, playSustain } from './balance';
import { levelForXp, xpForLevel } from '../src/core/stats';

describe('the level curve', () => {
  it('costs more for every level, so a long run does not run away with itself', () => {
    const k = content.rules.xpPerLevel;
    expect(levelForXp(0, k)).toBe(1);
    expect(levelForXp(k - 1, k)).toBe(1);
    expect(levelForXp(k, k)).toBe(2);
    expect(levelForXp(3 * k, k)).toBe(3);
    for (let l = 1; l <= 40; l++) {
      expect(levelForXp(xpForLevel(l, k), k)).toBe(l);
      expect(levelForXp(xpForLevel(l, k) - 1, k)).toBe(Math.max(1, l - 1));
    }
  });

  it('lands a run that fights everything short of the level where the trees run out', () => {
    const everything = Object.values(content.encounters).reduce((sum, e) =>
      sum + e.enemies.reduce((s, g) => s + (content.enemies[g.enemy]?.xp ?? 0) * g.count, 0), 0)
      + Object.values(content.quests).reduce((s, q) => s + (q.rewards?.xp ?? 0), 0);
    const level = levelForXp(everything, content.rules.xpPerLevel);
    const biggestTree = Math.max(...Object.keys(content.characters).map((id) =>
      Object.values(content.nodes).filter((n) => n.character === id).reduce((s, n) => s + n.cost, 0)));
    expect(level).toBeGreaterThan(20);
    // Skill points are 1 + level, so a completionist finishes a tree and no more than that.
    expect(1 + level).toBeGreaterThanOrEqual(biggestTree);
    expect(1 + level).toBeLessThan(biggestTree * 1.6);
  });
});

describe('how long a fight runs', () => {
  const rows = Object.values(content.encounters).map((e) => measure(e.id));

  it('keeps every encounter inside the band its tier promises', () => {
    const outside = rows
      .filter((r) => r.rounds < BANDS[r.tier][0] || r.rounds > BANDS[r.tier][1])
      .map((r) => `${r.id} (${r.tier}, L${r.level}): ${r.rounds} rounds, band ${BANDS[r.tier].join('-')}`);
    expect(outside, outside.join('\n')).toEqual([]);
  });

  it('is winnable at the level the party reaches it', () => {
    const lost = rows.filter((r) => r.wins < r.runs).map((r) => `${r.id}: won ${r.wins} of ${r.runs} at L${r.level}`);
    expect(lost, lost.join('\n')).toEqual([]);
  });

  // A run that takes every story fight and no quests reaches the Stack around level 14; one that
  // also does the quests and some of the wilds arrives nearer 21. The last dungeon has to work
  // across that whole span, with the three characters every run has.
  const ARRIVES = 14;
  const DID_EVERYTHING = 26;

  it('falls to a run that got there without doing the optional half of the game', () => {
    for (const e of Object.values(content.encounters).filter((x) => x.tier === 'key')) {
      const r = measure(e.id, [11, 29, 47], CORE, ARRIVES);
      expect(r.wins, `${e.id} at L${ARRIVES}: won ${r.wins} of ${r.runs}`).toBe(r.runs);
      expect(r.rounds, `${e.id} at L${ARRIVES}`).toBeGreaterThanOrEqual(BANDS.key[0]);
      expect(r.rounds, `${e.id} at L${ARRIVES}`).toBeLessThanOrEqual(BANDS.key[1]);
    }
  });

  it('is shorter for a run that did everything, and never a formality', () => {
    // Doing the optional half of the game is allowed to buy an easier last dungeon. It is not
    // allowed to turn the last dungeon into the same length as a drone patrol.
    for (const e of Object.values(content.encounters).filter((x) => x.tier === 'key')) {
      const r = measure(e.id, [11, 29, 47], TYPICAL, DID_EVERYTHING);
      expect(r.rounds, `${e.id} at L${DID_EVERYTHING}`).toBeGreaterThan(BANDS.ordinary[1]);
    }
  });

  it('does not let a party heal its way out of having to finish a fight', () => {
    // Topping everyone up and keeping the buffs running is a real way to play. It should cost
    // rounds, not remove the problem: a fight that drags has to end, one way or the other.
    for (const e of Object.values(content.encounters)) {
      const level = e.tier === 'key' ? KEY_LEVEL : ERA_LEVEL[e.era];
      let s = partyAt(level, TYPICAL, 29);
      s = reduce(s, { type: 'START_ENCOUNTER', encounterId: e.id, surprise: false });
      s = playSustain(s);
      expect(['won', 'lost'], `${e.id} never resolved: ${s.battle?.round} rounds`).toContain(s.battle?.phase);
      expect(s.battle?.round, `${e.id} dragged on`).toBeLessThan(60);
    }
  });

  it('still asks a sustain party for more rounds than a straightforward one', () => {
    // If healing made fights shorter or the same length, it would just be free.
    const key = Object.values(content.encounters).filter((e) => e.tier === 'key');
    for (const e of key) {
      const start = partyAt(KEY_LEVEL, TYPICAL, 29);
      const begin = reduce(start, { type: 'START_ENCOUNTER', encounterId: e.id, surprise: false });
      const plain = playBattle(begin).battle!.round;
      const sustain = playSustain(begin).battle!.round;
      // Nerve bounds how long a party can top itself up, so a sustain party no longer stalls a
      // fight indefinitely. It still may not make one shorter: healing is a cost, not a shortcut.
      expect(sustain, `${e.id}: plain ${plain}r, sustain ${sustain}r`).toBeGreaterThanOrEqual(plain);
    }
  });

  it('is winnable by the three characters every run has, recruits or no recruits', () => {
    const lean = Object.values(content.encounters).map((e) => measure(e.id, [11, 29, 47], CORE));
    const lost = lean.filter((r) => r.wins < r.runs).map((r) => `${r.id}: won ${r.wins} of ${r.runs} at L${r.level}`);
    expect(lost, lost.join('\n')).toEqual([]);
  });

  it('asks more of the player the further in the fight sits', () => {
    const median = (t: 'ordinary' | 'hard' | 'key') => {
      const v = rows.filter((r) => r.tier === t).map((r) => r.rounds).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    expect(median('ordinary')).toBeLessThan(median('hard'));
    expect(median('hard')).toBeLessThan(median('key'));
  });

  it('measures every tier against a party that could plausibly be standing there', () => {
    for (const era of Object.keys(ERA_LEVEL)) expect(ERA_LEVEL[era]).toBeLessThanOrEqual(KEY_LEVEL);
    const p = partyAt(KEY_LEVEL, ['player', 'wren', 'dax', 'ilo9']);
    expect(p.activeParty).toHaveLength(content.rules.activePartyMax);
    expect(p.party.player.level).toBe(KEY_LEVEL);
    expect(p.party.player.nodes.length).toBeGreaterThan(8);
  });
}, 900000);

describe('the scan card', () => {
  const scanFor = (encounterId: string, members: string[], level: number) => {
    const s = partyAt(level, members);
    return buildScan(content, s, encounterId, false).hints.join(' | ');
  };

  it('says out loud when nothing the party carries can touch what is out there', () => {
    // The three you start with, early: no Chronal anywhere in the party, and an Echo in the reeds.
    const blind = scanFor('kell_2148_chapel', CORE, 3);
    expect(blind).toMatch(/Nothing any of us is carrying will land on that/);
    expect(blind).toMatch(/to one side of now/);
  });

  it('stays quiet once someone can actually answer it', () => {
    const s = partyAt(3, CORE);
    const chronal = Object.values(content.nodes).find((n) => n.character === 'player'
      && n.effects.some((e) => e.kind === 'ability' && content.abilities[e.ability]?.damageType === 'chronal'))!;
    const withChronal = {
      ...s,
      party: { ...s.party, player: { ...s.party.player, nodes: [...s.party.player.nodes, ...chronal.requires, chronal.id] } },
    };
    expect(buildScan(content, withChronal, 'kell_2148_chapel', false).hints.join(' | '))
      .not.toMatch(/Nothing any of us is carrying/);
  });

  it('says nothing about a fight the party can simply have', () => {
    expect(scanFor('kell_2148_walls', CORE, 8)).not.toMatch(/Nothing any of us is carrying/);
    expect(scanFor('kell_2312_perimeter', CORE, 3)).not.toMatch(/Nothing any of us is carrying/);
  });

  it('warns about every encounter a party without Chronal cannot finish', () => {
    const physical: DamageType[] = ['kinetic', 'thermal', 'signal'];
    const walls = Object.values(content.encounters).filter((e) => e.enemies.some((g) => {
      const def = content.enemies[g.enemy];
      return def && physical.every((t) => def.immunities.includes(t));
    }));
    expect(walls.length).toBeGreaterThan(0);
    for (const e of walls) {
      expect(scanFor(e.id, CORE, 3), e.id).toMatch(/Nothing any of us is carrying will land on that/);
    }
  });
});
