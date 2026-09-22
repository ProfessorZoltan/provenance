import { getContent } from '../src/content/loader';
import type { Action } from '../src/core/actions';
import { abilityOptions, validTargets } from '../src/core/battle/battle';
import { createReducer, initialState } from '../src/core/reducer';
import type { GameState } from '../src/types/state';

export const content = getContent();
export const reduce = createReducer(content);

/**
 * A new game past the prologue, at Kell with the party met. Tests that want the prologue itself
 * use `newRun` and walk it.
 */
export function newGame(seed = 12345, lean: 'cinder' | 'choir' | 'commons' = 'commons'): GameState {
  return reduce(newRun(seed, lean), { type: 'PROLOGUE_SKIP' });
}

/** A brand new game, standing in the Allocation Office with the quarter open. */
export function newRun(seed = 12345, lean: 'cinder' | 'choir' | 'commons' = 'commons'): GameState {
  // Past the five opening frames: `opening()` is where those are tested.
  return reduce(opening(seed, lean), { type: 'INTRO_SKIP' });
}

/** A brand new game at the very first frame, before the Auditor has been asked to doubt anything. */
export function opening(seed = 12345, lean: 'cinder' | 'choir' | 'commons' = 'commons'): GameState {
  return reduce(initialState(), { type: 'NEW_GAME', seed, lean });
}

/** What an Entropy price costs once the exchange scale is applied, the way the engine charges it. */
export function entropyCost(amount: number): number {
  return Math.round(amount * content.rules.damageScale);
}

export function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce((s, a) => reduce(s, a), state);
}

/** Skip through any open dialogue, taking choice `pick` whenever one appears. */
export function skipDialogue(state: GameState, pick = 0, guard = 100): GameState {
  while (state.dialogue && guard-- > 0) {
    const line = content.dialogues[state.dialogue.id].lines[state.dialogue.index];
    if (line.choices?.length) state = reduce(state, { type: 'DIALOGUE_CHOOSE', index: pick });
    else state = reduce(state, { type: 'DIALOGUE_ADVANCE' });
    if (state.screen.id === 'battle') break;
  }
  return state;
}

/**
 * Play a battle to the end as a competent player would: heal whoever is badly hurt, otherwise
 * spend the biggest affordable action on something it can actually damage, preferring a weakness.
 * Not an optimal player — it never Forks, Rewinds or Guards — but it does read the type chart,
 * which is the bar the balance suite tunes against.
 */
export function autoBattle(state: GameState, policy?: (s: GameState) => Action | null, guard = 2000): GameState {
  while (state.battle && state.battle.phase !== 'won' && state.battle.phase !== 'lost' && guard-- > 0) {
    const b = state.battle;
    if (b.phase === 'enemy') { state = reduce(state, { type: 'BATTLE_ENEMY_ACT' }); continue; }
    const actor = b.combatants.find((c) => c.id === b.order[b.turnIndex]);
    if (!actor || actor.side !== 'party') { state = reduce(state, { type: 'BATTLE_ENEMY_ACT' }); continue; }
    const custom = policy?.(state);
    if (custom) { state = reduce(state, custom); continue; }
    const foes = b.combatants.filter((c) => c.side === 'enemy' && !c.down);
    if (!foes.length) break;
    const options = abilityOptions(b, actor.id, content);
    const afford = (id: string) => !!options.find((o) => o.ability.id === id)?.usable;
    const hurt = b.combatants.filter((c) => c.side === 'party' && !c.down)
      .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    let act: Action | null = null;
    if (hurt && hurt.hp / hurt.maxHp < 0.45) {
      const heal = actor.abilities.find((a) => afford(a) && !!content.abilities[a].heal);
      if (heal) act = { type: 'BATTLE_ABILITY', actor: actor.id, ability: heal, target: hurt.id };
    }
    if (!act) {
      let best: { ability: string; target: string; score: number } | null = null;
      for (const a of actor.abilities) {
        const def = content.abilities[a];
        if (!def?.damageType || !afford(a)) continue;
        // A competent player reads the board: someone standing between takes every single hit.
        for (const f of validTargets(b, actor.id, def).filter((c) => c.side === 'enemy')) {
          if (f.immunities.includes(def.damageType)) continue;
          if (def.damageType === 'signal' && !f.machine) continue;
          const score = def.cost * 10 + (f.weakness === def.damageType ? 25 : 0) - f.hp / 20;
          if (!best || score > best.score) best = { ability: a, target: f.id, score };
        }
      }
      if (best) act = { type: 'BATTLE_ABILITY', actor: actor.id, ability: best.ability, target: best.target };
    }
    if (!act) act = { type: 'BATTLE_END_TURN', actor: actor.id };
    try { state = reduce(state, act); } catch { state = reduce(state, { type: 'BATTLE_END_TURN', actor: actor.id }); }
  }
  return state;
}
