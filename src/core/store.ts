import type { Action } from './actions';
import type { GameState } from '../types/state';

export type Reducer = (state: GameState, action: Action) => GameState;
export type Listener = (state: GameState, action: Action | null) => void;

export interface Store {
  getState(): GameState;
  dispatch(action: Action): GameState;
  subscribe(l: Listener): () => void;
  history(): Action[];
  lastError(): Error | null;
}

/** Single immutable store. Every mutation is an action; the action log lets a battle be replayed. */
export function createStore(reducer: Reducer, initial: GameState, maxHistory = 500): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  const actions: Action[] = [];
  let error: Error | null = null;
  return {
    getState: () => state,
    dispatch(action) {
      try {
        state = reducer(state, action);
        error = null;
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        console.warn(`[store] ${action.type} rejected: ${error.message}`);
        return state;
      }
      actions.push(action);
      if (actions.length > maxHistory) actions.shift();
      for (const l of listeners) l(state, action);
      return state;
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    history: () => [...actions],
    lastError: () => error,
  };
}
