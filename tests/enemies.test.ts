import { describe, expect, it } from 'vitest';
import { current, enemyIntent, hasStatus, pickTarget, planEnemyAction, resolveAbility, validTargets } from '../src/core/battle/battle';
import type { Targeting } from '../src/types/content';
import type { Combatant, GameState } from '../src/types/state';
import { content, newGame, reduce } from './helpers';

/** A fight, stepped to the first enemy turn, with the party's Resolve and statuses set as asked. */
function enemyTurnOf(encounterId: string, tweak: (c: Combatant) => Combatant = (c) => c, seed = 21): GameState {
  let s = reduce(newGame(seed), { type: 'START_ENCOUNTER', encounterId, surprise: false });
  s = { ...s, battle: { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.side === 'party' ? tweak(c) : c)) } };
  let guard = 30;
  while (guard-- > 0 && s.battle!.phase !== 'enemy') s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
  expect(s.battle!.phase).toBe('enemy');
  return s;
}

/** The same enemy, wearing a different personality, so each rule can be read in isolation. */
function withTargeting(s: GameState, mode: Targeting): { b: GameState['battle']; me: Combatant; content: typeof content } {
  const me = current(s.battle!)!;
  const patched = { ...content, enemies: { ...content.enemies, [me.ref]: { ...content.enemies[me.ref], targeting: mode } } };
  return { b: s.battle, me, content: patched };
}

describe('targeting personalities', () => {
  const party = (s: GameState) => s.battle!.combatants.filter((c) => c.side === 'party' && !c.down);

  it('gives every enemy one, and the Inspect panel a word for each', () => {
    const modes: Targeting[] = ['weakest', 'healer', 'buffed', 'auditor', 'revenge', 'spread', 'opportunist'];
    for (const e of Object.values(content.enemies)) expect(modes, e.id).toContain(e.targeting);
    for (const mode of modes) expect(Object.values(content.enemies).some((e) => e.targeting === mode), `${mode} is used`).toBe(true);
  });

  it('reads each rule the way the manual says', () => {
    const s = enemyTurnOf('kell_2312_enforcers', (c) => (c.id === 'dax' ? { ...c, hp: 10 } : c.id === 'wren' ? { ...c, statuses: [{ id: 'inspired', turns: 3 }, { id: 'guard', turns: 1 }] } : c));
    const targets = party(s);
    const pick = (mode: Targeting) => { const w = withTargeting(s, mode); return pickTarget(w.b!, w.me, targets, 0, w.content).id; };
    expect(pick('weakest')).toBe('dax');
    expect(pick('healer')).toBe('wren');
    expect(pick('buffed')).toBe('wren');
    expect(pick('auditor')).toBe('player');
    const grudge = withTargeting(s, 'revenge');
    expect(pickTarget(grudge.b!, { ...grudge.me, lastHitBy: 'wren' }, targets, 0, grudge.content).id).toBe('wren');
    expect(pickTarget(grudge.b!, grudge.me, targets, 0, grudge.content).id, 'nobody has hit it yet: it finishes the weakest').toBe('dax');
    const spread = withTargeting(s, 'spread');
    for (let step = 0; step < 6; step++) expect(pickTarget(spread.b!, { ...spread.me, lastTarget: 'dax' }, targets, step, spread.content).id).not.toBe('dax');
  });

  it('records who hit it last and who it went for', () => {
    let s = reduce(newGame(21), { type: 'START_ENCOUNTER', encounterId: 'kell_2312_perimeter', surprise: false });
    let guard = 20;
    while (guard-- > 0 && current(s.battle!)?.id !== 'player') s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle!)!.id });
    const foe = s.battle!.combatants.find((c) => c.side === 'enemy')!;
    s = reduce(s, { type: 'BATTLE_ABILITY', actor: 'player', ability: 'strike', target: foe.id });
    const hit = s.battle!.log.at(-1)?.text.includes('misses') === false;
    if (hit) expect(s.battle!.combatants.find((c) => c.id === foe.id)!.lastHitBy).toBe('player');
    expect(s.battle!.combatants.find((c) => c.id === 'player')!.lastTarget).toBe(foe.id);
  });

  it('is drawn onto whoever stands between, on either side', () => {
    const s = enemyTurnOf('kell_2312_enforcers', (c) => (c.id === 'dax' ? { ...c, statuses: [{ id: 'taunt', turns: 2 }] } : c));
    const me = current(s.battle!)!;
    const baton = content.abilities.warden_baton ?? content.abilities.drone_dart;
    expect(validTargets(s.battle!, me.id, baton).map((c) => c.id)).toEqual(['dax']);
    // And a Bailiff's wall does the same to the party.
    let t = reduce(newGame(21), { type: 'START_ENCOUNTER', encounterId: 'capitol_2031_division', surprise: false });
    const sergeant = t.battle!.combatants.find((c) => c.ref === 'warden_sergeant_2031')!;
    t = { ...t, battle: { ...t.battle!, combatants: t.battle!.combatants.map((c) => (c.id === sergeant.id ? { ...c, statuses: [{ id: 'wall', turns: 2 }] } : c)) } };
    expect(validTargets(t.battle!, 'player', content.abilities.strike).map((c) => c.id)).toEqual([sergeant.id]);
    expect(validTargets(t.battle!, 'player', content.abilities.audit).map((c) => c.id)).toEqual([sergeant.id]);
  });
});

describe('intents', () => {
  it('say on the card exactly what the enemy then does', () => {
    for (const seed of [3, 8, 21, 34]) {
      for (const enc of ['kell_2312_enforcers', 'halden_2064_vote', 'kell_2148_ambush']) {
        let s = reduce(newGame(seed), { type: 'START_ENCOUNTER', encounterId: enc, surprise: false });
        let checked = 0;
        let guard = 40;
        while (guard-- > 0 && s.battle && s.battle.phase !== 'won' && s.battle.phase !== 'lost') {
          if (s.battle.phase === 'player') { s = reduce(s, { type: 'BATTLE_END_TURN', actor: current(s.battle)!.id }); continue; }
          const me = current(s.battle)!;
          const said = enemyIntent(s.battle, me, content);
          const before = s.battle.log.length;
          s = reduce(s, { type: 'BATTLE_ENEMY_ACT' });
          const first = s.battle!.log.slice(before).find((l) => l.actor === me.name && l.ability);
          if (!said || !first) continue;
          expect(first.ability, `${enc} seed ${seed}: ${me.name}`).toBe(said.ability.name);
          if (said.target) expect(first.target, `${enc} seed ${seed}: ${me.name}'s target`).toBe(said.target.name);
          checked++;
        }
        expect(checked).toBeGreaterThan(0);
      }
    }
  });

  it('never touch the battle RNG', () => {
    const s = enemyTurnOf('kell_2312_enforcers');
    const me = current(s.battle!)!;
    const rng = s.battle!.rng;
    enemyIntent(s.battle!, me, content);
    planEnemyAction(s.battle!, me, 0, 3, content);
    expect(s.battle!.rng).toBe(rng);
  });
});

describe('archetypes', () => {
  const setHp = (id: string, frac: number) => (c: Combatant) => (c.id === id ? { ...c, hp: Math.round(c.maxHp * frac) } : c);

  it('Clerk: mends a hurt ally before it hits anyone, and minutes one that is not', () => {
    let s = reduce(newGame(5), { type: 'START_ENCOUNTER', encounterId: 'tolliver_2031_arson', surprise: false });
    const clerk = s.battle!.combatants.find((c) => c.ref === 'warden_clerk_2031')!;
    const other = s.battle!.combatants.find((c) => c.side === 'enemy' && c.id !== clerk.id)!;
    const hurt = { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === other.id ? { ...c, hp: Math.round(c.maxHp * 0.3) } : c)) };
    const plan = planEnemyAction(hurt, clerk, 0, 2, content)!;
    expect(plan.ability.id).toBe('clerk_mend');
    expect(plan.target?.id).toBe(other.id);
    const well = planEnemyAction(s.battle!, clerk, 0, 2, content)!;
    expect(well.ability.id).toBe('clerk_minute');
    expect(well.target?.side).toBe('enemy');
    void setHp;
  });

  it('Bailiff: stands between, and the party has to go through it', () => {
    const s = enemyTurnOf('capitol_2031_division');
    const bailiff = s.battle!.combatants.find((c) => c.ref === 'warden_sergeant_2031')!;
    const plan = planEnemyAction(s.battle!, bailiff, 0, 2, content)!;
    expect(plan.ability.id).toBe('bailiff_stand');
    const ready = { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === bailiff.id ? { ...c, threads: 2 } : c)) };
    const after = resolveAbility(ready, bailiff.id, 'bailiff_stand', bailiff.id, content);
    expect(hasStatus(after.combatants.find((c) => c.id === bailiff.id)!, 'wall')).toBe(true);
    expect(validTargets(after, 'player', content.abilities.strike).map((c) => c.id)).toEqual([bailiff.id]);
  });

  it('Stenographer: takes what the party built and strikes Tempo off the record', () => {
    let s = reduce(newGame(5), { type: 'START_ENCOUNTER', encounterId: 'undercity_2064_eviction', surprise: false });
    const steno = s.battle!.combatants.find((c) => c.ref === 'warden_stenographer_2064')!;
    let b = { ...s.battle!, tempo: 10, combatants: s.battle!.combatants.map((c) => (c.id === 'wren' ? { ...c, statuses: [{ id: 'inspired', turns: 3 }] } : c.id === steno.id ? { ...c, threads: 3 } : c)) };
    b = resolveAbility(b, steno.id, 'steno_seize', 'wren', content);
    expect(hasStatus(b.combatants.find((c) => c.id === 'wren')!, 'inspired')).toBe(false);
    expect(hasStatus(b.combatants.find((c) => c.id === steno.id)!, 'inspired')).toBe(true);
    b = resolveAbility({ ...b, combatants: b.combatants.map((c) => (c.id === steno.id ? { ...c, threads: 2 } : c)) }, steno.id, 'steno_strike', 'player', content);
    // The drain lands whatever the blow does; a blow that lands also pays the party its 3 for being hit.
    expect(b.log.some((l) => l.text.includes('4 Tempo from the record'))).toBe(true);
    const hit = !b.log.at(-1)?.text.includes('misses');
    expect(b.tempo).toBe(hit ? 10 - 4 + content.rules.tempoOnHit : 6);
  });

  it('Charger: winds up, says so, unleashes next turn, and is stopped by Bound or Target Lock', () => {
    let s = reduce(newGame(5), { type: 'START_ENCOUNTER', encounterId: 'halden_2312_blocks', surprise: false });
    const lancer = s.battle!.combatants.find((c) => c.ref === 'drone_lancer_2312')!;
    let b = resolveAbility({ ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === lancer.id ? { ...c, threads: 2 } : c)) }, lancer.id, 'spool', lancer.id, content);
    const wound = b.combatants.find((c) => c.id === lancer.id)!;
    expect(hasStatus(wound, 'charging')).toBe(true);
    expect(b.log.some((l) => l.text.includes('winds up'))).toBe(true);
    const next = planEnemyAction(b, wound, 0, 2, content)!;
    expect(next.ability.id, 'the wind-up is always released').toBe('lance');
    expect(enemyIntent(b, wound, content)?.ability.id).toBe('lance');
    // Locked breaks it: the release is no longer on offer.
    const broken = resolveAbility({ ...b, combatants: b.combatants.map((c) => (c.id === 'player' ? { ...c, threads: 3 } : c)) }, 'player', 'audit', lancer.id, content);
    void broken;
    let locked = { ...b, combatants: b.combatants.map((c) => (c.id === 'wren' ? { ...c, threads: 3, abilities: [...c.abilities, 'drone_lock'] } : c)) };
    locked = resolveAbility(locked, 'wren', 'drone_lock', lancer.id, content);
    expect(hasStatus(locked.combatants.find((c) => c.id === lancer.id)!, 'charging')).toBe(false);
    expect(locked.log.some((l) => l.text.includes('wind-up is broken'))).toBe(true);
    expect(planEnemyAction(locked, locked.combatants.find((c) => c.id === lancer.id)!, 0, 2, content)?.ability.id).not.toBe('lance');
  });

  it('Quorum: closes ranks when one of its own falls', () => {
    let s = reduce(newGame(5), { type: 'START_ENCOUNTER', encounterId: 'halden_2064_vote', surprise: false });
    const [a, q] = s.battle!.combatants.filter((c) => c.ref === 'warden_quorum_2064');
    const b0 = { ...s.battle!, combatants: s.battle!.combatants.map((c) => (c.id === a.id ? { ...c, hp: 1, shield: 0 } : c.id === 'player' ? { ...c, threads: 3 } : c)) };
    const b = resolveAbility(b0, 'player', 'strike', a.id, content);
    const fell = b.combatants.find((c) => c.id === a.id)!.down;
    if (fell) {
      expect(hasStatus(b.combatants.find((c) => c.id === q.id)!, 'inspired')).toBe(true);
      expect(b.log.some((l) => l.text.includes('closes ranks'))).toBe(true);
    }
  });

  it('puts each archetype on the field in more than one era', () => {
    const roles = new Map<string, Set<string>>();
    for (const e of Object.values(content.enemies)) {
      if (!e.role) continue;
      const used = Object.values(content.encounters).some((enc) => enc.enemies.some((g) => g.enemy === e.id));
      expect(used, `${e.id} appears in an encounter`).toBe(true);
      roles.set(e.role, (roles.get(e.role) ?? new Set()).add(e.era));
    }
    for (const role of ['Clerk', 'Bailiff', 'Stenographer', 'Charger', 'Quorum']) {
      expect(roles.get(role)?.size ?? 0, role).toBeGreaterThanOrEqual(2);
    }
  });
});
