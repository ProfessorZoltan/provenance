// Deterministic PRNG. The state is a 32-bit integer stored in the game state, so every battle
// is replayable from its seed and reducers stay pure.

export function nextRng(state: number): number {
  return (state + 0x6d2b79f5) | 0;
}

export function rngFloat(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Advance the state and return [value in [0,1), newState]. */
export function roll(state: number): [number, number] {
  const next = nextRng(state);
  return [rngFloat(next), next];
}

export function rollInt(state: number, maxExclusive: number): [number, number] {
  const [v, s] = roll(state);
  return [Math.floor(v * maxExclusive), s];
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
