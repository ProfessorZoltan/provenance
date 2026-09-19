import { logSuperseded } from '../../core/reducer';
import type { LogCategory, LogEntryDef } from '../../types/content';
import type { GameState } from '../../types/state';
import { esc, html, prompts, type Ctx, type ScreenHandle } from '../common';

const SECTIONS: { key: LogCategory; label: string; blurb: string }[] = [
  { key: 'clues', label: 'Clues', blurb: 'What does not add up, and what it points at.' },
  { key: 'people', label: 'People', blurb: 'Who is in this, and on whose side.' },
  { key: 'places', label: 'Places', blurb: 'Where it happened, and what it is now.' },
  { key: 'dates', label: 'Dates', blurb: 'The centuries you can reach, and what turns on each.' },
];

// Which section the Auditor was reading, kept across visits within a session.
const mem = { index: 0, scroll: 0 };

export function logScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { store, content } = ctx;
  const known = state.log.map((id) => content.log[id]).filter((e): e is LogEntryDef => !!e);
  const stale = logSuperseded(content, state);
  const sections = SECTIONS.map((s) => ({ ...s, entries: known.filter((e) => e.category === s.key).sort((a, b) => a.order - b.order) }));
  const live = sections.filter((s) => s.entries.length > 0);
  mem.index = Math.max(0, Math.min(mem.index, Math.max(0, live.length - 1)));
  const section = live[mem.index];
  const back = () => store.dispatch({ type: 'SET_SCREEN', screen: state.back });

  html(root, `<section class="manual log">
    <div class="toc panel">
      <div class="eyebrow">Case log</div>
      <nav id="toc" role="listbox" aria-label="Case log sections">${live.length
        ? live.map((s, i) => `<div class="page lvl2 ${i === mem.index ? 'focused' : ''}" role="option" aria-selected="${i === mem.index}" data-i="${i}">${esc(s.label)}<span class="count">${s.entries.length}</span></div>`).join('')
        : '<div class="group">Nothing yet</div>'}</nav>
      <p class="small" style="margin:10px 6px 0">${known.length} of ${Object.keys(content.log).length} learned.</p>
    </div>
    <article class="body panel" id="body" tabindex="-1">
      ${section ? `<h2>${esc(section.label)}</h2><p class="small">${esc(section.blurb)}</p>
        <table><thead><tr><th>What</th><th>What it says</th><th>Where you learned it</th></tr></thead><tbody>
        ${section.entries.map((e) => `<tr class="${stale.has(e.id) ? 'superseded' : ''}">
          <td><strong>${esc(e.title)}</strong>${stale.has(e.id) ? '<br><span class="small">no longer true</span>' : ''}</td>
          <td>${esc(e.detail)}</td>
          <td class="small">${esc(e.source)}</td>
        </tr>`).join('')}
        </tbody></table>`
        : `<h2>The case log is empty</h2><p>You have not learned anything worth writing down yet. It fills itself as you do.</p>`}
      ${stale.size ? '<p class="small end-note">An entry marked <em>no longer true</em> was true when you wrote it. The century it came from has since been rewritten.</p>' : ''}
    </article>
  </section>`);

  const body = root.querySelector('#body') as HTMLElement;
  const toc = root.querySelector('#toc') as HTMLElement;
  body.scrollTop = mem.scroll;
  toc.querySelector('.focused')?.scrollIntoView({ block: 'nearest' });

  const go = (i: number) => {
    const next = Math.max(0, Math.min(i, live.length - 1));
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

  toc.querySelectorAll('.page').forEach((el) => el.addEventListener('click', () => go(Number((el as HTMLElement).dataset.i))));
  body.addEventListener('scroll', () => { mem.scroll = body.scrollTop; });

  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Sections' }, { btn: 'rs', label: 'Scroll' }, { btn: 'b', label: 'Back' }));

  return {
    input(btn) {
      switch (btn) {
        case 'up': case 'left': case 'lb': go(mem.index - 1); break;
        case 'down': case 'right': case 'rb': go(mem.index + 1); break;
        case 'scrollUp': scrollBy(-body.clientHeight * 0.6); break;
        case 'scrollDown': scrollBy(body.clientHeight * 0.6); break;
        case 'a': scrollBy(body.clientHeight * 0.85); break;
        case 'b': case 'start': case 'select': back(); break;
      }
    },
  };
}
