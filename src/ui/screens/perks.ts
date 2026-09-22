import { portraitSvg } from '../../art/rigs';
import { loadout, perkOffer, perksOwed } from '../../core/stats';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { menu, type MenuItem } from '../menu';

/**
 * Level-up picks. Every level past the first offers two perks and keeps one. The screen lists who
 * has a pick waiting, then the two on offer for the one chosen, with what each would change.
 */
export function perksScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const owed = Object.keys(state.party).filter((id) => perksOwed(content, state.party[id]) > 0);
  const chosen = state.screen.id === 'perks' && state.screen.character && owed.includes(state.screen.character) ? state.screen.character : null;
  const back = () => store.dispatch({ type: 'SET_SCREEN', screen: state.back });

  let items: MenuItem[];
  let heading: string;
  let body = '';
  if (!chosen) {
    heading = owed.length ? 'Who levels up?' : 'Nobody has a pick waiting';
    items = owed.map((id) => ({
      id,
      label: content.characters[id].name,
      hint: `${perksOwed(content, state.party[id])} pick${perksOwed(content, state.party[id]) === 1 ? '' : 's'} waiting · Lv ${state.party[id].level}`,
      onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'perks', character: id } }),
    }));
    if (!items.length) items.push({ id: 'none', label: 'Every level has been spent', disabled: true, onSelect: () => {} });
    body = `<p class="small">Each level past the first offers two of these and keeps one. Skill points are separate: they buy nodes on the tech tree.</p>
      <ul class="small" style="margin:10px 0 0 18px;padding:0">${Object.values(content.perks).map((p) => `<li><b>${esc(p.name)}</b>: ${esc(p.description)}</li>`).join('')}</ul>`;
  } else {
    const cs = state.party[chosen];
    const def = content.characters[chosen];
    const l = loadout(content, def, cs);
    const offer = perkOffer(content, cs, state.seed);
    heading = `${def.shortName} · pick ${(cs.perks?.length ?? 0) + 1} of ${cs.level - 1}`;
    items = offer.map((p) => ({
      id: p.id,
      label: p.name,
      hint: p.description,
      onSelect: () => {
        store.dispatch({ type: 'CHOOSE_PERK', character: chosen, perk: p.id });
        const err = store.lastError();
        if (err) { ctx.toast(err.message); ctx.audio.sfx('cancel', state.era); return; }
        ctx.audio.sfx('confirm', state.era);
        ctx.toast(`${def.shortName} takes ${p.name}.`);
        const again = perksOwed(content, store.getState().party[chosen]) > 0;
        store.dispatch({ type: 'SET_SCREEN', screen: again ? { id: 'perks', character: chosen } : { id: 'perks' } });
      },
    }));
    const kept = (cs.perks ?? []).map((id) => content.perks[id]?.name ?? id);
    body = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px"><div style="width:56px;height:56px">${portraitSvg(def.rig, accentFor(content, state, chosen))}</div><div><b>${esc(def.name)}</b><div class="small">Lv ${cs.level} · Resolve ${l.stats.resolve} · Grit ${l.stats.grit} · Signal ${l.stats.signal} · Noise ${l.stats.noise} · Latency ${l.stats.latency}</div></div></div>
      <p class="small">${kept.length ? `Kept so far: ${esc(kept.join(', '))}.` : 'Nothing kept yet.'} A perk is for good.</p>`;
  }

  html(root, `<section class="two"><div class="panel"><div class="eyebrow">Level-up picks</div><h2>${esc(heading)}</h2>${body}</div>
    <div class="panel"><div class="eyebrow">${chosen ? 'Two on offer' : 'Waiting'}</div><div id="m"></div></div></section>`);
  const m = menu(items, 0);
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move' }, { btn: 'a', label: chosen ? 'Keep' : 'Choose' }, { btn: 'b', label: 'Back' }));
  return {
    input(btn) {
      if (m.input(btn)) return;
      if (btn === 'b') { if (chosen) store.dispatch({ type: 'SET_SCREEN', screen: { id: 'perks' } }); else back(); }
    },
  };
}
