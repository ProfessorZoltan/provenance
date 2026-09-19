import { activeVariant, npcDialogue, npcName } from '../../core/reducer';
import { deriveWorld } from '../../core/timeline';
import type { GameState } from '../../types/state';
import { esc, html, partyStrip, prompts, type Ctx, type ScreenHandle } from '../common';
import { menu, type MenuItem } from '../menu';

const mem: Record<string, number> = {};

/** Where a Deep Site's layers are reached from. A site with no line here gets the plain one. */
const DESCEND: Record<string, string> = {
  kell: 'Descend beneath the chapel',
  halden: 'Go down into the harbour workings',
  basin: 'Go down into the cable trench',
  capitol: 'Go down into the division lobby',
};

export function hubScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const loc = content.locations[state.location];
  const era = content.eras[loc.era];
  const variant = activeVariant(content, state, loc);
  const npcs = variant?.npcs ?? loc.npcs;
  const shop = variant?.shop ?? loc.shop;
  const derived = deriveWorld(content, state.world, state.party);
  const sub = state.screen.id;

  const items: MenuItem[] = [];
  if (sub === 'hub') {
    for (const n of npcs) items.push({ id: `talk:${n}`, label: `Talk to ${npcName(content, n)}`, onSelect: () => store.dispatch({ type: 'START_DIALOGUE', id: npcDialogue(content, state, n), returnTo: { id: 'hub' } }) });
    if (shop) items.push({ id: 'shop', label: content.shops[shop].name, hint: 'Shop', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'shop' } }) });
    items.push({ id: 'rest', label: 'Rest', hint: 'Restore Resolve', onSelect: () => { store.dispatch({ type: 'REST' }); ctx.toast('The party rests. Resolve restored.'); } });
    if (loc.kind === 'deepSite' && loc.timeLinks.length) items.push({ id: 'jump', label: DESCEND[loc.site] ?? 'Go down where the eras touch', hint: `Deep Site · ${loc.timeLinks.join(', ')}`, onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'timeJump' } }) });
    items.push({ id: 'tech', label: 'Tech trees', shortcut: 'y', hint: `${state.activeParty.reduce((s, id) => s + state.party[id].skillPoints, 0)} skill points unspent`, onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: 'player' } }) });
    items.push({ id: 'roster', label: 'Roster and gear', shortcut: 'x', hint: `${state.activeParty.length} of ${content.rules.activePartyMax} active`, onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'roster' } }) });
    items.push({ id: 'inv', label: 'Items and timeline', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'inventory' } }) });
    const unread = state.log.length - state.logRead;
    items.push({ id: 'log', label: 'Case log', shortcut: 'lb', hint: unread > 0 ? `${unread} new` : `${state.log.length} entries`, onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'log' } }) });
    items.push({ id: 'manual', label: 'Player manual', hint: 'How to play' , onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'manual' } }) });
    items.push({ id: 'save', label: 'Save / load', shortcut: 'start', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'save' } }) });
    items.push({ id: 'settings', label: 'Settings', shortcut: 'select', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'settings' } }) });
    items.push({ id: 'leave', label: `Leave ${loc.name}`, shortcut: 'b', hint: 'Walk the valley', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'map' } }) });
  } else if (sub === 'timeJump') {
    for (const e of loc.timeLinks) {
      const target = Object.values(content.locations).find((l) => l.kind === 'deepSite' && l.site === loc.site && l.era === e);
      items.push({ id: e, label: `${e} · ${content.eras[e].name}`, hint: target ? `${target.name}: ${target.type}` : '', onSelect: () => store.dispatch({ type: 'TIME_JUMP', era: e }) });
    }
    items.push({ id: 'back', label: 'Stay in ' + loc.era, shortcut: 'b', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }) });
  }

  const heading = sub === 'timeJump' ? 'Eras this site has stood in' : 'What now?';
  const flagsShown = [...state.flags, ...derived.flags];
  html(root, `<section class="hub">
    <div class="place panel">
      <div class="eyebrow">${esc(loc.kind === 'deepSite' ? 'Deep Site' : 'Waypoint')} · ${esc(loc.type)}</div>
      <h2>${esc(loc.name)}</h2>
      <div class="era">${esc(era.id)} · ${esc(era.name)} · ${esc(era.subtitle)}</div>
      <p class="small">${esc(variant?.description ?? loc.description)}</p>
      ${loc.kind === 'deepSite' && sub === 'timeJump' ? `<p class="small" style="margin-top:8px">Time travel happens only here, and only to eras when this site existed. Whatever you change below, look at the village when you come back.</p>` : ''}
      ${flagsShown.includes('armedResistance') && loc.id === 'kell_2312' ? `<p class="small" style="margin-top:8px">The chapel walls are thicker in this version of 2312.</p>` : ''}
    </div>
    <div class="actions panel"><div class="eyebrow">${heading}</div><div id="m"></div></div>
    <div class="party">${partyStrip(ctx, state)}</div>
    <div class="journal panel"><div class="eyebrow">Journal</div>${state.journal.slice(-3).map((j) => `<div>${esc(j)}</div>`).join('') || '<div>Nothing yet.</div>'}</div>
  </section>`);
  const key = `${sub}:${loc.id}`;
  const m = menu(items, mem[key] ?? 0, (i) => { mem[key] = i; });
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts(
    { btn: 'dpad', label: 'Move' }, { btn: 'a', label: 'Select' },
    sub === 'hub' ? { btn: 'b', label: 'Leave' } : { btn: 'b', label: 'Back' },
    sub === 'hub' && { btn: 'y', label: 'Tech trees' }, sub === 'hub' && { btn: 'x', label: 'Party' }, sub === 'hub' && { btn: 'start', label: 'Save' },
  ));
  return {
    input(btn) {
      if (m.input(btn)) { if (btn === 'a') ctx.audio.sfx('confirm', state.era); return; }
      if (btn === 'b') store.dispatch({ type: 'SET_SCREEN', screen: sub === 'hub' ? { id: 'map' } : { id: 'hub' } });
    },
  };
}
