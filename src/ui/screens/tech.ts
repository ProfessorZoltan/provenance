import { portraitSvg } from '../../art/rigs';
import { conditionContext } from '../../core/encounter';
import { loadout } from '../../core/stats';
import { nodeAvailability, nodesFor } from '../../core/tech';
import { deriveWorld } from '../../core/timeline';
import type { NodeDef } from '../../types/content';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';

const mem = { row: 0, col: 0 };

export function techScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const charId = state.screen.id === 'tech' ? state.screen.character : 'player';
  const def = content.characters[charId];
  const cs = state.party[charId];
  const nodes = nodesFor(content, charId);
  const ctxc = conditionContext(content, state);
  const grid: NodeDef[][] = [0, 1, 2].map((c) => nodes.filter((n) => n.col === c).sort((a, b) => a.row - b.row));
  const rows = Math.max(...grid.map((g) => g.length));
  mem.col = Math.min(mem.col, 2);
  mem.row = Math.min(mem.row, rows - 1);
  const focused = grid[mem.col][mem.row];
  const avail = focused ? nodeAvailability(content, focused, cs, ctxc) : null;
  const l = loadout(content, def, cs);
  const party = state.activeParty;

  const reasonText = (): string => {
    if (!avail || !focused) return '';
    if (avail.ok) return `Ready to unlock for ${focused.cost} point${focused.cost === 1 ? '' : 's'}.`;
    switch (avail.reason) {
      case 'owned': return 'Owned.';
      case 'points': return `Needs ${focused.cost} skill points; you have ${cs.skillPoints}.`;
      case 'requires': return `Requires ${avail.detail}.`;
      case 'excluded': return `Locked out permanently by ${avail.detail}.`;
      case 'condition': return `Greyed out. ${avail.detail ?? ''}`;
      case 'era': return `Only purchasable while in ${avail.detail}.`;
    }
  };
  const typeLabel: Record<string, string> = { standard: 'Standard', condition: 'Condition', era: 'Era', contradiction: 'Contradiction' };

  html(root, `<section class="tech">
    <div>
      <div class="tabs">${party.map((id) => `<span class="${id === charId ? 'on' : ''}">${esc(content.characters[id].shortName)}</span>`).join('')}<span class="small" style="border:none;opacity:.6">LB / RB switch</span></div>
      <div class="grid">${grid.map((col, ci) => `<div class="trunk"><h3>${esc(def.trunks[ci].name)} <span class="small">(${def.trunks[ci].key})</span></h3>${col.map((n, ri) => {
        const a = nodeAvailability(content, n, cs, ctxc);
        const owned = cs.nodes.includes(n.id);
        const cls = ['node', n.type, owned ? 'owned' : a.ok ? '' : 'locked', ci === mem.col && ri === mem.row ? 'focused' : ''].join(' ');
        return `<div class="${cls}" data-c="${ci}" data-r="${ri}"><div class="ty">${typeLabel[n.type]} · ${n.cost} SP</div>${esc(n.name)}</div>`;
      }).join('')}</div>`).join('')}</div>
    </div>
    <div class="detail panel">
      <div class="eyebrow">${esc(def.name)} · ${esc(def.signature)}</div>
      ${focused ? `<h3>${esc(focused.name)}</h3><p class="small">${esc(focused.description)}</p>
        ${focused.type === 'contradiction' ? `<p class="small" style="margin-top:6px">Taking this locks ${focused.excludes.map((x) => content.nodes[x]?.name).join(', ')} forever.</p>` : ''}
        <div class="reason">${esc(reasonText())}</div>` : ''}
      <div class="points">Skill points: <b>${cs.skillPoints}</b> · Level ${cs.level} · ${cs.xp} XP</div>
      <div class="stats">
        <span>Resolve ${l.stats.resolve}</span><span>Bandwidth ${l.stats.bandwidth}</span>
        <span>Latency ${l.stats.latency}</span><span>Signal ${l.stats.signal}</span>
        <span>Noise ${l.stats.noise}</span><span>Grit ${l.stats.grit}</span>
        <span>Sync ${cs.sync > 0 ? '+' : ''}${cs.sync}</span><span>Continuity ${deriveWorld(content, state.world, state.party).continuity[charId]}</span>
      </div>
      <p class="small" style="margin-top:10px">Abilities: ${l.abilities.map((a) => content.abilities[a]?.name ?? a).join(', ')}</p>
    </div>
  </section>`);
  root.querySelectorAll('.node').forEach((n) => n.addEventListener('click', () => {
    const el = n as HTMLElement;
    mem.col = Number(el.dataset.c); mem.row = Number(el.dataset.r);
    store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: charId } });
  }));
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move' }, { btn: 'a', label: 'Unlock', disabled: !avail?.ok }, { btn: 'lb', label: 'Prev' }, { btn: 'rb', label: 'Next' }, { btn: 'b', label: 'Back' }));
  const rerender = () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: charId } });
  return {
    input(btn) {
      if (btn === 'up') { mem.row = (mem.row + rows - 1) % rows; rerender(); }
      else if (btn === 'down') { mem.row = (mem.row + 1) % rows; rerender(); }
      else if (btn === 'left') { mem.col = (mem.col + 2) % 3; rerender(); }
      else if (btn === 'right') { mem.col = (mem.col + 1) % 3; rerender(); }
      else if (btn === 'lb' || btn === 'rb') {
        const i = party.indexOf(charId);
        const next = party[(i + (btn === 'rb' ? 1 : party.length - 1)) % party.length];
        store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: next } });
      } else if (btn === 'a' && focused && avail?.ok) {
        store.dispatch({ type: 'UNLOCK_NODE', character: charId, node: focused.id });
        ctx.audio.sfx('tempo', state.era);
        ctx.toast(`${focused.name} unlocked.`);
      } else if (btn === 'a' && focused && !avail?.ok) {
        ctx.audio.sfx('cancel', state.era);
      } else if (btn === 'b') store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } });
    },
  };
}

export function partyScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content } = ctx;
  const derived = deriveWorld(content, state.world, state.party);
  html(root, `<section class="two">${state.activeParty.map((id) => {
    const def = content.characters[id];
    const cs = state.party[id];
    const l = loadout(content, def, cs);
    return `<div class="panel"><div style="display:flex;gap:12px;align-items:center"><div style="width:64px;height:64px">${portraitSvg(def.rig, accentFor(content, state, id))}</div><div><h3>${esc(def.name)}</h3><div class="small">${esc(def.role)} · ${esc(def.lean)}</div></div></div>
      <p class="small" style="margin:8px 0">${esc(def.bio)}</p>
      <div class="kv"><b>Resolve</b><span>${cs.hp} / ${l.stats.resolve}</span><b>Continuity</b><span>${derived.continuity[id]}</span><b>Sync</b><span>${cs.sync}</span><b>Nodes</b><span>${cs.nodes.length} / 12</span></div></div>`;
  }).join('')}</section>`);
  ctx.setPrompts(prompts({ btn: 'b', label: 'Back' }));
  return { input(btn) { if (btn === 'b') ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }); } };
}
