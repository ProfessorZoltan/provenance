import { portraitSvg } from '../../art/rigs';
import { conditionContext } from '../../core/encounter';
import { loadout } from '../../core/stats';
import { nodeAvailability, nodesFor } from '../../core/tech';
import { deriveWorld } from '../../core/timeline';
import type { NodeDef } from '../../types/content';
import type { CharacterState } from '../../types/state';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';

const mem = { row: 0, col: 0 };

export function techScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const charId = state.screen.id === 'tech' ? state.screen.character : 'player';
  const def = content.characters[charId];
  const cs = state.party[charId];
  // A tree only exists for somebody who is actually with you; anyone else has no nodes to spend on.
  if (!def || !cs) { store.dispatch({ type: 'SET_SCREEN', screen: state.back }); return { input() {} }; }
  const nodes = nodesFor(content, charId);
  const ctxc = conditionContext(content, state);
  const grid: NodeDef[][] = [0, 1, 2].map((c) => nodes.filter((n) => n.col === c).sort((a, b) => a.row - b.row));
  const rows = Math.max(...grid.map((g) => g.length));
  mem.col = Math.min(mem.col, 2);
  mem.row = Math.min(mem.row, rows - 1);
  /** Trunks can be different lengths; never park the cursor on an empty cell. */
  const settle = (col: number, row: number, dRow: number, dCol: number): [number, number] => {
    for (let i = 0; i < rows * 3; i++) {
      if (grid[col][row]) return [col, row];
      row += dRow; col += dCol;
      if (row < 0) row = rows - 1; else if (row >= rows) row = 0;
      if (col < 0) col = 2; else if (col > 2) col = 0;
    }
    return [col, row];
  };
  [mem.col, mem.row] = settle(mem.col, mem.row, 1, 0);
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
      <div class="tabs">${party.map((id) => {
        const pts = state.party[id].skillPoints;
        return `<span class="${id === charId ? 'on' : ''}">${esc(content.characters[id].shortName)}${pts ? ` <b class="sp">${pts} SP</b>` : ''}</span>`;
      }).join('')}<span class="small" style="border:none;opacity:.6">LB / RB switch</span></div>
      <div class="points-banner ${cs.skillPoints ? 'has' : ''}">${cs.skillPoints ? `${cs.skillPoints} skill point${cs.skillPoints === 1 ? '' : 's'} to spend` : 'No skill points to spend'}<span class="small"> · Level ${cs.level} · ${cs.xp} XP</span></div>
      <div class="grid">${grid.map((col, ci) => `<div class="trunk"><h3>${esc(def.trunks[ci].name)} <span class="small">(${def.trunks[ci].key})</span></h3>${col.map((n, ri) => {
        const a = nodeAvailability(content, n, cs, ctxc);
        const owned = cs.nodes.includes(n.id);
        const cls = ['node', n.type, owned ? 'owned' : a.ok ? '' : 'locked', ci === mem.col && ri === mem.row ? 'focused' : ''].join(' ');
        return `<div class="${cls}" data-c="${ci}" data-r="${ri}" data-id="${n.id}"><div class="ty">${typeLabel[n.type]} · ${n.cost} SP</div>${esc(n.name)}</div>`;
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
  const gridEl = root.querySelector('.grid') as HTMLElement;
  const redraw = () => drawWires(gridEl, nodes, cs);
  redraw();
  const onResize = () => redraw();
  window.addEventListener('resize', onResize);

  root.querySelectorAll('.node').forEach((n) => n.addEventListener('click', () => {
    const el = n as HTMLElement;
    mem.col = Number(el.dataset.c); mem.row = Number(el.dataset.r);
    store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: charId } });
  }));
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move' }, { btn: 'a', label: 'Unlock', disabled: !avail?.ok }, { btn: 'lb', label: 'Prev' }, { btn: 'rb', label: 'Next' }, { btn: 'b', label: 'Back' }));
  const rerender = () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: charId } });
  return {
    destroy() { window.removeEventListener('resize', onResize); },
    input(btn) {
      if (btn === 'up') { [mem.col, mem.row] = settle(mem.col, (mem.row + rows - 1) % rows, -1, 0); rerender(); }
      else if (btn === 'down') { [mem.col, mem.row] = settle(mem.col, (mem.row + 1) % rows, 1, 0); rerender(); }
      else if (btn === 'left') { [mem.col, mem.row] = settle((mem.col + 2) % 3, mem.row, 0, -1); rerender(); }
      else if (btn === 'right') { [mem.col, mem.row] = settle((mem.col + 1) % 3, mem.row, 0, 1); rerender(); }
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
      } else if (btn === 'b') store.dispatch({ type: 'SET_SCREEN', screen: state.back });
    },
  };
}

/**
 * Draws the board between nodes: a solid trace from each prerequisite to the node it unlocks,
 * lit once the prerequisite is owned, and a dashed trace between the two halves of a
 * Contradiction pair, which lock each other out.
 */
function drawWires(grid: HTMLElement, nodes: NodeDef[], cs: CharacterState): void {
  grid.querySelector('svg.wires')?.remove();
  const gb = grid.getBoundingClientRect();
  if (!gb.width) return;
  const box = new Map<string, DOMRect>();
  grid.querySelectorAll<HTMLElement>('.node').forEach((el) => {
    if (el.dataset.id) box.set(el.dataset.id, el.getBoundingClientRect());
  });
  const cx = (r: DOMRect) => r.left - gb.left + r.width / 2;
  const top = (r: DOMRect) => r.top - gb.top;
  const bottom = (r: DOMRect) => r.bottom - gb.top;

  /** An orthogonal trace with 45-degree corners, the way a board is routed. */
  const trace = (x1: number, y1: number, x2: number, y2: number): { d: string; vias: [number, number][] } => {
    if (Math.abs(x1 - x2) < 2) return { d: `M ${x1} ${y1} L ${x2} ${y2}`, vias: [] };
    const c = 7;
    // Jog sideways in the gap directly below the source, the way a board leaves a pad, rather
    // than halfway down where the run would cross the rows in between.
    const my = y1 + 13;
    const s = x2 > x1 ? 1 : -1;
    return {
      d: `M ${x1} ${y1} L ${x1} ${my - c} L ${x1 + s * c} ${my} L ${x2 - s * c} ${my} L ${x2} ${my + c} L ${x2} ${y2}`,
      vias: [[x1, my], [x2, my]],
    };
  };

  const parts: string[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    for (const reqId of n.requires) {
      const a = box.get(reqId), b = box.get(n.id);
      if (!a || !b) continue;
      const live = cs.nodes.includes(reqId);
      const { d, vias } = trace(cx(a), bottom(a) + 1, cx(b), top(b) - 1);
      parts.push(`<path d="${d}" class="wire ${live ? 'live' : ''}"/>`);
      parts.push(`<circle cx="${cx(a)}" cy="${bottom(a) + 1}" r="3" class="pad ${live ? 'live' : ''}"/>`);
      parts.push(`<circle cx="${cx(b)}" cy="${top(b) - 1}" r="3" class="pad ${live ? 'live' : ''}"/>`);
      for (const [vx, vy] of vias) parts.push(`<circle cx="${vx}" cy="${vy}" r="2" class="via ${live ? 'live' : ''}"/>`);
    }
    for (const exId of n.excludes) {
      const key = [n.id, exId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = box.get(n.id), b = box.get(exId);
      if (!a || !b) continue;
      const { d } = trace(cx(a), bottom(a) + 1, cx(b), top(b) - 1);
      parts.push(`<path d="${d}" class="wire cut"/>`);
    }
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'wires');
  svg.setAttribute('viewBox', `0 0 ${gb.width} ${gb.height}`);
  svg.setAttribute('width', String(gb.width));
  svg.setAttribute('height', String(gb.height));
  svg.innerHTML = parts.join('');
  grid.prepend(svg);
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
  const column = root.querySelector('section') as HTMLElement;
  ctx.setPrompts(prompts({ btn: 'rs', label: 'Scroll' }, { btn: 'b', label: 'Back' }));
  return {
    input(btn) {
      if (btn === 'scrollUp' || btn === 'up') { column.scrollBy({ top: -260 }); return; }
      if (btn === 'scrollDown' || btn === 'down') { column.scrollBy({ top: 260 }); return; }
      if (btn === 'b') ctx.store.dispatch({ type: 'SET_SCREEN', screen: state.back });
    },
  };
}
