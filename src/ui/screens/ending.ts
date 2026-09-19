import { artAssetUrl } from '../../art/library';
import { deriveWorld } from '../../core/timeline';
import type { GameState } from '../../types/state';
import { esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { menu } from '../menu';

/**
 * The epilogue. Which of the five you get is read off the same two hidden values that have been
 * moving all game, so this screen never decides anything: it only says what you already did.
 */
export function endingScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const derived = deriveWorld(content, state.world, state.party);
  const ending = Object.values(content.endings).find((e) => e.name === derived.ending)
    ?? Object.values(content.endings)[0];
  const art = artAssetUrl(ending.art, 'hub') ?? artAssetUrl(ending.art, 'scene');
  const edits = derived.activeChoices.length;
  const learned = state.log.length;

  html(root, `<section class="ending">
    <div class="ending-art">${art ? `<img src="${esc(art)}" alt="${esc(ending.name)}">` : ''}</div>
    <article class="panel ending-body">
      <div class="ending-scroll" id="body" tabindex="-1">
      <div class="eyebrow">2312 · the version you built</div>
      <h1>${esc(ending.name)}</h1>
      <p class="lead">${esc(ending.summary)}</p>
      ${ending.epilogue.map((p) => `<p>${esc(p)}</p>`).join('')}
      <p class="coda">${esc(ending.coda)}</p>
      <table><thead><tr><th>What the run came to</th><th>Value</th><th>Where it came from</th></tr></thead><tbody>
        <tr><td>Edits still standing</td><td>${edits}</td><td>${esc(derived.activeChoices.map((a) => content.timelineChoices[a.choiceId]?.name ?? a.choiceId).join('; ') || 'Nothing was changed')}</td></tr>
        <tr><td>Case log</td><td>${learned} of ${Object.keys(content.log).length}</td><td>What the Auditor wrote down</td></tr>
        <tr><td>Who was standing there</td><td>${state.activeParty.length}</td><td>${esc(state.activeParty.map((id) => content.characters[id]?.shortName ?? id).join(', '))}</td></tr>
      </tbody></table>
      </div>
      <div class="ending-actions" id="m"></div>
    </article>
  </section>`);

  const m = menu([
    { id: 'on', label: 'Go back to 2312', hint: 'Keep playing; the world stays as you left it', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }) },
    { id: 'title', label: 'Return to the title', hint: 'Start again, somewhere else in the sequence', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'title' } }) },
  ]);
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Select' }, { btn: 'rs', label: 'Scroll' }));

  const body = root.querySelector('#body') as HTMLElement;
  const scrollBy = (dy: number) => { body.scrollTop = Math.max(0, Math.min(body.scrollHeight - body.clientHeight, body.scrollTop + dy)); };

  return {
    input(btn) {
      if (btn === 'scrollUp') scrollBy(-body.clientHeight * 0.6);
      else if (btn === 'scrollDown') scrollBy(body.clientHeight * 0.6);
      else m.input(btn);
    },
  };
}
