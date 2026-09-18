import { getContent } from '../src/content/loader';
import type { Action } from '../src/core/actions';
import { createReducer, initialState } from '../src/core/reducer';
import type { GameState } from '../src/types/state';

export const content = getContent();
export const reduce = createReducer(content);

export function newGame(seed = 12345, lean: 'cinder' | 'choir' | 'commons' = 'commons'): GameState {
  return reduce(initialState(), { type: 'NEW_GAME', seed, lean });
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

/** Play a battle to the end with a simple policy: each party member strikes the first living enemy. */
export function autoBattle(state: GameState, policy?: (s: GameState) => Action | null, guard = 400): GameState {
  while (state.battle && state.battle.phase !== 'won' && state.battle.phase !== 'lost' && guard-- > 0) {
    const b = state.battle;
    if (b.phase === 'enemy') { state = reduce(state, { type: 'BATTLE_ENEMY_ACT' }); continue; }
    const actor = b.combatants.find((c) => c.id === b.order[b.turnIndex])!;
    const custom = policy?.(state);
    if (custom) { state = reduce(state, custom); continue; }
    const enemy = b.combatants.find((c) => c.side === 'enemy' && !c.down);
    if (!enemy) break;
    const chronal = actor.abilities.find((a) => content.abilities[a].damageType === 'chronal');
    const usable = enemy.family === 'echo' && chronal && actor.threads >= content.abilities[chronal].cost ? chronal : 'strike';
    if (actor.threads >= content.abilities[usable].cost) state = reduce(state, { type: 'BATTLE_ABILITY', actor: actor.id, ability: usable, target: enemy.id });
    else state = reduce(state, { type: 'BATTLE_END_TURN', actor: actor.id });
  }
  return state;
}
