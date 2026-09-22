import type { ContentDB, DifficultyId, EraId } from '../types/content';

/** A difficulty with every lever filled in: the preset where it says something, the base rule where it does not. */
export interface Difficulty {
  id: DifficultyId;
  name: string;
  blurb: string;
  enemyDamage: number;
  enemyResolve: number;
  restPerLevel: number;
  campsPerEra: number;
  rewinds: number;
  ruthless: number;
  echoGrace: number;
}

export const DIFFICULTIES: DifficultyId[] = ['story', 'standard', 'hard', 'audit'];

export function difficulty(content: ContentDB, id?: DifficultyId | null): Difficulty {
  const rules = content.rules;
  const key = id && rules.difficulty.presets[id] ? id : rules.difficulty.default;
  const p = rules.difficulty.presets[key];
  return {
    id: key, name: p.name, blurb: p.blurb,
    enemyDamage: p.enemyDamage ?? 1,
    enemyResolve: p.enemyResolve ?? 1,
    restPerLevel: p.restPerLevel ?? rules.rest.perLevel,
    campsPerEra: p.campsPerEra ?? rules.camp.perEra,
    rewinds: p.rewinds ?? rules.rewind.base,
    ruthless: p.ruthless ?? 0,
    echoGrace: p.echoGrace ?? 0,
  };
}

/** How much more Resolve an era's fights of a tier carry, before difficulty. */
export function eraScale(content: ContentDB, era: EraId, tier: 'ordinary' | 'hard' | 'key'): number {
  return content.rules.eraScale[era]?.[tier] ?? 1;
}
