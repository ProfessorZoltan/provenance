import type { GameState } from '../types/state';

export const SAVE_KEY = 'provenance.save.v1';
export const SAVE_VERSION = 1;

export function serialize(state: GameState): string {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state });
}

export function deserialize(text: string): GameState {
  const parsed = JSON.parse(text) as { version?: number; state?: GameState };
  if (parsed.version !== SAVE_VERSION || !parsed.state) throw new Error('Not a Provenance save file');
  const s = parsed.state;
  if (typeof s.seed !== 'number' || !s.party || !s.world || !Array.isArray(s.world.history)) {
    throw new Error('Save file is missing required fields');
  }
  return s;
}

export function saveToLocal(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocal(): GameState | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

export function hasLocalSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
