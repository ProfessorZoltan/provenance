import { evalAll } from '../../core/conditions';
import { conditionContext } from '../../core/encounter';
import { activeVariant, currencyFor, hasLodging, npcDialogue, npcName, restCost } from '../../core/reducer';
import { perksOwed } from '../../core/stats';
import { deriveWorld } from '../../core/timeline';
import type { RulesDef } from '../../types/content';
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
  meridian: 'Go down through the server floor',
};

/** Where carried Entropy stands, in the word the fight will use for it. */
function entropyWord(entropy: number, rules: RulesDef): string {
  if (entropy >= rules.entropyTiers.slip.at) return 'slipping';
  if (entropy >= rules.entropyThreshold) return 'echoing';
  if (entropy >= rules.entropyTiers.fray.at) return 'fraying';
  return '';
}

export function hubScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const loc = content.locations[state.location];
  const era = content.eras[loc.era];
  const variant = activeVariant(content, state, loc);
  const cctx = conditionContext(content, state);
  const npcs = variant?.npcs ?? loc.npcs;
  const shop = variant?.shop ?? loc.shop;
  const derived = deriveWorld(content, state.world, state.party);
  const sub = state.screen.id;

  const items: MenuItem[] = [];
  if (sub === 'hub') {
    for (const n of npcs) items.push({ id: `talk:${n}`, label: `Talk to ${npcName(content, n)}`, onSelect: () => store.dispatch({ type: 'START_DIALOGUE', id: npcDialogue(content, state, n), returnTo: { id: 'hub' } }) });
    if (shop) items.push({ id: 'shop', label: content.shops[shop].name, hint: 'Shop', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'shop' } }) });
    for (const a of (variant?.actions ?? loc.actions ?? []).filter((x) => evalAll(x.requires, cctx))) {
      items.push({ id: `act:${a.dialogue}`, label: a.label, hint: a.hint, onSelect: () => store.dispatch({ type: 'START_DIALOGUE', id: a.dialogue, returnTo: { id: 'hub' } }) });
    }
    // A bed costs money and gives everything back; camp is free, half as good, and runs out.
    const cur = currencyFor(state.era);
    const cost = restCost(content, state);
    const purse = state.inventory.currency[cur] ?? 0;
    if (hasLodging(content, state)) {
      items.push({ id: 'rest', label: 'Rest', hint: `${cost} ${cur} a night (you have ${purse}). Full Resolve and Nerve, 50 Entropy let out.`, disabled: purse < cost, onSelect: () => {
        store.dispatch({ type: 'REST' });
        const err = store.lastError();
        if (err) ctx.toast(err.message); else ctx.toast(`The party rests. ${cost} ${cur} spent. Resolve restored.`);
      } });
    }
    items.push({ id: 'camp', label: 'Make camp', hint: `${state.camps} of ${content.rules.camp.perEra} left this era. Half Resolve, full Nerve, 25 Entropy let out.`, disabled: state.camps <= 0, onSelect: () => {
      store.dispatch({ type: 'CAMP' });
      const err = store.lastError();
      if (err) ctx.toast(err.message); else ctx.toast(`The party makes camp. ${state.camps - 1} left this era.`);
    } });
    if (loc.kind === 'deepSite' && loc.timeLinks.length) items.push({ id: 'jump', label: DESCEND[loc.site] ?? 'Go down where the eras touch', hint: `Deep Site · ${loc.timeLinks.join(', ')}`, onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'timeJump' } }) });
    items.push({ id: 'tech', label: 'Tech trees', shortcut: 'y', hint: `${state.activeParty.reduce((s, id) => s + state.party[id].skillPoints, 0)} skill points unspent`, onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: 'player' } }) });
    const picks = Object.keys(state.party).reduce((s, id) => s + perksOwed(content, state.party[id]), 0);
    items.push({ id: 'perks', label: 'Level-up picks', hint: picks ? `${picks} waiting` : 'Every level spent', onSelect: () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'perks' } }) });
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
      <div class="entropy-line ${entropyWord(state.entropy, content.rules)}">Entropy ${state.entropy} / ${content.rules.entropyMax}${entropyWord(state.entropy, content.rules) ? ` · ${entropyWord(state.entropy, content.rules)}` : ''}. It follows you from fight to fight. A bed lets ${content.rules.entropyFlow.restDecay} out, a camp ${content.rules.entropyFlow.campDecay}.</div>
    </div>
    <div class="actions panel"><div class="eyebrow">${heading}</div><div id="m"></div><div class="desc" id="hubdesc"></div></div>
    <div class="party">${partyStrip(ctx, state)}</div>
    <div class="journal panel"><div class="eyebrow">Journal</div>${state.journal.slice(-3).map((j) => `<div>${esc(j)}</div>`).join('') || '<div>Nothing yet.</div>'}</div>
  </section>`);
  const key = `${sub}:${loc.id}`;
  // Hints sit on one line in the list; the focused one is spelled out in full underneath.
  const descEl = root.querySelector('#hubdesc') as HTMLElement;
  const describe = (i: number) => { descEl.textContent = items[i]?.hint ?? ''; };
  // A long list goes two wide across the open middle of the screen rather than scrolling.
  const m = menu(items, mem[key] ?? 0, (i) => { mem[key] = i; describe(i); }, { columns: items.length > 6 ? 2 : 1 });
  root.querySelector('#m')!.appendChild(m.el);
  describe(m.index);
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
