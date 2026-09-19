import { describe, expect, it } from 'vitest';
import { conditionContext } from '../src/core/encounter';
import { loadout } from '../src/core/stats';
import { nodeAvailability, unlockNode } from '../src/core/tech';
import { content, newGame, reduce } from './helpers';

describe('tech tree', () => {
  it('unlocks a standard node, spends points and applies its effect', () => {
    const s = newGame();
    const ctx = conditionContext(content, s);
    const before = loadout(content, content.characters.player, s.party.player);
    const cs = unlockNode(content, s.party.player, 'p_enf_1', ctx);
    expect(cs.skillPoints).toBe(s.party.player.skillPoints - 1);
    const after = loadout(content, content.characters.player, cs);
    expect(after.stats.grit).toBe(before.stats.grit + 6);
  });

  it('enforces requirements', () => {
    const s = newGame();
    const ctx = conditionContext(content, s);
    expect(nodeAvailability(content, content.nodes.p_enf_2, s.party.player, ctx)).toMatchObject({ ok: false, reason: 'requires' });
  });

  it('a contradiction locks its opposite permanently', () => {
    const s = newGame();
    const ctx = conditionContext(content, s);
    let dax = { ...s.party.dax, skillPoints: 10 };
    dax = unlockNode(content, dax, 'd_wrk_1', ctx);
    dax = unlockNode(content, dax, 'd_wrk_2', ctx);
    expect(nodeAvailability(content, content.nodes.d_wrk_3, dax, ctx)).toMatchObject({ ok: false, reason: 'excluded' });
    expect(() => unlockNode(content, dax, 'd_wrk_3', ctx)).toThrow();
  });

  it('a condition node stays greyed out until its story condition is met', () => {
    let s = newGame();
    let ctx = conditionContext(content, s);
    const a = nodeAvailability(content, content.nodes.p_rec_3, s.party.player, ctx);
    expect(a).toMatchObject({ ok: false, reason: 'condition' });
    s = reduce(s, { type: 'TIME_JUMP', era: '2148' });
    ctx = conditionContext(content, s);
    expect(nodeAvailability(content, content.nodes.p_rec_3, s.party.player, ctx)).toEqual({ ok: true });
  });

  it('grants abilities through nodes', () => {
    const s = newGame();
    const ctx = conditionContext(content, s);
    const wren = unlockNode(content, s.party.wren, 'w_vig_1', ctx);
    expect(loadout(content, content.characters.wren, wren).abilities).toContain('vigil');
  });

  it('rejects unlocking through the reducer when points are short', () => {
    const s = newGame();
    const poor = { ...s, party: { ...s.party, player: { ...s.party.player, skillPoints: 0 } } };
    expect(() => reduce(poor, { type: 'UNLOCK_NODE', character: 'player', node: 'p_enf_1' })).toThrow();
  });
});
