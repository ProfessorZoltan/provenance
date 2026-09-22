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

describe('the battle log', () => {
  it('scrolls inside a bounded column rather than growing the row under the stage', () => {
    // Sixteen lines of log made the second grid row taller than the window: the stage shrank to
    // its minimum and the cards drew over it. The column the log sits in is capped like the
    // action list beside it, and the log scrolls within that.
    expect(rule('.battle .telemetry { min-height: 0')).toMatch(/max-height:\s*\d+vh/);
    expect(rule('.battle .telemetry .log')).toMatch(/overflow-y:\s*auto/);
  });
});

describe('the bag', () => {
  // The hub button says "Items and timeline". With a real inventory the item list pushed Relics,
  // Purse and Timeline hundreds of pixels below the panel, and up/down drives the list rather than
  // the panel, so there was no way at all to reach what the button promised.
  it('scrolls the item list and keeps the summary underneath it', () => {
    expect(rule('.bagpanel')).toMatch(/display:\s*flex/);
    expect(rule('.baglist'), 'the list takes the slack and scrolls').toMatch(/flex:\s*1 1 auto;\s*overflow-y:\s*auto/);
    expect(rule('.bagfoot'), 'the summary keeps its own height').toMatch(/flex:\s*0 0 auto/);
  });

  it('stacks an item description under its name rather than beside it', () => {
    // 48% of a 300px column wraps a hint to four lines next to a label that will not wrap.
    expect(rule('.baglist .menu li .hint')).toMatch(/max-width:\s*none/);
    expect(rule('.baglist .menu li .lbl')).toMatch(/white-space:\s*normal/);
  });
});

describe('what the hub button promises', () => {
  it('names the two things the screen it opens actually shows', async () => {
    const hub = readFileSync(fileURLToPath(new URL('../src/ui/screens/hub.ts', import.meta.url)), 'utf8');
    const bag = readFileSync(fileURLToPath(new URL('../src/ui/screens/shop.ts', import.meta.url)), 'utf8');
    const label = /label: '([^']*)', onSelect: \(\) => store\.dispatch\(\{ type: 'SET_SCREEN', screen: \{ id: 'inventory' \} \}\)/.exec(hub);
    expect(label, 'the hub still has an inventory button').not.toBeNull();
    for (const word of label![1].toLowerCase().split(/\W+/).filter((w) => w.length > 3 && w !== 'and')) {
      expect(bag.toLowerCase(), `the button says "${word}" so the screen has to show one`).toContain(word);
    }
  });
});

describe('the battle screen fits without scrolling', () => {
  it('lays the action list out two wide', () => {
    expect(rule('.battle .actionmenu .menu.cols')).toMatch(/grid-template-columns:\s*repeat\(2/);
    const battle = readFileSync(fileURLToPath(new URL('../src/ui/screens/battle.ts', import.meta.url)), 'utf8');
    expect(battle).toMatch(/columns:\s*2/);
  });

  it('keeps every enemy on one row, so none sits under the clip', () => {
    // The last top-level rule for the row is the one that wins.
    const i = css.lastIndexOf('\n.battle .enemies {');
    expect(i).toBeGreaterThan(-1);
    expect(css.slice(i, css.indexOf('}', i))).toMatch(/grid-auto-flow:\s*column/);
  });
});
