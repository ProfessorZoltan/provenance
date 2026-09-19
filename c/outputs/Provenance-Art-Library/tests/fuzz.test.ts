import { describe, expect, it } from 'vitest';
import { current, validTargets } from '../src/core/battle/battle';
import { rngFloat, nextRng } from '../src/core/rng';
import { content, newGame, reduce } from './helpers';
import type { Action } from '../src/core/actions';
import type { GameState } from '../src/types/state';

/** Random but valid battle actions, including items, Fork and Rewind, to shake out hangs and throws. */
function fuzzBattle(seed: number, enc: string, surprise: boolean): { s: GameState; steps: number } {
  let s = reduce(newGame(seed), { type: 'START_ENCOUNTER', encounterId: enc, surprise });
  s = { ...s, inventory: { ...s.inventory, items: { ration: 3, stim: 2, anchor_charm: 1 } } };
  let r = seed;
  const rnd = () => { r = nextRng(r); return rngFloat(r); };
  let steps = 0;
  while (s.battle && s.battle.phase !== 'won' && s.battle.phase !== 'lost' && steps < 600) {
    steps++;
    const b = s.battle;
    if (b.phase === 'enemy') { s = reduce(s, { type: 'BATTLE_ENEMY_ACT' }); continue; }
    const actor = current(b)!;
    const roll = rnd();
    let action: Action;
    if (roll < 0.08 && b.rewindPoint && b.rewindsLeft > 0 && b.tempo >= 3) action = { type: 'BATTLE_REWIND' };
    else if (roll < 0.14) action = { type: 'BATTLE_END_TURN', actor: actor.id };
    else if (roll < 0.22 && actor.threads >= 1) {
      const items = Object.entries(s.inventory.items).filter(([, n]) => n > 0);
      const pick = items[Math.floor(rnd() * items.length)];
      const item = pick ? pick[0] : null;
      const revive = !!content.items[item ?? '']?.effect?.revive;
      const allies = b.combatants.filter((c) => c.side === 'party' && (revive ? c.down : !c.down));
      if (!item || !allies.length) action = { type: 'BATTLE_END_TURN', actor: actor.id };
      else action = { type: 'BATTLE_ITEM', actor: actor.id, item, target: allies[Math.floor(rnd() * allies.length)].id };
    } else {
      const abilities = actor.abilities.filter((a) => content.abilities[a].cost <= actor.threads);
      if (!abilities.length) { action = { type: 'BATTLE_END_TURN', actor: actor.id }; }
      else {
        const ab = content.abilities[abilities[Math.floor(rnd() * abilities.length)]];
        const targets = validTargets(b, actor.id, ab);
        const target = targets.length ? targets[Math.floor(rnd() * targets.length)].id : null;
        const fork = roll < 0.35 && b.tempo >= 2 && actor.threads > ab.cost;
        action = fork ? { type: 'BATTLE_FORK', actor: actor.id, ability: ab.id, target } : { type: 'BATTLE_ABILITY', actor: actor.id, ability: ab.id, target };
      }
    }
    try {
      s = reduce(s, action);
    } catch (e) {
      // Only "expected" rejections are allowed: immune/invalid target style errors are bugs in the fuzzer, not the game.
      throw new Error(`seed ${seed} step ${steps} ${action.type}: ${(e as Error).message}`);
    }
  }
  return { s, steps };
}

describe('battle fuzz', () => {
  for (const enc of ['kell_2148_ambush', 'kell_2148_walls', 'kell_2148_chapel', 'kell_2312_gate', 'kell_2312_perimeter']) {
    it(`${enc} never hangs or throws across seeds`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        const { s, steps } = fuzzBattle(seed * 7919, enc, enc === 'kell_2148_ambush');
        expect(steps, `${enc} seed ${seed} ran away`).toBeLessThan(600);
        expect(['won', 'lost']).toContain(s.battle?.phase);
      }
    }, 20000);
  }
});
