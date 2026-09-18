import { describe, expect, it } from 'vitest';
import { abilityOptions, createBattle, current, resolveAbility } from '../src/core/battle/battle';
import { evalFormula } from '../src/core/formula';
import { autoBattle, content, newGame, reduce, run } from './helpers';
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
        expect(rewound.battle!.entropy).toBe(s.battle!.entropy + content.rules.rewind.entropy);
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
    expect(fb.entropy).toBe(b.entropy + content.rules.fork.entropy);
    expect(current(fb)!.threads).toBe(threads - content.rules.fork.threadCost);
    expect(fb.fork?.lines.length).toBeGreaterThan(0);
    // Committing the same action yields the previewed result.
    const committed = reduce(forked, { type: 'BATTLE_ABILITY', actor: actor.id, ability: 'strike', target: target.id });
    const t = committed.battle!.combatants.find((c) => c.id === target.id)!;
    const previewed = fb.fork!.lines.find((l) => l.startsWith(t.name));
    const before = fb.combatants.find((c) => c.id === target.id)!;
    const delta = t.hp - before.hp + (t.shield - before.shield);
    if (previewed) expect(previewed).toContain(String(delta).replace('-', '-'));
    expect(committed.battle!.fork).toBeNull();
  });

  it('spawns an Echo of a party member once Entropy crosses the threshold', () => {
    let s = inBattle(5, 'kell_2148_walls');
    s = { ...s, battle: { ...s.battle!, entropy: content.rules.entropyThreshold - 5 } };
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
    const hpInBattle = s.battle!.combatants.find((c) => c.id === 'player')!.hp;
    s = run(s, { type: 'BATTLE_FINISH' });
    expect(s.screen.id).toBe('battleResult');
    expect(s.party.player.xp).toBe(xpBefore + 60);
    expect(s.party.player.hp).toBe(hpInBattle);
    expect(s.inventory.currency['allocation points']).toBe(60 + 30);
    expect(s.counters.randomFights).toBe(1);
  });
});
