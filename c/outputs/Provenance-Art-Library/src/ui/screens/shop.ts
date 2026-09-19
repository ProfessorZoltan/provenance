import { portraitSvg } from '../../art/rigs';
import { evalAll } from '../../core/conditions';
import { conditionContext } from '../../core/encounter';
import { activeVariant } from '../../core/reducer';
import { loadout } from '../../core/stats';
import { deriveWorld } from '../../core/timeline';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { menu, type MenuItem } from '../menu';

const mem = { tab: 0, buy: 0, sell: 0, inv: 0, member: 0 };

export function shopScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const loc = content.locations[state.location];
  const shopId = activeVariant(content, state, loc)?.shop ?? loc.shop;
  const shop = shopId ? content.shops[shopId] : null;
  if (!shop) { store.dispatch({ type: 'SET_SCREEN', screen: state.back }); return { input() {} }; }
  const cctx = conditionContext(content, state);
  const have = state.inventory.currency[shop.currency] ?? 0;
  const rerender = () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'shop' } });
  const items: MenuItem[] = mem.tab === 0
    ? shop.stock.filter((s) => evalAll(s.when, cctx)).map((s) => {
      const def = content.items[s.item];
      const relicFull = def.kind === 'relic' && state.inventory.relics.length >= content.rules.relicCap;
      return { id: s.item, label: def.name, cost: `${s.price}`, hint: def.description, disabled: have < s.price || relicFull, onSelect: () => { store.dispatch({ type: 'SHOP_BUY', item: s.item }); ctx.audio.sfx('confirm', state.era); ctx.toast(`Bought ${def.name}.`); } };
    })
    : state.inventory.relics.map((r, i) => {
      const def = content.items[r];
      return { id: `${r}:${i}`, label: def.name, cost: `+${def.relicValue}`, hint: def.description, onSelect: () => { store.dispatch({ type: 'SHOP_SELL_RELIC', item: r }); ctx.audio.sfx('tempo', state.era); ctx.toast(`Sold ${def.name} for ${def.relicValue} ${shop.currency}.`); } };
    });
  if (mem.tab === 1 && !items.length) items.push({ id: 'none', label: 'No Relics to sell', disabled: true });
  html(root, `<section class="shop">
    <div class="panel">
      <div class="eyebrow">${esc(shop.name)} · ${esc(loc.name)}</div>
      <div class="tabs"><span class="${mem.tab === 0 ? 'on' : ''}">Buy</span><span class="${mem.tab === 1 ? 'on' : ''}">Sell Relics</span><span class="small" style="border:none;opacity:.6">LB / RB</span></div>
      <div id="m"></div>
    </div>
    <div class="panel">
      <div class="eyebrow">Purse</div>
      <div class="kv"><b>${esc(shop.currency)}</b><span>${have}</span><b>Relics carried</b><span>${state.inventory.relics.length} / ${content.rules.relicCap}</span></div>
      <p class="small" style="margin-top:10px">Each era has its own currency and it does not travel. Relics are the exception: any shop in any era buys them at a premium.</p>
      <div class="eyebrow" style="margin-top:12px">Items</div>
      <div class="small">${Object.entries(state.inventory.items).filter(([, n]) => n > 0).map(([id, n]) => `${esc(content.items[id]?.name ?? id)} ×${n}`).join(', ') || 'Nothing.'}</div>
    </div>
  </section>`);
  const key = mem.tab === 0 ? 'buy' : 'sell';
  const m = menu(items, mem[key], (i) => { mem[key] = i; });
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move' }, { btn: 'a', label: mem.tab === 0 ? 'Buy' : 'Sell' }, { btn: 'lb', label: 'Buy' }, { btn: 'rb', label: 'Sell' }, { btn: 'b', label: 'Leave' }));
  return {
    input(btn) {
      if (btn === 'lb' || btn === 'rb' || btn === 'left' || btn === 'right') { mem.tab = mem.tab ? 0 : 1; rerender(); return; }
      if (btn === 'b') { store.dispatch({ type: 'SET_SCREEN', screen: state.back }); return; }
      m.input(btn);
    },
  };
}

export function inventoryScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const derived = deriveWorld(content, state.world, state.party);
  mem.member = Math.min(mem.member, state.activeParty.length - 1);
  const target = state.activeParty[mem.member];
  const rerender = () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'inventory' } });
  const items: MenuItem[] = Object.entries(state.inventory.items).filter(([, n]) => n > 0).map(([id, n]) => {
    const def = content.items[id];
    const usable = !!def.effect?.heal || !!def.effect?.revive;
    return { id, label: def.name, cost: `×${n}`, hint: def.description, disabled: !usable, onSelect: () => {
      store.dispatch({ type: 'USE_ITEM', item: id, target });
      if (ctx.store.lastError()) ctx.toast(ctx.store.lastError()!.message); else { ctx.audio.sfx('heal', state.era); ctx.toast(`Used ${def.name} on ${content.characters[target].shortName}.`); }
    } };
  });
  if (!items.length) items.push({ id: 'none', label: 'No items', disabled: true });
  html(root, `<section class="two">
    <div>
      <div class="eyebrow">Party · LB / RB choose who receives an item</div>
      <div style="display:grid;gap:10px">${state.activeParty.map((id, i) => {
        const def = content.characters[id]; const cs = state.party[id]; const l = loadout(content, def, cs);
        return `<div class="panel" style="${i === mem.member ? 'border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)' : ''}">
          <div style="display:flex;gap:12px;align-items:center"><div style="width:56px;height:56px">${portraitSvg(def.rig, accentFor(content, state, id))}</div>
          <div style="flex:1"><div class="name" style="display:flex;justify-content:space-between"><b>${esc(def.name)}</b><span class="small">Lv ${cs.level} · ${cs.skillPoints} SP</span></div>
          <div class="bar hp"><i style="width:${Math.round((cs.hp / l.stats.resolve) * 100)}%"></i></div>
          <div class="kv small" style="margin-top:6px"><b>Resolve</b><span>${cs.hp}/${l.stats.resolve}</span><b>Bandwidth</b><span>${l.stats.bandwidth}</span><b>Latency</b><span>${l.stats.latency}</span><b>Signal</b><span>${l.stats.signal}</span><b>Noise</b><span>${l.stats.noise}</span><b>Grit</b><span>${l.stats.grit}</span><b>Sync</b><span>${cs.sync}</span><b>Continuity</b><span>${derived.continuity[id]}</span></div>
          <div class="small" style="margin-top:6px">${esc(def.signature)}</div></div></div></div>`;
      }).join('')}</div>
    </div>
    <div class="panel">
      <div class="eyebrow">Items · use on ${esc(content.characters[target].shortName)}</div>
      <div id="m"></div>
      <div class="eyebrow" style="margin-top:14px">Relics (${state.inventory.relics.length}/${content.rules.relicCap})</div>
      <div class="small">${state.inventory.relics.map((r) => esc(content.items[r].name)).join(', ') || 'None.'}</div>
      <div class="eyebrow" style="margin-top:14px">Purse</div>
      <div class="small">${Object.entries(state.inventory.currency).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${esc(k)}`).join(' · ') || 'Empty.'}</div>
      <div class="eyebrow" style="margin-top:14px">Timeline</div>
      <div class="small">${state.world.history.length ? state.world.history.map((h) => esc(content.timelineChoices[h.choiceId].name)).join(' → ') : 'Unedited.'}</div>
    </div>
  </section>`);
  const m = menu(items, mem.inv, (i) => { mem.inv = i; });
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move' }, { btn: 'a', label: 'Use item' }, { btn: 'lb', label: 'Prev member' }, { btn: 'rb', label: 'Next member' }, { btn: 'b', label: 'Back' }));
  return {
    input(btn) {
      if (btn === 'lb' || btn === 'left') { mem.member = (mem.member + state.activeParty.length - 1) % state.activeParty.length; rerender(); return; }
      if (btn === 'rb' || btn === 'right') { mem.member = (mem.member + 1) % state.activeParty.length; rerender(); return; }
      if (btn === 'b') { store.dispatch({ type: 'SET_SCREEN', screen: state.back }); return; }
      m.input(btn);
    },
  };
}
