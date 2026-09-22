// Player styles for the difficulty simulator. Each is a policy: given the state on a party turn,
// the action that kind of player takes. They run through the real reducer, so anything a player can
// do they can do, and nothing else.
import { abilityOptions, alive, current, hasStatus, itemNeedsTarget, relay, resolveAbility, useItem, validTargets } from '../../src/core/battle/battle';
import type { Action } from '../../src/core/actions';
import { rngFloat } from '../../src/core/rng';
import { nerveCost } from '../../src/core/stats';
import type { AbilityDef } from '../../src/types/content';
import type { BattleState, Combatant, GameState } from '../../src/types/state';
import { autoBattle, content, reduce } from '../helpers';

export type Policy = (s: GameState, noise: () => number) => Action | null;

const usable = (b: BattleState, actor: Combatant) =>
  abilityOptions(b, actor.id, content).filter((o) => o.usable && actor.abilities.concat('parley').includes(o.ability.id)).map((o) => o.ability);

const end = (actor: Combatant): Action => ({ type: 'BATTLE_END_TURN', actor: actor.id });
const cast = (actor: Combatant, a: AbilityDef, target: Combatant | null): Action => ({ type: 'BATTLE_ABILITY', actor: actor.id, ability: a.id, target: target?.id ?? null });

function targetFor(b: BattleState, actor: Combatant, a: AbilityDef, pick: (ts: Combatant[]) => Combatant): Combatant | null | undefined {
  if (a.target === 'allEnemies' || a.target === 'allAllies') return null;
  if (a.target === 'self') return actor;
  const ts = validTargets(b, actor.id, a);
  return ts.length ? pick(ts) : undefined;
}

/** Someone who presses buttons: any usable action, any legal target, and ends the turn now and then. */
export const novice: Policy = (s, noise) => {
  const b = s.battle!; const actor = current(b)!;
  const opts = usable(b, actor);
  if (!opts.length || noise() < 0.12) return end(actor);
  const a = opts[Math.floor(noise() * opts.length)];
  const t = targetFor(b, actor, a, (ts) => ts[Math.floor(noise() * ts.length)]);
  return t === undefined ? end(actor) : cast(actor, a, t);
};

/** Hits the nearest thing with the biggest attack. Heals only when someone is nearly down. No items, no Tempo. */
export const basher: Policy = (s) => {
  const b = s.battle!; const actor = current(b)!;
  const opts = usable(b, actor);
  const party = alive(b, 'party');
  const dying = party.find((c) => c.hp < c.maxHp * 0.25);
  const heal = opts.find((a) => a.heal);
  if (dying && heal) return cast(actor, heal, heal.target === 'ally' ? dying : null);
  const attacks = opts.filter((a) => a.damageType).sort((x, y) => y.cost - x.cost);
  for (const a of attacks) {
    const t = targetFor(b, actor, a, (ts) => ts[0]);
    if (t !== undefined) return cast(actor, a, t);
  }
  return end(actor);
};

// ---------- the tactician: one step of lookahead over everything on offer ----------

const GOOD = ['guard', 'taunt', 'inspired', 'anchored', 'fixed', 'faraday', 'held'];

/** How good a board is for the party, as a number. Used only to compare boards one action apart. */
function value(b: BattleState): number {
  if (b.phase === 'won') return 1e6;
  if (b.phase === 'lost') return -1e6;
  const foes = b.combatants.filter((c) => c.side === 'enemy');
  const party = b.combatants.filter((c) => c.side === 'party' && !c.temporary);
  let v = 0;
  // Everything the enemy side still has to lose, second bars included, against what it started with.
  const core = (f: Combatant) => (f.bar === 1 && content.enemies[f.ref]?.secondBar ? Math.round(content.enemies[f.ref].secondBar!.resolve * (f.stand ?? 1)) : 0);
  const left = (f: Combatant) => (f.down ? 0 : f.hp + f.shield + core(f));
  const total = Math.max(1, foes.reduce((t, f) => t + (f.maxHp + f.maxShield + core(f)), 0));
  v -= 1200 * foes.reduce((t, f) => t + left(f), 0) / total;
  for (const f of foes) {
    if (f.down) { v += 150; continue; }
    if (hasStatus(f, 'marked')) v += 18;
    if (hasStatus(f, 'bound')) v += 22;
    if (hasStatus(f, 'locked')) v += 6;
    if (hasStatus(f, 'charging')) v -= 30;
  }
  for (const p of party) {
    if (p.down) { v -= 260; continue; }
    const frac = p.hp / p.maxHp;
    v += 160 * Math.min(frac, 0.85) + (frac < 0.3 ? -80 : 0);
    v += new Set(p.statuses.filter((st) => GOOD.includes(st.id)).map((st) => st.id)).size * 6;
    v += p.nerve * 1.5;
  }
  v += b.tempo * 0.6 - Math.max(0, b.entropy - 75) * 1.5;
  return v;
}

interface Move { action: Action; next: BattleState }

function moves(s: GameState): Move[] {
  const b = s.battle!; const actor = current(b)!;
  const out: Move[] = [];
  const tryIt = (action: Action, f: () => BattleState) => { try { out.push({ action, next: f() }); } catch { /* not legal */ } };
  for (const a of usable(b, actor)) {
    const ts = a.target === 'allEnemies' || a.target === 'allAllies' ? [null] : a.target === 'self' ? [actor] : validTargets(b, actor.id, a);
    for (const t of ts) tryIt(cast(actor, a, t), () => resolveAbility(b, actor.id, a.id, t?.id ?? null, content));
  }
  if (!actor.itemUsed) {
    for (const [id, n] of Object.entries(s.inventory.items)) {
      const def = content.items[id];
      if (n <= 0 || def?.kind !== 'consumable' || !def.effect) continue;
      const ts = itemNeedsTarget(def) ? b.combatants.filter((c) => c.side === 'party' && (def.effect!.revive ? c.down : !c.down)) : [actor];
      for (const t of ts) tryIt({ type: 'BATTLE_ITEM', actor: actor.id, item: id, target: t.id }, () => useItem(b, actor.id, def, t.id, content));
    }
  }
  if (actor.id !== 'player' && actor.threads >= content.rules.relay.threadCost) {
    for (const id of Object.keys(s.party)) {
      if (b.combatants.some((c) => c.id === id) || s.party[id].hp <= 0) continue;
      const hurt = actor.hp < actor.maxHp * 0.3;
      if (!hurt) continue;
      tryIt({ type: 'BATTLE_RELAY', actor: actor.id, incoming: id }, () => {
        const waiting = b.reserve.find((c) => c.id === id);
        return relay(b, actor.id, waiting ?? reduce(s, { type: 'BATTLE_RELAY', actor: actor.id, incoming: id }).battle!.combatants.find((c) => c.id === id)!, b.passives[id] ?? {}, content);
      });
    }
  }
  return out;
}

/** Reads the board one action ahead, every option, items and Relay included, and takes the best. */
export const tactician: Policy = (s) => {
  const b = s.battle!; const actor = current(b)!;
  // Answer the telegraph: a wound-up enemy aimed at someone fragile gets Bound or Locked first.
  const base = value(b);
  let best: Move | null = null; let bestV = -Infinity;
  for (const m of moves(s)) {
    const cost = m.action.type === 'BATTLE_ABILITY' ? nerveCost(content, content.abilities[m.action.ability]) : 0;
    const v = value(m.next) - cost * 2 - (m.action.type === 'BATTLE_ITEM' ? 8 : 0);
    if (v > bestV) { bestV = v; best = m; }
  }
  // Rewind a turn that went badly, if there is one to rewind.
  if (b.rewindPoint && b.rewindsLeft > 0 && b.tempo >= content.rules.rewind.cost) {
    const hurt = alive(b, 'party').some((c) => c.hp < c.maxHp * 0.2) || b.combatants.some((c) => c.side === 'party' && c.down && !c.temporary);
    if (hurt) return { type: 'BATTLE_REWIND' };
  }
  if (!best || bestV <= base - 1) return end(actor);
  return best.action;
};

/** Heals and buffs first, keeps everyone topped up, and only then hits. */
export const turtle: Policy = (s) => {
  const b = s.battle!; const actor = current(b)!;
  const opts = usable(b, actor);
  const party = alive(b, 'party');
  const hurt = party.filter((c) => c.hp < c.maxHp * 0.7).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  const heal = opts.find((a) => a.heal);
  if (hurt && heal) return cast(actor, heal, heal.target === 'ally' ? hurt : null);
  const buff = opts.find((a) => a.status && !a.damageType && (a.target === 'allAllies' || a.target === 'self') && !actor.statuses.some((st) => st.id === a.status!.id));
  if (buff && actor.threads > 1) return cast(actor, buff, buff.target === 'self' ? actor : null);
  return basher(s, () => 0.5);
};

/** The test suite's competent player: reads the type chart, heals at 45%. */
export const competent: Policy = () => null;

/**
 * An expert: plays the competent script, but looks one action ahead over everything on offer (items,
 * Relay, pair techs, the lot) and takes any move that leaves the board clearly better.
 */
export const expert: Policy = (s) => {
  const b = s.battle!;
  let plain: GameState | null = null;
  try { plain = autoBattle(s, undefined, 1); } catch { plain = null; }
  const plainV = plain?.battle ? value(plain.battle) : -Infinity;
  if (b.rewindPoint && b.rewindsLeft > 0 && b.tempo >= content.rules.rewind.cost) {
    const hurt = alive(b, 'party').some((c) => c.hp < c.maxHp * 0.2) || b.combatants.some((c) => c.side === 'party' && c.down && !c.temporary);
    if (hurt) return { type: 'BATTLE_REWIND' };
  }
  let best: Move | null = null; let bestV = -Infinity;
  for (const m of moves(s)) {
    const cost = m.action.type === 'BATTLE_ABILITY' ? nerveCost(content, content.abilities[m.action.ability]) : 0;
    const v = value(m.next) - cost * 2 - (m.action.type === 'BATTLE_ITEM' ? 8 : 0);
    if (v > bestV) { bestV = v; best = m; }
  }
  if (best && bestV > plainV + 40) return best.action;
  return null;
};

export const POLICIES: Record<string, Policy> = { novice, basher, competent, turtle, tactician, expert };

/** Uses one ability whenever it can, on whichever target it does most for; plays competently otherwise. */
export function spam(abilityId: string): Policy {
  return (s) => {
    const b = s.battle!; const actor = current(b)!;
    const a = usable(b, actor).find((x) => x.id === abilityId);
    if (!a) return null;
    const ts = a.target === 'allEnemies' || a.target === 'allAllies' ? [null] : a.target === 'self' ? [actor] : validTargets(b, actor.id, a);
    let best: Combatant | null | undefined; let bestV = -Infinity;
    for (const t of ts) {
      try { const v = value(resolveAbility(b, actor.id, a.id, t?.id ?? null, content)); if (v > bestV) { bestV = v; best = t; } } catch { /* not legal */ }
    }
    return best === undefined ? null : cast(actor, a, best);
  };
}

/** Seeded noise for a policy, so a run is repeatable. */
export function noiseFrom(seed: number): () => number {
  let x = seed | 0;
  return () => { x = (x + 0x6d2b79f5) | 0; return rngFloat(x); };
}
