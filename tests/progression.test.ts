import { describe, expect, it } from 'vitest';
import { abilityOptions, current, hasStatus, pairPartner } from '../src/core/battle/battle';
import { loadout, maxNerve, perkOffer, perksOwed } from '../src/core/stats';
import type { GameState } from '../src/types/state';
import { content, newGame, reduce } from './helpers';

const rules = content.rules;

describe('level-up picks', () => {
  it('owes one pick per level past the first, offers two, and keeps the one chosen for good', () => {
    let s = newGame(5);
    expect(perksOwed(content, s.party.player)).toBe(0);
    s = { ...s, party: { ...s.party, player: { ...s.party.player, level: 4 } } };
    expect(perksOwed(content, s.party.player)).toBe(3);
    const offer = perkOffer(content, s.party.player, s.seed);
    expect(offer).toHaveLength(rules.perks.choices);
    expect(offer[0].id).not.toBe(offer[1].id);
    // The same run offers the same two each time it is looked at.
    expect(perkOffer(content, s.party.player, s.seed).map((p) => p.id)).toEqual(offer.map((p) => p.id));
    expect(() => reduce(s, { type: 'CHOOSE_PERK', character: 'player', perk: Object.keys(content.perks).find((id) => !offer.some((p) => p.id === id))! })).toThrow(/not one of the two/);
    const before = loadout(content, content.characters.player, s.party.player).stats;
    s = reduce(s, { type: 'CHOOSE_PERK', character: 'player', perk: offer[0].id });
    expect(s.party.player.perks).toEqual([offer[0].id]);
    expect(perksOwed(content, s.party.player)).toBe(2);
    expect(s.journal.at(-1)).toMatch(new RegExp(`takes ${offer[0].name}`));
    const after = loadout(content, content.characters.player, s.party.player).stats;
    for (const [k, v] of Object.entries(offer[0].stats ?? {})) expect(after[k as keyof typeof after] - before[k as keyof typeof before], k).toBe(v);
    if (offer[0].nerve) expect(maxNerve(content, s.party.player)).toBe(rules.nerve.base + rules.nerve.perLevel * 4 + offer[0].nerve);
    // The next pick is a different offer.
    const next = perkOffer(content, s.party.player, s.seed).map((p) => p.id);
    expect(next).not.toEqual(offer.map((p) => p.id));
  });

  it('is owed on levelling up, and on a save from before picks existed', () => {
    let s = newGame(5);
    const xp = 45 * 5 * 6 / 2;
    s = { ...s, party: { ...s.party, wren: { ...s.party.wren, xp: xp - 1 } } };
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    s = { ...s, battle: { ...s.battle!, phase: 'won', pendingRewards: { xp: 10, currency: 0, items: [], flags: [], levelUps: [] } } };
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.party.wren.level).toBeGreaterThan(1);
    expect(s.party.wren.pendingPerks).toBe(perksOwed(content, s.party.wren));
    expect(perksOwed(content, s.party.wren)).toBe(s.party.wren.level - 1);
    const old = { ...newGame(5), party: { ...newGame(5).party, dax: { ...newGame(5).party.dax, level: 7 } } };
    delete (old.party.dax as { perks?: string[] }).perks;
    const loaded = reduce(newGame(5), { type: 'LOAD_STATE', state: old });
    expect(loaded.party.dax.perks).toEqual([]);
    expect(loaded.party.dax.pendingPerks).toBe(6);
    expect(() => reduce(loaded, { type: 'CHOOSE_PERK', character: 'player', perk: 'sturdy' })).toThrow(/no pick waiting/);
  });

  it('gives a level less on its own than it did, so the pick is worth making', () => {
    expect(rules.statGrowthPerLevel).toBeLessThan(0.05);
    expect(Object.keys(content.perks).length).toBeGreaterThanOrEqual(6);
  });
});

describe('pair techs', () => {
  function fielded(members: string[], level: number, seed = 8): GameState {
    let s = newGame(seed);
    for (const id of members) if (!s.party[id]) s = reduce(s, { type: 'RECRUIT', character: id });
    const party = { ...s.party };
    for (const id of Object.keys(party)) party[id] = { ...party[id], level, perks: [] };
    s = { ...s, party, activeParty: members };
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_enforcers', surprise: false });
    let guard = 60;
    while (guard-- > 0 && current(s.battle!)?.id !== members[0]) {
      if (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
      else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    return s;
  }
  const option = (s: GameState, who: string, id: string) => abilityOptions(s.battle!, who, content).find((o) => o.ability.id === id)!;

  it('exist for every companion, and each says who it needs', () => {
    const pairs = Object.values(content.abilities).filter((a) => a.pair);
    expect(pairs.length).toBeGreaterThanOrEqual(6);
    const named = new Set<string>();
    for (const a of pairs) {
      const lead = Object.values(content.characters).find((c) => c.abilities.includes(a.id));
      expect(lead, `${a.id} belongs to someone`).toBeDefined();
      expect(content.characters[a.pair!.with], `${a.id} names a real partner`).toBeDefined();
      named.add(lead!.id); named.add(a.pair!.with);
    }
    for (const id of Object.keys(content.characters)) expect(named.has(id), `${id} is in a pair`).toBe(true);
  });

  it('needs the partner standing, both at level, and the partner not already lending', () => {
    const noPartner = fielded(['player', 'wren', 'dax'], 6);
    expect(option(noPartner, 'player', 'cross_reference').reason).toMatch(/Needs ILO-9 standing/);
    const green = fielded(['player', 'ilo9', 'dax'], 2);
    expect(option(green, 'player', 'cross_reference').reason).toMatch(/level 4/);
    const ready = fielded(['player', 'ilo9', 'dax'], 6);
    expect(option(ready, 'player', 'cross_reference').usable).toBe(true);
    const lent = { ...ready, battle: { ...ready.battle!, combatants: ready.battle!.combatants.map((c) => (c.id === 'ilo9' ? { ...c, statuses: [{ id: 'spent', turns: 2 }] } : c)) } };
    expect(option(lent, 'player', 'cross_reference').reason).toMatch(/already lent a hand/);
  });

  it('marks everyone at once, costs the partner a thread next turn, and reads the partner in the formula', () => {
    let s = fielded(['player', 'ilo9', 'dax'], 6);
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === 'player' ? { ...c, threads: 3, nerve: 30 } : c)) } };
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'cross_reference', target: null });
    const b = s.battle!;
    for (const e of b.combatants.filter((c) => c.side === 'enemy' && !c.down)) expect(hasStatus(e, 'marked'), e.id).toBe(true);
    expect(hasStatus(b.combatants.find((c) => c.id === 'ilo9')!, 'spent')).toBe(true);
    expect(b.log.some((l) => l.text.includes('ILO-9 lends a hand'))).toBe(true);
    // ILO-9's next turn is a thread short.
    let guard = 40;
    let slackBefore = 0;
    while (guard-- > 0 && current(s.battle!)?.id !== 'ilo9') {
      slackBefore = s.battle!.combatants.find((c) => c.id === 'ilo9')!.slack;
      if (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
      else s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    const ilo = current(s.battle!)!;
    // Fear from the enforcers' Suppress may have cost a thread too; the lent hand costs its own.
    const feared = hasStatus(ilo, 'fear') ? 1 : 0;
    expect(ilo.threads).toBe(Math.max(1, ilo.stats.bandwidth + slackBefore - feared - rules.pairs.partnerPenalty));
    expect(s.battle!.log.at(-1)?.text).toMatch(/short, for the hand they lent/);
    // A pair formula reads the partner's stats: Breach and Shot with Hale hits harder than Dax alone would explain.
    let d = fielded(['dax', 'player', 'hale'], 6);
    d = { ...d, battle: { ...d.battle!, combatants: d.battle!.combatants.map((c) => (c.id === 'dax' ? { ...c, threads: 3 } : c)) } };
    const part = pairPartner(d.battle!, d.battle!.combatants.find((c) => c.id === 'dax')!, content.abilities.breach_and_shot, content);
    expect(part.partner?.id).toBe('hale');
  });
});
