import type { GameState } from '../../types/state';
import { esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { manualEntries, manualPages, manualTitle } from '../manual';

// Where the reader left off, kept across visits within a session.
const mem = { index: 0, scroll: 0 };

export function manualScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { store } = ctx;
  if (!manualPages.length) { store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }); return { input() {} }; }
  mem.index = Math.max(0, Math.min(mem.index, manualPages.length - 1));
  const page = manualPages[mem.index];
  const back = () => store.dispatch({ type: 'SET_SCREEN', screen: state.started ? state.back : { id: 'title' } });

  html(root, `<section class="manual">
    <div class="toc panel">
      <div class="eyebrow">${esc(manualTitle)}</div>
      <nav id="toc" role="listbox" aria-label="Contents">${manualEntries.map((e) => {
        if (e.group) return `<div class="group">${esc(e.title)}</div>`;
        const i = manualPages.indexOf(e);
        return `<div class="page lvl${e.level} ${i === mem.index ? 'focused' : ''}" role="option" aria-selected="${i === mem.index}" data-i="${i}">${esc(e.title)}</div>`;
      }).join('')}</nav>
    </div>
    <article class="body panel" id="body" tabindex="-1">
      <h2>${esc(page.title)}</h2>
      ${page.html}
      <p class="small end-note">${mem.index + 1} of ${manualPages.length}${mem.index + 1 < manualPages.length ? ` · next: ${esc(manualPages[mem.index + 1].title)}` : ''}</p>
    </article>
  </section>`);

  const body = root.querySelector('#body') as HTMLElement;
  const toc = root.querySelector('#toc') as HTMLElement;
  body.scrollTop = mem.scroll;
  toc.querySelector('.focused')?.scrollIntoView({ block: 'nearest' });

  const go = (i: number) => {
    const next = Math.max(0, Math.min(i, manualPages.length - 1));
    if (next === mem.index) return;
    mem.index = next;
    mem.scroll = 0;
    ctx.audio.sfx('move', state.era);
    ctx.refresh();
  };
  const scrollBy = (dy: number) => {
    body.scrollTop = Math.max(0, Math.min(body.scrollHeight - body.clientHeight, body.scrollTop + dy));
    mem.scroll = body.scrollTop;
  };
  /** A reads onward: down a page, then into the next section when this one runs out. */
  const readOn = () => {
    const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
    if (atEnd) { if (mem.index + 1 < manualPages.length) go(mem.index + 1); return; }
    scrollBy(body.clientHeight * 0.85);
  };

  toc.querySelectorAll('.page').forEach((el) => el.addEventListener('click', () => go(Number((el as HTMLElement).dataset.i))));
  body.addEventListener('scroll', () => { mem.scroll = body.scrollTop; });

  ctx.setPrompts(prompts(
    { btn: 'dpad', label: 'Contents' },
    { btn: 'a', label: 'Read on' },
    { btn: 'rs', label: 'Scroll' },
    { btn: 'b', label: 'Back' },
  ));

  return {
    input(btn) {
      switch (btn) {
        case 'up': case 'left': case 'lb': go(mem.index - 1); break;
        case 'down': case 'right': case 'rb': go(mem.index + 1); break;
        case 'scrollUp': scrollBy(-body.clientHeight * 0.6); break;
        case 'scrollDown': scrollBy(body.clientHeight * 0.6); break;
        case 'a': readOn(); break;
        case 'b': case 'start': case 'select': back(); break;
      }
    },
  };
}
