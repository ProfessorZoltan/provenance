import { portraitSvg } from '../../art/rigs';
import { evalAll } from '../../core/conditions';
import { conditionContext } from '../../core/encounter';
import { NPC_NAMES } from '../../core/reducer';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { menu } from '../menu';

const SPEAKER_RIG: Record<string, { rig: string; accent: string }> = {
  wren: { rig: 'wren', accent: 'var(--commons)' }, dax: { rig: 'dax', accent: 'var(--cinder)' },
  ade: { rig: 'ade', accent: 'var(--commons)' }, pell: { rig: 'pell', accent: 'var(--commons)' },
  ansel: { rig: 'ansel', accent: 'var(--commons)' }, militia: { rig: 'militia', accent: 'var(--cinder)' },
  ilse: { rig: 'faction_trainer', accent: 'var(--commons)' }, ilo9: { rig: 'ilo9', accent: 'var(--choir)' },
  ruth: { rig: 'shopkeeper', accent: 'var(--commons)' }, sable: { rig: 'shopkeeper', accent: 'var(--commons)' },
  // Port Halden and the 2064 Handover.
  mara_vesely: { rig: 'mara', accent: 'var(--choir)' }, mara: { rig: 'mara', accent: 'var(--choir)' },
  dock_foreman: { rig: 'engineer', accent: 'var(--commons)' }, stallholder_ben: { rig: 'shopkeeper', accent: 'var(--commons)' },
  delegate_okafor: { rig: 'faction_trainer', accent: 'var(--chosen)' }, commune_speaker: { rig: 'faction_trainer', accent: 'var(--commons)' },
  fence_moro: { rig: 'shopkeeper', accent: 'var(--cinder)' }, recruiter_sana: { rig: 'refugee', accent: 'var(--commons)' },
  quarter_regular: { rig: 'engineer', accent: 'var(--chosen)' }, survivor_ives: { rig: 'refugee', accent: 'var(--cinder)' },
  supervisor_aldana: { rig: 'faction_trainer', accent: 'var(--chosen)' }, clerk_novi: { rig: 'shopkeeper', accent: 'var(--chosen)' },
  // Ripple sites.
  mattie_tolliver: { rig: 'shopkeeper', accent: 'var(--commons)' }, safehouse_keeper: { rig: 'refugee', accent: 'var(--commons)' },
  stacks_swimmer: { rig: 'refugee', accent: 'var(--commons)' }, memorial_docent: { rig: 'faction_trainer', accent: 'var(--chosen)' },
  // The Basin.
  hale: { rig: 'hale', accent: 'var(--cinder)' }, site_engineer: { rig: 'engineer', accent: 'var(--commons)' },
  plant_supervisor: { rig: 'engineer', accent: 'var(--choir)' }, camp_clerk: { rig: 'shopkeeper', accent: 'var(--commons)' },
  ash_smith: { rig: 'militia', accent: 'var(--cinder)' }, fens_salvager: { rig: 'refugee', accent: 'var(--cinder)' },
  field_auditor: { rig: 'faction_trainer', accent: 'var(--chosen)' },
  // Capitol Hill.
  clerk_of_the_house: { rig: 'faction_trainer', accent: 'var(--commons)' },
  night_clerk: { rig: 'shopkeeper', accent: 'var(--commons)' },
  curator_vos: { rig: 'faction_trainer', accent: 'var(--cinder)' },
  board_secretary: { rig: 'faction_trainer', accent: 'var(--chosen)' },
  annex_staffer: { rig: 'engineer', accent: 'var(--commons)' },
  // Meridian Campus.
  quiroga: { rig: 'quiroga', accent: 'var(--commons)' },
  strand_young: { rig: 'strand_young', accent: 'var(--chosen)' },
  atrium_receptionist: { rig: 'shopkeeper', accent: 'var(--chosen)' },
  vault_holdout: { rig: 'refugee', accent: 'var(--cinder)' },
  bar_engineer: { rig: 'engineer', accent: 'var(--choir)' },
  the_chair: { rig: 'strand_perpetual_phase2', accent: 'var(--chosen)' },
  night_supervisor: { rig: 'faction_trainer', accent: 'var(--chosen)' },
  hub_picker: { rig: 'shopkeeper', accent: 'var(--commons)' },
  perimeter_scav: { rig: 'refugee', accent: 'var(--commons)' },
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
