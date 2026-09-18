import { portraitSvg } from '../../art/rigs';
import { evalAll } from '../../core/conditions';
import { conditionContext } from '../../core/encounter';
import { NPC_NAMES } from '../../core/reducer';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { menu } from '../menu';

const SPEAKER_RIG: Record<string, { rig: string; accent: string }> = {
  wren: { rig: 'wren', accent: 'var(--commons)' }, dax: { rig: 'dax', accent: 'var(--cinder)' },
  ade: { rig: 'warden', accent: 'var(--commons)' }, pell: { rig: 'wren', accent: 'var(--commons)' },
  ansel: { rig: 'auditor', accent: 'var(--commons)' }, militia: { rig: 'warden', accent: 'var(--cinder)' },
};

export function dialogueScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const dlg = state.dialogue;
  if (!dlg) { ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }); return { input() {} }; }
  const line = ctx.content.dialogues[dlg.id].lines[dlg.index];
  const narrator = line.speaker === 'narrator';
  const who = line.speaker === 'player' ? { rig: 'auditor', accent: accentFor(ctx.content, state, 'player') } : SPEAKER_RIG[line.speaker];
  const choices = (line.choices ?? []).filter((c) => evalAll(c.conditions, conditionContext(ctx.content, state)));
  html(root, `<section class="dialogue"><div class="box panel ${narrator ? 'narrator' : ''}">
    ${narrator ? '' : `<div class="portrait">${who ? portraitSvg(who.rig, who.accent) : ''}</div>`}
    <div>
      ${narrator ? '' : `<div class="speaker">${esc(NPC_NAMES[line.speaker] ?? line.speaker)}</div>`}
      <div class="text">${esc(line.text)}</div>
      <div class="choices" id="choices"></div>
    </div>
  </div></section>`);
  let m: ReturnType<typeof menu> | null = null;
  if (choices.length) {
    m = menu(choices.map((c, i) => ({ id: String(i), label: c.text, onSelect: () => { ctx.audio.sfx('confirm', state.era); ctx.store.dispatch({ type: 'DIALOGUE_CHOOSE', index: i }); } })));
    root.querySelector('#choices')!.appendChild(m.el);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Decide' }));
  } else {
    ctx.setPrompts(prompts({ btn: 'a', label: 'Continue' }));
    root.querySelector('.box')!.addEventListener('click', () => ctx.store.dispatch({ type: 'DIALOGUE_ADVANCE' }));
  }
  return {
    input(btn) {
      if (m) { m.input(btn); return; }
      if (btn === 'a') ctx.store.dispatch({ type: 'DIALOGUE_ADVANCE' });
    },
  };
}
