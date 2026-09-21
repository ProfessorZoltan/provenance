import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read rather than import: vitest intercepts a .css import and hands back a stub.
const css = readFileSync(fileURLToPath(new URL('../src/ui/styles.css', import.meta.url)), 'utf8');

/** The declarations inside one selector's block, as written. */
function rule(selector: string): string {
  const i = css.indexOf(selector.includes('{') ? selector : `${selector} {`);
  expect(i, `no rule for "${selector}"`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
}

describe('the screen container', () => {
  it('gives its row a definite height, so height:100% resolves', () => {
    // Left as the default `auto`, the row is content-sized: a screen asking for height:100% gets
    // `auto`, an SVG inside it falls back to its viewBox aspect ratio, and the row grows past
    // #screen's overflow:hidden. That is how the map's minimap ended up below the clip entirely.
    const r = rule('#screen');
    expect(r, '#screen must lay its child out in a row of known height').toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
    expect(r).toContain('overflow: hidden');
  });

  it('lets a screen shrink inside that row rather than forcing it open', () => {
    expect(rule('#screen > *')).toMatch(/min-height:\s*0/);
  });
});

describe('lists that can outgrow a short window', () => {
  // A panel bounded by the row but with no scroll region hides its own items: the menu's
  // scrollIntoView has nothing to scroll, so the focused row sits under the clip.
  for (const selector of ['.hub .actions', '.hub .party']) {
    it(`${selector} is bounded and scrolls`, () => {
      const r = rule(selector);
      expect(r, `${selector} must not grow past its row`).toMatch(/max-height:\s*100%/);
      expect(r, `${selector} must scroll what does not fit`).toMatch(/overflow-y:\s*auto/);
    });
  }
});

describe('the battle action list', () => {
  it('is sized from the window rather than a fixed guess', () => {
    // A fixed cap meant a short window showed two actions out of nine. The clamp scales with the
    // viewport, and the stage above it has its own min-height, so neither starves the other.
    const r = rule('.battle .actionmenu { display: flex');
    expect(r).toMatch(/max-height:\s*clamp\(/);
    expect(r).toMatch(/\d+vh/);
  });

  it('claws short-window room back from the chrome, not from the list', () => {
    // The two height queries used to cap .actionmenu outright; they tighten padding instead.
    const short = css.slice(css.indexOf('@media (max-height: 820px)'));
    expect(short, 'no fixed pixel cap belongs in a height query')
      .not.toMatch(/\.battle \.actionmenu \{ max-height: \d+px; \}/);
  });
});
