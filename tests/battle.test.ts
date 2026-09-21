import { describe, expect, it } from 'vitest';
import { abilityOptions, createBattle, current, resolveAbility } from '../src/core/battle/battle';
import { evalFormula } from '../src/core/formula';
import { maxHp } from '../src/core/stats';
import { autoBattle, content, entropyCost, newGame, reduce, run } from './helpers';
import type { EraId } from '../src/types/content';
import type { GameState } from '../src/types/state';

function enemyPhase(s: GameState): boolean {
  return s.battle?.phase === 'enemy';
}

function inBattle(seed = 7, enc = 'kell_2312_perimeter', surprise = false): GameState {
  return reduce(newGame(seed), { type: 'START_ENCOUNTER', encounterId: enc, surprise });
}

describe('formula DSL', () => {
  it('evaluates stat references and arithmetic', () => {
    expect(evalFormula('a.grit * 0.6 + 6', { a: { grit: 60 } })).toBe(42);
    expect(evalFormula('max(1, a.signal - d.noise) / 2', { a: { signal: 10 }, d: { noise: 30 } })).toBe(0.5);
    expect(() => evalFormula('a.grit +', { a: { grit: 1 } })).toThrow();
  });
});

describe('battle', () => {
  it('is deterministic given a seed', () => {
    const a = autoBattle(inBattle(99));
    const b = autoBattle(inBattle(99));
    expect(a.battle?.log).toEqual(b.battle?.log);
    expect(a.battle?.phase).toBe('won');
    const c = autoBattle(inBattle(100));
    expect(c.battle?.log).not.toEqual(a.battle?.log);
  });

  it('orders by Latency, machines first', () => {
    const s = inBattle();
    const b = s.battle!;
    expect(b.order[0]).toMatch(/^drone_sentry/);
    expect(b.phase).toBe('enemy');
  });

  it('gives party threads from Bandwidth and carries unspent threads as Slack, capped', () => {
    let s = inBattle();
    while (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    const actor = current(s.battle!)!;
    expect(actor.side).toBe('party');
    expect(actor.threads).toBe(actor.stats.bandwidth);
    s = reduce(s, { type: 'BATTLE_END_TURN', actor: actor.id });
    const after = s.battle!.combatants.find((c) => c.id === actor.id)!;
    expect(after.slack).toBe(Math.min(content.rules.slackCap, actor.stats.bandwidth));
  });

  it('spends Tempo on Rewind to undo the last enemy turn and raises Entropy', () => {
    let s = inBattle(3, 'kell_2148_walls');
    // Let enemies act, then a party member act enough to bank some Tempo.
    while (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    const hpBeforeEnemy = () => s.battle!.combatants.filter((c) => c.side === 'party').map((c) => c.hp);
    // Play party turns until an enemy turn happens, then rewind it.
    let guard = 20;
    let sawEnemy = false;
    while (guard-- > 0 && !sawEnemy && s.battle!.phase !== 'won') {
      const b = s.battle!;
      const actor = current(b)!;
      if (actor.side === 'party') {
        s = reduce(s, { type: 'BATTLE_ABILITY', actor: actor.id, ability: 'strike', target: b.combatants.find((c) => c.side === 'enemy' && !c.down)!.id });
      } else {
        const before = hpBeforeEnemy();
        const rp = s.battle!;
        s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
        sawEnemy = true;
        expect(s.battle!.rewindPoint).not.toBeNull();
        // Rewind requires it to be the player's turn.
        while (enemyPhase(s)) s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
        const tempo = s.battle!.tempo;
        expect(tempo).toBeGreaterThanOrEqual(content.rules.rewind.cost);
        const rewound = reduce(s, { type: 'BATTLE_REWIND' });
        expect(rewound.battle!.rewindsLeft).toBe(s.battle!.rewindsLeft - 1);
        expect(rewound.battle!.entropy).toBe(s.battle!.entropy + entropyCost(content.rules.rewind.entropy));
        expect(rewound.battle!.tempo).toBe(tempo - content.rules.rewind.cost);
        expect(rewound.battle!.turnIndex).toBe(rp.turnIndex);
        expect(rewound.battle!.combatants.filter((c) => c.side === 'party').map((c) => c.hp)).toEqual(before);
        expect(rewound.battle!.phase).toBe('enemy');
        s = rewound;
      }
    }
    expect(sawEnemy).toBe(true);
  });

  it('Fork previews an outcome exactly and charges Tempo, a thread and Entropy', () => {
    let s = inBattle(11);
    while (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    // Bank Tempo with one strike first.
    let b = s.battle!;
    let actor = current(b)!;
    const target = b.combatants.find((c) => c.side === 'enemy' && !c.down)!;
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: actor.id, ability: 'strike', target: target.id });
    b = s.battle!;
    actor = current(b)!;
    if (actor.side !== 'party') return; // policy-dependent; the deterministic seed above keeps it on the party
    const tempo = b.tempo;
    const threads = actor.threads;
    const forked = reduce(s, { type: 'BATTLE_FORK', actor: actor.id, ability: 'strike', target: target.id });
    const fb = forked.battle!;
    expect(fb.tempo).toBe(tempo - content.rules.fork.cost);
    expect(fb.entropy).toBe(b.entropy + entropyCost(content.rules.fork.entropy));
    expect(current(fb)!.threads).toBe(threads - content.rules.fork.threadCost);
    expect(fb.fork?.lines.length).toBeGreaterThan(0);
    // The preview is a promise: committing lands on exactly the Resolve it named.
    const committed = reduce(forked, { type: 'BATTLE_ABILITY', actor: actor.id, ability: 'strike', target: target.id });
    const t = committed.battle!.combatants.find((c) => c.id === target.id)!;
    const line = fb.fork!.lines.find((l) => l.startsWith(t.name));
    expect(line, 'the preview names the target').toBeDefined();
    const promised = line!.match(/takes (\d+) damage, Resolve (\d+) → (\d+)/);
    expect(promised, `parseable preview line: ${line}`).not.toBeNull();
    const before = fb.combatants.find((c) => c.id === target.id)!;
    expect(Number(promised![2])).toBe(before.hp);
    expect(Number(promised![3])).toBe(t.hp);
    expect(Number(promised![1])).toBe(before.hp - t.hp);
    expect(committed.battle!.fork).toBeNull();
  });

  it('spawns an Echo of a party member once Entropy crosses the threshold', () => {
    let s = inBattle(5, 'kell_2148_walls');
    s = { ...s, battle: { ...s.battle!, entropy: content.rules.entropyThreshold - 1 } };
    // Give the player Discrepancy (chronal, raises Entropy by 8) directly.
    const b = s.battle!;
    const withChronal = { ...b, combatants: b.combatants.map((c) => (c.id === 'player' ? { ...c, abilities: [...c.abilities, 'discrepancy'] } : c)) };
    s = { ...s, battle: withChronal };
    while (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    // Advance until the player acts.
    let guard = 10;
    while (current(s.battle!)!.id !== 'player' && guard-- > 0) {
      const a = current(s.battle!)!;
      s = a.side === 'party' ? reduce(s, { type: 'BATTLE_END_TURN', actor: a.id }) : reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    }
    const target = s.battle!.combatants.find((c) => c.side === 'enemy' && !c.down)!;
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'discrepancy', target: target.id });
    expect(s.battle!.entropy).toBeGreaterThanOrEqual(content.rules.entropyThreshold);
    expect(s.battle!.echoSpawned).toBe(true);
    const echo = s.battle!.combatants.find((c) => c.family === 'echo')!;
    expect(echo.echoOf).toBeDefined();
    expect(echo.immunities).toEqual(['kinetic', 'thermal', 'signal']);
    expect(s.battle!.order).toContain(echo.id);
  });

  it('applies damage type rules: immunity, thermal through shields, signal only on machines', () => {
    const s = inBattle(2, 'kell_2148_chapel');
    const b = { ...s.battle!, phase: 'player' as const };
    const echo = b.combatants.find((c) => c.family === 'echo')!;
    const drone = b.combatants.find((c) => c.family === 'drone')!;
    const dax = b.combatants.find((c) => c.id === 'dax')!;
    const ready = { ...b, turnIndex: b.order.indexOf('dax'), combatants: b.combatants.map((c) => (c.id === 'dax' ? { ...c, threads: 3, abilities: [...c.abilities, 'salvage'] } : c.side === 'enemy' ? { ...c, statuses: [{ id: 'locked', turns: 5 }] } : c)) };
    const hit = resolveAbility(ready, dax.id, 'strike', echo.id, content);
    expect(hit.combatants.find((c) => c.id === echo.id)!.hp).toBe(echo.hp);
    expect(hit.log.at(-1)?.text).toMatch(/immune/);
    const burn = resolveAbility(ready, dax.id, 'salvage', drone.id, content);
    const d = burn.combatants.find((c) => c.id === drone.id)!;
    expect(d.shield).toBe(drone.shield);
    expect(d.hp).toBeLessThan(drone.hp);
  });

  it('Wreck shatters a shield before the hit', () => {
    const s = inBattle(2);
    const b = { ...s.battle!, phase: 'player' as const };
    const drone = b.combatants.find((c) => c.side === 'enemy')!;
    const ready = { ...b, turnIndex: b.order.indexOf('dax'), combatants: b.combatants.map((c) => (c.id === 'dax' ? { ...c, threads: 3 } : c)) };
    const out = resolveAbility(ready, 'dax', 'wreck', drone.id, content);
    const d = out.combatants.find((c) => c.id === drone.id)!;
    expect(d.shield).toBe(0);
    expect(d.hp).toBeLessThan(drone.hp);
  });

  it('a surprise attack puts the whole party after the enemy with zero Slack', () => {
    const s = inBattle(4, 'kell_2148_ambush', true);
    const b = s.battle!;
    const partyIdx = b.order.map((id, i) => [id, i] as const).filter(([id]) => b.combatants.find((c) => c.id === id)!.side === 'party').map(([, i]) => i);
    const enemyIdx = b.order.map((id, i) => [id, i] as const).filter(([id]) => b.combatants.find((c) => c.id === id)!.side === 'enemy').map(([, i]) => i);
    expect(Math.min(...partyIdx)).toBeGreaterThan(Math.max(...enemyIdx));
    expect(b.combatants.filter((c) => c.side === 'party').every((c) => c.slack === 0)).toBe(true);
  });

  it('exposes Parley only at high party Sync and disables Signal under Overload', () => {
    const high = newGame(1, 'choir');
    const boosted = { ...high, party: { ...high.party, player: { ...high.party.player, sync: 90 }, dax: { ...high.party.dax, sync: 30 } } };
    const b1 = createBattle(content, boosted, 'kell_2312_perimeter', false);
    const p1 = { ...b1, combatants: b1.combatants.map((c) => (c.id === 'player' ? { ...c, threads: 3 } : c)) };
    expect(abilityOptions(p1, 'player', content).some((o) => o.ability.id === 'parley' && o.usable)).toBe(true);
    const low = newGame(1, 'cinder');
    const lowered = { ...low, party: { ...low.party, player: { ...low.party.player, sync: -90 }, wren: { ...low.party.wren, sync: -60 } } };
    const b2 = createBattle(content, lowered, 'kell_2312_perimeter', false);
    const p2 = { ...b2, combatants: b2.combatants.map((c) => (c.id === 'player' ? { ...c, threads: 3, abilities: [...c.abilities, 'discrepancy'] } : c)) };
    expect(abilityOptions(p2, 'player', content).some((o) => o.ability.id === 'parley')).toBe(false);
  });

  it('pays rewards, persists Resolve and levels up on a win', () => {
    let s = autoBattle(inBattle(21));
    expect(s.battle!.phase).toBe('won');
    const xpBefore = s.party.player.xp;
    const levelBefore = s.party.player.level;
    const hpInBattle = s.battle!.combatants.find((c) => c.id === 'player')!.hp;
    const missing = maxHp(content, content.characters.player, s.party.player) - hpInBattle;
    s = run(s, { type: 'BATTLE_FINISH' });
    expect(s.screen.id).toBe('battleResult');
    expect(s.party.player.xp).toBe(xpBefore + 60);
    expect(s.party.player.level).toBeGreaterThan(levelBefore);
    // Levelling raises Resolve; the wound it was carrying is the same size afterwards.
    expect(maxHp(content, content.characters.player, s.party.player) - s.party.player.hp).toBe(missing);
    expect(s.inventory.currency['allocation points']).toBe(60 + 30);
    expect(s.counters.randomFights).toBe(1);
  });
});

describe('fork preview', () => {
  function onTurn(threads: number, tempo = 20, encounterId = 'kell_2312_perimeter'): GameState {
    const s = reduce(newGame(3), { type: 'START_ENCOUNTER', encounterId, surprise: false });
    const b = s.battle!;
    return { ...s, battle: { ...b, phase: 'player' as const, tempo, turnIndex: b.order.indexOf('player'),
      combatants: b.combatants.map((c) => (c.id === 'player' ? { ...c, threads } : c)) } };
  }

  it('leaves the actor on turn with the threads they paid for', () => {
    let s = onTurn(3);
    const target = s.battle!.combatants.find((c) => c.side === 'enemy')!.id;
    s = reduce(s, { type: 'BATTLE_FORK', actor: 'player', ability: 'strike', target });
    expect(current(s.battle!)?.id, 'still the Auditor after forking').toBe('player');
    expect(current(s.battle!)?.threads).toBe(2);
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'strike', target });
    expect(current(s.battle!)?.id, 'still the Auditor after committing').toBe('player');
    expect(current(s.battle!)?.threads).toBe(1);
    expect(s.battle!.phase).toBe('player');
  });

  it('spells out damage, shields, status and the gauges', () => {
    const s = onTurn(3);
    const drone = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    const marked = reduce(s, { type: 'BATTLE_FORK', actor: 'player', ability: 'audit', target: drone.id });
    const text = marked.battle!.fork!.lines.join(' ');
    expect(text).toContain('gains Marked (takes 25% more damage');
    expect(text).toContain('Tempo +');
    // A shielded target shows the shield coming off; an unshielded one shows Resolve.
    const shielded = reduce(s, { type: 'BATTLE_FORK', actor: 'player', ability: 'strike', target: drone.id });
    expect(shielded.battle!.fork!.lines.join(' ')).toMatch(/shield \d+ → \d+/);
    const open = onTurn(3, 20, 'kell_2312_enforcers');
    const warden = open.battle!.combatants.find((c) => c.side === 'enemy' && c.maxShield === 0)!;
    const hit = reduce(open, { type: 'BATTLE_FORK', actor: 'player', ability: 'strike', target: warden.id });
    expect(hit.battle!.fork!.lines.join(' ')).toMatch(/takes \d+ damage, Resolve \d+ → \d+/);
  });

  it('can be discarded, keeping the Tempo it already cost', () => {
    let s = onTurn(3);
    const target = s.battle!.combatants.find((c) => c.side === 'enemy')!.id;
    s = reduce(s, { type: 'BATTLE_FORK', actor: 'player', ability: 'strike', target });
    const spentTempo = s.battle!.tempo;
    s = reduce(s, { type: 'BATTLE_FORK_DISCARD' });
    expect(s.battle!.fork).toBeNull();
    expect(s.battle!.tempo).toBe(spentTempo);
    expect(current(s.battle!)?.threads).toBe(2);
  });
});

describe("Mara's contracts", () => {
  /** A 2064 battle with Mara in the party and a clear turn for her. */
  function withMara(seed = 11, enc = 'halden_2064_terrace', diplomacy = false): GameState {
    let s = reduce(newGame(seed), { type: 'RECRUIT', character: 'mara' });
    if (diplomacy) {
      s = { ...s, party: { ...s.party, mara: { ...s.party.mara, skillPoints: 9 } } };
      s = run(s,
        { type: 'UNLOCK_NODE', character: 'mara', node: 'm_dip_1' },
        { type: 'UNLOCK_NODE', character: 'mara', node: 'm_dip_2' },
        { type: 'UNLOCK_NODE', character: 'mara', node: 'm_dip_4' });
    }
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: enc, surprise: false });
    let guard = 30;
    while (guard-- > 0 && current(s.battle!)?.id !== 'mara') {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    return s;
  }

  it('makes a bound enemy take more and deal less', () => {
    const s = withMara();
    expect(current(s.battle!)?.id).toBe('mara');
    const foe = s.battle!.combatants.find((c) => c.side === 'enemy' && !c.down)!;
    // Kinetic lands on the shield first, so measure the whole pool.
    const hpOf = (b: typeof s.battle) => { const c = b!.combatants.find((x) => x.id === foe.id)!; return c.hp + c.shield; };
    const plain = hpOf(s.battle) - hpOf(resolveAbility(s.battle!, 'mara', 'strike', foe.id, content));
    const bound = reduce(s, { type: 'BATTLE_ABILITY', actor: 'mara', ability: 'terms', target: foe.id });
    expect(bound.battle!.combatants.find((c) => c.id === foe.id)!.statuses.some((st) => st.id === 'bound')).toBe(true);
    const inBreach = hpOf(bound.battle) - hpOf(resolveAbility(bound.battle!, 'mara', 'strike', foe.id, content));
    expect(inBreach, 'a bound enemy takes more').toBeGreaterThan(plain);

    // ...and hits back softer, because breaching the terms costs it.
    const auditorHp = (b: typeof s.battle) => b!.combatants.find((c) => c.id === 'player')!.hp;
    const armed = (b: typeof s.battle) => ({ ...b!, combatants: b!.combatants.map((c) => (c.id === foe.id ? { ...c, threads: 3 } : c)) });
    const free = auditorHp(s.battle) - auditorHp(resolveAbility(armed(s.battle), foe.id, 'drone_dart', 'player', content));
    const held = auditorHp(bound.battle) - auditorHp(resolveAbility(armed(bound.battle), foe.id, 'drone_dart', 'player', content));
    expect(held, 'a bound enemy deals less').toBeLessThan(free);
  });

  it('ends the fight when Settlement is called and every enemy is bound', () => {
    let s = withMara(11, 'halden_2064_terrace', true);
    // Bind everything on the field, ending turns as Mara runs out of threads.
    let guard = 40;
    while (guard-- > 0) {
      const loose = s.battle!.combatants.filter((c) => c.side === 'enemy' && !c.down && !c.statuses.some((st) => st.id === 'bound'));
      if (!loose.length) break;
      const actor = current(s.battle!);
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      if (actor?.id !== 'mara' || actor.threads < 1) { s = reduce(s, { type: 'BATTLE_END_TURN', actor: actor!.id }); continue; }
      s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'mara', ability: 'terms', target: loose[0].id });
    }
    expect(s.battle!.combatants.filter((c) => c.side === 'enemy' && !c.down).every((c) => c.statuses.some((st) => st.id === 'bound'))).toBe(true);
    // Get Mara a fresh turn with three threads, then settle.
    guard = 40;
    while (guard-- > 0 && !(current(s.battle!)?.id === 'mara' && current(s.battle!)!.threads >= 3)) {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'mara', ability: 'settlement', target: 'mara' });
    expect(s.battle!.phase).toBe('won');
    expect(s.battle!.combatants.filter((c) => c.side === 'enemy').every((c) => c.parleyed)).toBe(true);
  });

  it('refuses to settle while anything on the field is unbound', () => {
    let s = withMara(11, 'halden_2064_terrace', true);
    let guard = 40;
    while (guard-- > 0 && !(current(s.battle!)?.id === 'mara' && current(s.battle!)!.threads >= 3)) {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'mara', ability: 'settlement', target: 'mara' });
    expect(s.battle!.phase).not.toBe('won');
    expect(s.battle!.log.some((l) => /not bound to anything/.test(l.text))).toBe(true);
  });
});

describe("Hale's held shot", () => {
  /** A 2148 Basin battle with Hale on the field and his release abilities in hand. */
  function withHale(seed = 21, enc = 'basin_2148_racks'): GameState {
    let s = reduce(newGame(seed), { type: 'RECRUIT', character: 'hale' });
    s = { ...s, party: { ...s.party, hale: { ...s.party.hale, skillPoints: 12 } } };
    s = run(s,
      { type: 'UNLOCK_NODE', character: 'hale', node: 'h_long_1' },
      { type: 'UNLOCK_NODE', character: 'hale', node: 'h_long_2' },
      { type: 'UNLOCK_NODE', character: 'hale', node: 'h_rec_1' },
      { type: 'UNLOCK_NODE', character: 'hale', node: 'h_rec_2' },
      { type: 'UNLOCK_NODE', character: 'hale', node: 'h_rec_3' },
      { type: 'UNLOCK_NODE', character: 'hale', node: 'h_rec_5' });
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: enc, surprise: false });
    let guard = 40;
    while (guard-- > 0 && current(s.battle!)?.id !== 'hale') {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    return s;
  }
  const onHale = (s: GameState) => s.battle!.combatants.find((c) => c.id === 'hale')!;
  const holds = (s: GameState) => onHale(s).statuses.filter((st) => st.id === 'held').length;

  it('stacks a charge across turns and pays it into the shot', () => {
    // The Basin plant floor: shielded, but nothing there shrugs off Kinetic.
    let s = withHale(21, 'basin_2064_plant');
    expect(current(s.battle!)?.id).toBe('hale');
    const foe = s.battle!.combatants.find((c) => c.side === 'enemy' && !c.down && !c.immunities.includes('kinetic'))!;
    const pool = (b: typeof s.battle) => { const c = b!.combatants.find((x) => x.id === foe.id)!; return c.hp + c.shield; };

    const cold = pool(s.battle) - pool(resolveAbility(s.battle!, 'hale', 'longshot', foe.id, content));
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'hale', ability: 'hold', target: 'hale' });
    expect(holds(s), 'one turn of holding').toBe(1);
    const charged = pool(s.battle) - pool(resolveAbility(s.battle!, 'hale', 'longshot', foe.id, content));
    expect(charged, 'a held shot hits harder').toBeGreaterThan(cold);

    // Firing spends the whole charge, hit or miss.
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'hale', ability: 'longshot', target: foe.id });
    expect(holds(s), 'the charge is gone').toBe(0);
  });

  it('carries the charge between turns rather than losing it at end of turn', () => {
    let s = withHale();
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'hale', ability: 'hold', target: 'hale' });
    s = reduce(s, { type: 'BATTLE_END_TURN', actor: 'hale' });
    let guard = 40;
    while (guard-- > 0 && current(s.battle!)?.id !== 'hale') {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      if (s.battle!.phase === 'won' || s.battle!.phase === 'lost') break;
      s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    expect(holds(s), 'still held a round later').toBeGreaterThanOrEqual(1);
  });

  it('lets Killing Silence through armor, shields and immunity alike', () => {
    let s = withHale();
    // The buried racks are immune to Kinetic and carry a shield; Longshot is kinetic.
    const rack = s.battle!.combatants.find((c) => c.side === 'enemy' && c.immunities.includes('kinetic'))!;
    const blocked = resolveAbility(s.battle!, 'hale', 'longshot', rack.id, content);
    expect(blocked.combatants.find((c) => c.id === rack.id)!.hp, 'immune to the ordinary shot').toBe(rack.hp);
    expect(blocked.log.some((l) => /immune/.test(l.text))).toBe(true);

    const silenced = resolveAbility(s.battle!, 'hale', 'killing_silence', rack.id, content);
    const after = silenced.combatants.find((c) => c.id === rack.id)!;
    expect(after.hp, 'nothing on the field was asked').toBeLessThan(rack.hp);
    expect(silenced.log.some((l) => /nothing on the field was asked/.test(l.text))).toBe(true);
    void s;
  });
});

describe('the other two Tempo abilities', () => {
  /** A battle with Tempo banked and the party fresh off a turn. */
  function withTempo(tempo: number, seed = 55): GameState {
    let s = reduce(newGame(seed), { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    while (s.battle!.phase === 'enemy') s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
    return { ...s, battle: { ...s.battle!, tempo } };
  }

  it('calls another era of someone in, benched or not, once per battle', () => {
    let s = withTempo(12);
    s = { ...s, world: { ...s.world, visitedEras: ['2312', '2148'] as EraId[] } };
    const before = s.battle!.combatants.length;
    s = reduce(s, { type: 'BATTLE_ECHO', character: 'dax' });
    expect(s.battle!.combatants).toHaveLength(before + 1);
    const ghost = s.battle!.combatants.at(-1)!;
    expect(ghost.side).toBe('party');
    expect(ghost.echoOf).toBe('dax');
    expect(ghost.temporary, 'they are gone after a round').toBe(true);
    expect(s.battle!.tempo).toBe(12 - content.rules.echo.cost);
    expect(s.battle!.entropy).toBe(entropyCost(content.rules.echo.entropy));
    expect(() => reduce(s, { type: 'BATTLE_ECHO', character: 'wren' })).toThrow(/One Echo/);
  });

  it('will not call an era the party has never been to', () => {
    const s = { ...withTempo(12), world: { ...withTempo(12).world, visitedEras: ['2312'] as EraId[] } };
    expect(() => reduce(s, { type: 'BATTLE_ECHO', character: 'dax' })).toThrow();
  });

  it('banks the fight with Collapse and resumes from it instead of losing', () => {
    let s = withTempo(12);
    s = reduce(s, { type: 'BATTLE_COLLAPSE' });
    expect(s.battle!.collapsePoint, 'the state is banked').not.toBeNull();
    expect(s.battle!.tempo).toBe(12 - content.rules.collapse.cost);
    const bankedHp = s.battle!.combatants.filter((c) => c.side === 'party').map((c) => c.hp);

    // Leave the party on one Resolve each and let the enemy actually finish them. A wipe is
    // detected when a hit lands, so the bank has to be spent there and not anywhere else.
    s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.side === 'party' ? { ...c, hp: 1 } : c)) } };
    let guard = 60;
    while (guard-- > 0 && !s.battle!.collapseUsed && s.battle!.phase !== 'lost' && s.battle!.phase !== 'won') {
      if (s.battle!.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
      s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    }
    expect(s.battle!.phase).not.toBe('lost');
    expect(s.battle!.combatants.filter((c) => c.side === 'party').map((c) => c.hp)).toEqual(bankedHp);
    expect(s.battle!.combatants.some((c) => c.side === 'party' && !c.down), 'the party is standing again').toBe(true);
    expect(s.battle!.collapseUsed).toBe(true);
    expect(s.battle!.collapsePoint, 'and it is spent').toBeNull();
    expect(s.battle!.log.some((l) => /collapses back/.test(l.text))).toBe(true);
  });

  it('only banks once, and only with the Tempo for it', () => {
    let s = withTempo(12);
    s = reduce(s, { type: 'BATTLE_COLLAPSE' });
    expect(() => reduce(s, { type: 'BATTLE_COLLAPSE' })).toThrow(/already banked/);
    expect(() => reduce(withTempo(2), { type: 'BATTLE_COLLAPSE' })).toThrow(/needs 5 Tempo/i);
  });
});

describe('a fight nobody can answer', () => {
  it('is already lost when the party walks in with nobody standing', () => {
    // Reported from a real run: a solo Auditor at zero Resolve time-jumped into a surprise
    // ambush. Nothing could act, nothing could die, and the enemy cycled its turn forever.
    let s = newGame(31);
    s = { ...s, activeParty: ['player'], party: { ...s.party, player: { ...s.party.player, hp: 0 } } };
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2148_ambush', surprise: true });
    expect(s.battle?.phase, 'the fight should resolve at once, not spin').toBe('lost');
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.screen.id).toBe('gameOver');
  });

  it('never leaves a won fight with the whole party at zero', () => {
    let s = newGame(32);
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    // Win it with everyone flat on the floor.
    const b = s.battle!;
    s = { ...s, battle: { ...b, phase: 'won', pendingRewards: { xp: 0, currency: 0, items: [], flags: [], levelUps: [] },
      combatants: b.combatants.map((c) => (c.side === 'party' ? { ...c, hp: 0, down: true } : { ...c, hp: 0, down: true })) } };
    s = reduce(s, { type: 'BATTLE_FINISH' });
    for (const id of s.activeParty) {
      expect(s.party[id].hp, `${id} should be standing, barely`).toBeGreaterThan(0);
    }
  });

  it('still records a loss as a loss, without reviving anyone', () => {
    let s = newGame(33);
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    const b = s.battle!;
    s = { ...s, battle: { ...b, phase: 'lost',
      combatants: b.combatants.map((c) => (c.side === 'party' ? { ...c, hp: 0, down: true } : c)) } };
    s = reduce(s, { type: 'BATTLE_FINISH' });
    expect(s.screen.id).toBe('gameOver');
    expect(s.party.player.hp).toBe(0);
    // And the way back out of a loss puts the party on its feet.
    s = reduce(s, { type: 'GAME_OVER_RETURN' });
    expect(s.party.player.hp).toBeGreaterThan(0);
  });
});
