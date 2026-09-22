import { portraitSvg } from '../../art/rigs';
import { equippedItems, loadout, maxNerve, nerveOf } from '../../core/stats';
import { deriveWorld } from '../../core/timeline';
import type { EquipSlot, ItemDef } from '../../types/content';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';

const mem = { col: 0, member: 0, gear: 0 };
const SLOTS: EquipSlot[] = ['weapon', 'gear'];
const SLOT_LABEL: Record<EquipSlot, string> = { weapon: 'Weapon', gear: 'Gear' };

interface GearRow {
  kind: 'unequip' | 'equip';
  slot: EquipSlot;
  item: ItemDef;
  label: string;
  detail: string;
}

export function rosterScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const roster = Object.keys(state.party);
  mem.member = Math.max(0, Math.min(mem.member, roster.length - 1));
  const id = roster[mem.member];
  const def = content.characters[id];
  const cs = state.party[id];
  const l = loadout(content, def, cs);
  const derived = deriveWorld(content, state.world, state.party);
  const active = state.activeParty.includes(id);
  const max = content.rules.activePartyMax;

  // What this member could wear: everything equipped by them, plus carried gear that fits.
  const rows: GearRow[] = [];
  for (const slot of SLOTS) {
    const held = cs.equipment[slot];
    if (held && content.items[held]) {
      rows.push({ kind: 'unequip', slot, item: content.items[held], label: `${SLOT_LABEL[slot]}: ${content.items[held].name}`, detail: 'Take it off and put it back in the bag.' });
    } else {
      rows.push({ kind: 'unequip', slot, item: { id: '', name: '', kind: 'gear', description: '' }, label: `${SLOT_LABEL[slot]}: empty`, detail: 'Nothing equipped in this slot.' });
    }
  }
  for (const [itemId, count] of Object.entries(state.inventory.items)) {
    const item = content.items[itemId];
    if (!item || item.kind !== 'gear' || !item.slot || count <= 0) continue;
    if (item.onlyFor && !item.onlyFor.includes(id)) continue;
    const deltas = Object.entries(item.stats ?? {}).map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k}`).join(', ');
    rows.push({ kind: 'equip', slot: item.slot, item, label: `Equip ${item.name} ×${count}`, detail: `${item.description}${deltas ? ` (${deltas})` : ''}` });
  }
  mem.gear = Math.max(0, Math.min(mem.gear, rows.length - 1));

  const statLine = (k: keyof typeof l.stats, label: string) => {
    const base = def.baseStats[k];
    const now = l.stats[k];
    const diff = now - base;
    return `<b>${label}</b><span>${now}${diff ? ` <i class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff}</i>` : ''}</span>`;
  };

  html(root, `<section class="roster">
    <div class="panel list">
      <div class="eyebrow">Roster · ${state.activeParty.length} of ${max} active</div>
      <div id="members">${roster.map((rid, i) => {
        const r = state.party[rid];
        const rd = content.characters[rid];
        const on = state.activeParty.includes(rid);
        return `<div class="member-row ${i === mem.member && mem.col === 0 ? 'focused' : ''} ${on ? 'active' : 'benched'}" data-i="${i}">
          <div class="portrait">${portraitSvg(rd.rig, accentFor(content, state, rid))}</div>
          <div class="who"><b>${esc(rd.shortName)}</b><span class="small">Lv ${r.level}${r.skillPoints ? ` · ${r.skillPoints} SP` : ''}</span></div>
          <span class="tag">${on ? 'Active' : 'Benched'}</span>
        </div>`;
      }).join('')}</div>
      <p class="small" style="margin-top:10px">The Auditor always goes. Benched members still learn, at ${Math.round(content.rules.benchedXpShare * 100)}% of the experience.</p>
    </div>
    <div class="panel sheet">
      <div class="eyebrow">${esc(def.name)} · ${esc(def.role)}</div>
      <p class="small">${esc(def.signature)}</p>
      <div class="kv stats">
        ${statLine('resolve', 'Resolve')}${statLine('bandwidth', 'Bandwidth')}
        ${statLine('latency', 'Latency')}${statLine('signal', 'Signal')}
        ${statLine('noise', 'Noise')}${statLine('grit', 'Grit')}
        <b>Nerve</b><span>${nerveOf(content, cs)} / ${maxNerve(content, cs)}</span>
        <b>Sync</b><span>${cs.sync > 0 ? '+' : ''}${cs.sync}</span>
        <b>Continuity</b><span>${derived.continuity[id] ?? 100}</span>
      </div>
      <div class="eyebrow" style="margin-top:14px">Equipment</div>
      <div id="gear"></div>
    </div>
  </section>`);

  const gearEl = root.querySelector('#gear') as HTMLElement;
  gearEl.innerHTML = rows.map((r, i) => `<div class="gear-row ${i === mem.gear && mem.col === 1 ? 'focused' : ''} ${r.kind === 'unequip' && !r.item.id ? 'empty' : ''}" data-i="${i}">${esc(r.label)}</div>`).join('')
    + `<p class="small gear-detail">${esc(rows[mem.gear]?.detail ?? '')}</p>`;

  const refresh = () => ctx.refresh();
  const toggleActive = () => {
    const members = active ? state.activeParty.filter((a) => a !== id) : [...state.activeParty, id];
    store.dispatch({ type: 'SET_ACTIVE_PARTY', members });
    const err = store.lastError();
    if (err) { ctx.toast(err.message); ctx.audio.sfx('cancel', state.era); } else ctx.audio.sfx('confirm', state.era);
  };
  const useGear = () => {
    const row = rows[mem.gear];
    if (!row) return;
    if (row.kind === 'equip') store.dispatch({ type: 'EQUIP', character: id, item: row.item.id });
    else if (row.item.id) store.dispatch({ type: 'UNEQUIP', character: id, slot: row.slot });
    else return;
    const err = store.lastError();
    if (err) { ctx.toast(err.message); ctx.audio.sfx('cancel', state.era); } else ctx.audio.sfx('tempo', state.era);
  };

  root.querySelectorAll('.member-row').forEach((el) => el.addEventListener('click', () => {
    mem.col = 0; mem.member = Number((el as HTMLElement).dataset.i); refresh();
  }));
  root.querySelectorAll('.gear-row').forEach((el) => el.addEventListener('click', () => {
    mem.col = 1; mem.gear = Number((el as HTMLElement).dataset.i); refresh();
  }));

  ctx.setPrompts(prompts(
    { btn: 'dpad', label: 'Move' },
    { btn: 'a', label: mem.col === 0 ? (active ? 'Bench' : 'Field') : rows[mem.gear]?.kind === 'equip' ? 'Equip' : 'Take off' },
    { btn: 'lb', label: 'Roster' }, { btn: 'rb', label: 'Equipment' },
    { btn: 'y', label: 'Items' }, { btn: 'b', label: 'Back' },
  ));

  return {
    input(btn) {
      const len = mem.col === 0 ? roster.length : rows.length;
      switch (btn) {
        case 'up': if (mem.col === 0) mem.member = (mem.member + len - 1) % len; else mem.gear = (mem.gear + len - 1) % len; refresh(); break;
        case 'down': if (mem.col === 0) mem.member = (mem.member + 1) % len; else mem.gear = (mem.gear + 1) % len; refresh(); break;
        case 'left': case 'lb': mem.col = 0; refresh(); break;
        case 'right': case 'rb': mem.col = 1; refresh(); break;
        case 'a': if (mem.col === 0) toggleActive(); else useGear(); break;
        case 'y': store.dispatch({ type: 'SET_SCREEN', screen: { id: 'inventory' } }); break;
        case 'b': store.dispatch({ type: 'SET_SCREEN', screen: state.back }); break;
      }
    },
  };
}

export { equippedItems };
