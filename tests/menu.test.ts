import { describe, expect, it } from 'vitest';
import { gridStep } from '../src/ui/menu';

describe('menu focus movement', () => {
  it('steps and wraps in a single column', () => {
    expect(gridStep(0, 5, 1, 'up')).toBe(4);
    expect(gridStep(4, 5, 1, 'down')).toBe(0);
    expect(gridStep(2, 5, 1, 'left')).toBeNull();
  });

  // Seven items two wide:  0 1 / 2 3 / 4 5 / 6
  it('moves a row at a time in two columns, staying in the column', () => {
    expect(gridStep(1, 7, 2, 'down')).toBe(3);
    expect(gridStep(3, 7, 2, 'up')).toBe(1);
    expect(gridStep(5, 7, 2, 'down'), 'off the bottom of the right column wraps to its top').toBe(1);
    expect(gridStep(6, 7, 2, 'down')).toBe(0);
    expect(gridStep(0, 7, 2, 'up'), 'off the top of the left column wraps to its last row').toBe(6);
    expect(gridStep(1, 7, 2, 'up')).toBe(5);
  });

  it('reads left to right along the list, so every item is reachable', () => {
    expect(gridStep(1, 7, 2, 'right')).toBe(2);
    expect(gridStep(6, 7, 2, 'right')).toBe(0);
    expect(gridStep(0, 7, 2, 'left')).toBe(6);
    const seen = new Set<number>();
    for (let i = 0, n = 0; n < 7; n++, i = gridStep(i, 7, 2, 'right')!) seen.add(i);
    expect(seen.size).toBe(7);
  });
});
