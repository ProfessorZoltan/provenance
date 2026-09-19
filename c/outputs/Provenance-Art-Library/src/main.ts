import { AudioEngine } from './audio/engine';
import { getContent } from './content/loader';
import { createReducer, initialState } from './core/reducer';
import { loadFromLocal, saveToLocal } from './core/save';
import { createStore } from './core/store';
import { Input } from './input/input';
import { createApp } from './ui/app';

const content = getContent();
const store = createStore(createReducer(content), initialState());
const input = new Input();
const audio = new AudioEngine();

// Autosave after the moments that matter: a battle result, a timeline edit, a quest turned in.
store.subscribe((state, action) => {
  if (!action || !state.started) return;
  if (action.type === 'BATTLE_FINISH' || action.type === 'TIMELINE_CHOICE' || action.type === 'QUEST_COMPLETE' || action.type === 'TIME_JUMP') {
    saveToLocal(state);
  }
});

const saved = loadFromLocal();
if (saved?.settings) store.dispatch({ type: 'SET_SETTINGS', settings: saved.settings });

createApp(store, content, input, audio);

// Debug hook: replay the action log, inspect state, dispatch by hand.
declare global {
  interface Window { provenance: { store: typeof store; content: typeof content; audio: AudioEngine } }
}
window.provenance = { store, content, audio };
