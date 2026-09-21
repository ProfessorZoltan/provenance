import { sceneSvg } from '../../art/pixel-backgrounds';
import type { GameState } from '../../types/state';
import { esc, html, prompts, type Ctx, type ScreenHandle } from '../common';

/**
 * The five frames before the prologue. Each is a place in the Enclave and a plain account of what
 * living there is like, so the thing the Auditor spends the game pulling apart is something the
 * player has seen working first. Skippable, because a second run should not have to sit through it.
 */
export function introScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const slides = content.intro.opening?.slides ?? [];
  const screen = state.screen.id === 'intro' ? state : null;
  const index = screen && screen.screen.id === 'intro' ? screen.screen.slide : 0;
  const slide = slides[index];
  if (!slide) { store.dispatch({ type: 'INTRO_SKIP' }); return { input() {} }; }

  // The frame is full-bleed here rather than letterboxed the way a hub background is.
  // Full-bleed rather than letterboxed: both the wrapper and the image it holds have to cover.
  const art = (sceneSvg(slide.art, slide.role ?? 'hub') ?? '')
    .replace('class="scene-art"', 'class="scene-art" preserveAspectRatio="xMidYMid slice"')
    .replace('xMidYMid meet', 'xMidYMid slice');
  const last = index === slides.length - 1;

  html(root, `<section class="intro">
    <div class="intro-art" aria-hidden="true">${art}</div>
    <div class="intro-body">
      <div class="intro-box panel">
        <div class="eyebrow">${esc(slide.eyebrow)}</div>
        <h2>${esc(slide.title)}</h2>
        ${slide.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
      </div>
      <div class="intro-dots" role="presentation">${slides.map((_, i) =>
        `<i class="${i === index ? 'on' : i < index ? 'past' : ''}"></i>`).join('')}</div>
    </div>
  </section>`);

  ctx.setPrompts(prompts(
    { btn: 'a', label: last ? 'Begin' : 'Continue' },
    { btn: 'b', label: 'Skip' },
  ));

  return {
    input(btn) {
      if (btn === 'a' || btn === 'start' || btn === 'right' || btn === 'down') {
        ctx.audio.sfx('confirm', state.era);
        store.dispatch({ type: 'INTRO_ADVANCE' });
        return;
      }
      if (btn === 'b') {
        ctx.audio.sfx('cancel', state.era);
        store.dispatch({ type: 'INTRO_SKIP' });
      }
    },
  };
}
