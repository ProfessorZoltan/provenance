import { tokenSvg } from '../../art/rigs';
import { evalAll } from '../../core/conditions';
import { conditionContext } from '../../core/encounter';
import { mapFor } from '../../core/reducer';
import { deriveWorld } from '../../core/timeline';
import type { EraDef, MapDef, MapNode } from '../../types/content';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, partyStrip, prompts, type Ctx, type ScreenHandle } from '../common';

const SPEED = 300; // map units per second

const ICONS: Record<string, (era: EraDef) => string> = {
  monastery: (era) => `<rect x="-44" y="-14" width="88" height="34" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><polygon points="-14,-14 0,-34 14,-14" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><rect x="-6" y="-8" width="12" height="14" fill="${era.palette.accent}" opacity="0.8"/>`,
  stronghold: (era) => `<path d="M-44 20 L-40 -14 L-28 -14 L-28 -6 L-16 -6 L-16 -14 L16 -14 L16 -6 L28 -6 L28 -14 L40 -14 L44 20 Z" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><polygon points="-12,4 0,-22 12,4" fill="#EF9F27"/>`,
  village: (era) => [-30, 0, 30].map((x) => `<rect x="${x - 12}" y="-4" width="24" height="20" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><polygon points="${x - 14},-4 ${x},-18 ${x + 14},-4" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`).join(''),
  port: (era) => `<rect x="-46" y="0" width="92" height="18" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>${[-30, -6, 18].map((x) => `<rect x="${x}" y="-14" width="22" height="14" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`).join('')}<path d="M-34 -14 L-34 -44 L6 -44 L6 -36" fill="none" stroke="${era.palette.ink}" stroke-width="${era.lineWeight + 1}"/><rect x="2" y="-36" width="8" height="10" fill="${era.palette.accent}"/>`,
  tower: (era) => [-28, 0, 28].map((x, i) => `<rect x="${x - 11}" y="${-44 + i % 2 * 14}" width="22" height="${62 - (i % 2) * 14}" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`).join('') + `<rect x="-30" y="-30" width="60" height="4" fill="${era.palette.accent}" opacity="0.8"/>`,
  drowned: (era) => `${[-30, 2].map((x) => `<rect x="${x}" y="-34" width="26" height="46" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`).join('')}<path d="M-46 12 q14 -8 26 0 t26 0 t26 0 t26 0" fill="none" stroke="${era.palette.accent2}" stroke-width="3"/><path d="M-46 24 q14 -8 26 0 t26 0 t26 0 t26 0" fill="none" stroke="${era.palette.accent2}" stroke-width="3" opacity="0.6"/>`,
  enclave: (era) => [-32, 0, 32].map((x) => `<rect x="${x - 13}" y="-30" width="26" height="48" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>${[0, 12, 24].map((y) => `<rect x="${x - 7}" y="${-24 + y}" width="14" height="5" fill="${era.palette.accent}" opacity="0.7"/>`).join('')}`).join(''),
  market: (era) => `<path d="M-40 -6 L-30 -22 L30 -22 L40 -6 Z" fill="${era.palette.accent}" opacity="0.85" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><rect x="-34" y="-6" width="68" height="24" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><rect x="-8" y="2" width="16" height="16" fill="${era.palette.ink}" opacity="0.5"/>`,
  gate: (era) => `<rect x="-22" y="-22" width="6" height="40" fill="${era.palette.ink}"/><rect x="16" y="-22" width="6" height="40" fill="${era.palette.ink}"/><rect x="-24" y="-26" width="48" height="6" fill="${era.palette.ink}"/><polygon points="-10,-40 0,-46 10,-40 0,-34" fill="${era.palette.accent}"/>`,
};

function worldSvg(map: MapDef, era: EraDef, flags: string[], nodes: { n: MapNode; ok: boolean }[]): string {
  const W = map.width, H = map.height;
  const ridge = (y: number, amp: number) => `M0 ${y} ${Array.from({ length: 9 }, (_, i) => `L${(i * W) / 8} ${y - ((i * 37) % 3) * amp - (i % 2) * amp}`).join(' ')} L${W} ${y} L${W} 0 L0 0 Z`;
  const quiet = era.id === '2148';
  const coast = `M0 ${H} L0 ${H - 120} Q${W * 0.19} ${H - 200} ${W * 0.375} ${H - 80} T${W * 0.75} ${H - 120} T${W} ${H - 60} L${W} ${H} Z`;
  return `<svg class="world" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${era.palette.bg}"/>
    ${quiet ? '' : `<g stroke="${era.palette.accent2}" stroke-width="0.5" opacity="0.5">${Array.from({ length: Math.ceil(H / 50) }, (_, i) => `<line x1="0" y1="${i * 50}" x2="${W}" y2="${i * 50}"/>`).join('')}${Array.from({ length: Math.ceil(W / 50) }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${H}"/>`).join('')}</g>`}
    <path d="${ridge(150, 40)}" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>
    <path d="${coast}" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>
    <path d="M${W * 0.737} 0 q-60 ${H * 0.29} 40 ${H * 0.52} t-30 ${H * 0.48}" fill="none" stroke="${quiet ? '#3B6D11' : era.palette.accent}" stroke-width="${quiet ? 10 : 3}" opacity="${quiet ? 0.5 : 0.7}"/>
    ${quiet ? `<g fill="#3B6D11" opacity="0.35">${Array.from({ length: 24 }, (_, i) => `<ellipse cx="${(i * 233) % W}" cy="${300 + ((i * 131) % Math.max(100, H - 400))}" rx="${30 + (i % 4) * 12}" ry="${10 + (i % 3) * 4}"/>`).join('')}</g>` : ''}
    ${map.zones.map((z) => `<g><rect class="zone" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="18"/><text class="zone-label" x="${z.x + 18}" y="${z.y + 30}">${esc(z.label)}</text></g>`).join('')}
    ${map.roads.map((r) => `<path class="road" d="M${r[0]} ${r[1]} ${r.slice(2).map((v, i) => (i % 2 === 0 ? `L${v}` : ` ${v}`)).join('')}"/>`).join('')}
    ${nodes.map(({ n, ok }) => `<g class="node ${ok ? '' : 'locked'}" data-node="${n.id}" transform="translate(${n.x} ${n.y})">
      <circle class="node-ring" r="${n.radius}"/>
      ${(ICONS[n.icon ?? ''] ?? ICONS.village)(era)}
      <text class="node-label" y="${n.radius - 4}">${esc(n.label)}</text>
    </g>`).join('')}
    ${flags.includes('armedResistance') && era.id === '2312' ? `<g transform="translate(520 600)"><rect x="-30" y="-6" width="60" height="14" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="0.5"/><text y="-12" font-size="12" text-anchor="middle" fill="${era.palette.ink}">Memorial</text></g>` : ''}
    ${flags.includes('letItFall') && era.id === '2312' ? `<g class="amb-pulse" transform="translate(430 560)"><polygon points="-14,0 0,-5 14,0 0,5" fill="${era.palette.ink}"/><circle r="2.5" fill="${era.palette.accent}"/></g>` : ''}
    <g class="token" id="token"></g>
  </svg>`;
}

export function mapScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store, input } = ctx;
  const map = mapFor(content, state.era);
  const era = content.eras[state.era];
  if (!map) { store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }); return { input() {} }; }
  const cctx = conditionContext(content, state);
  const derived = deriveWorld(content, state.world, state.party);
  const flags = [...state.flags, ...derived.flags];
  const nodes = map.nodes.map((n) => ({ n, ok: evalAll(n.requires, cctx) })).filter(({ n, ok }) => n.kind === 'location' || ok);

  html(root, `<section class="map">
    ${worldSvg(map, era, flags, nodes)}
    <div class="hud panel"><div class="eyebrow">${esc(era.id)} · ${esc(era.name)}</div><h2 style="font-size:20px">${esc(map.name)}</h2><p class="small">Walk with the left stick or WASD. Dashed regions are wilds: something may find you there, and the Scan card lets you skip it.</p></div>
    <div class="party-mini">${partyStrip(ctx, state)}</div>
    <div class="near-prompt panel" id="near" hidden></div>
  </section>`);

  const svg = root.querySelector('svg.world') as SVGSVGElement;
  const token = root.querySelector('#token') as SVGGElement;
  const near = root.querySelector('#near') as HTMLElement;
  const accent = accentFor(content, state, 'player');
  // Top-down chits: one per party member, the Auditor in front.
  token.innerHTML = `<ellipse cx="0" cy="14" rx="30" ry="8" fill="${era.palette.ink}" opacity="0.15"/>` + state.activeParty.map((id, i) => {
    const ox = (i - 1) * 22, oy = i === 0 ? 0 : -8;
    const col = i === 0 ? accent : content.characters[id].accent;
    return `<g transform="translate(${ox} ${oy})"><g transform="translate(-18 -24) scale(2)">${tokenSvg(content.characters[id].rig, col).replace('<svg ', '<svg width="18" height="22" ')}</g><title>${esc(content.characters[id].shortName)}</title></g>`;
  }).join('');

  let x = state.map.x, y = state.map.y;
  let last = performance.now();
  let walked = 0;
  let nearNode: MapNode | null = null;
  let raf = 0;
  let done = false;

  const place = () => { token.setAttribute('transform', `translate(${x} ${y})`); };
  const inZone = () => map.zones.find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) ?? null;
  let primed = false;
  const updateNear = () => {
    const found = nodes.find(({ n }) => Math.hypot(n.x - x, n.y - y) <= n.radius) ?? null;
    const n = found?.n ?? null;
    if (primed && n === nearNode) return;
    primed = true;
    nearNode = n;
    svg.querySelectorAll('.node').forEach((el) => el.classList.toggle('near', (el as SVGGElement).dataset.node === n?.id));
    if (n) {
      near.hidden = false;
      near.innerHTML = `<span class="prompt"><span class="glyph" data-btn="a"><span class="pad">A</span><span class="key">Enter</span></span><span>${n.kind === 'location' ? 'Enter' : 'Approach'} ${esc(n.label)}</span></span>`;
    } else near.hidden = true;
    ctx.setPrompts(prompts(
      { btn: 'ls', label: 'Walk' },
      n ? { btn: 'a', label: n.kind === 'location' ? `Enter ${n.label}` : n.label } : null,
      { btn: 'y', label: 'Tech trees' }, { btn: 'x', label: 'Roster' }, { btn: 'start', label: 'Save' }, { btn: 'select', label: 'Settings' },
    ));
  };
  const enter = () => {
    if (!nearNode) return;
    store.dispatch({ type: 'SET_MAP_POS', x, y });
    if (nearNode.kind === 'location' && nearNode.location) {
      ctx.audio.sfx('confirm', state.era);
      store.dispatch({ type: 'TRAVEL', location: nearNode.location });
    } else if (nearNode.encounter) {
      ctx.audio.sfx('warn', state.era);
      store.dispatch({ type: 'START_ENCOUNTER', encounterId: nearNode.encounter, from: 'map' });
    }
  };
  const frame = (now: number) => {
    if (done) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const v = input.moveVector();
    if (v.x || v.y) {
      const nx = Math.max(30, Math.min(map.width - 30, x + v.x * SPEED * dt));
      const ny = Math.max(180, Math.min(map.height - 40, y + v.y * SPEED * dt));
      const zone = inZone();
      walked += Math.hypot(nx - x, ny - y);
      x = nx; y = ny;
      place();
      updateNear();
      if (zone && walked >= zone.stride) {
        walked = 0;
        if (Math.random() < zone.chance) {
          done = true;
          store.dispatch({ type: 'SET_MAP_POS', x, y });
          store.dispatch({ type: 'EXPLORE', encounters: zone.encounters });
          return;
        }
      } else if (!zone) walked = 0;
    }
  };
  place();
  updateNear();
  raf = requestAnimationFrame(frame);
  svg.querySelectorAll('.node').forEach((el) => el.addEventListener('click', () => { if (nearNode && (el as SVGGElement).dataset.node === nearNode.id) enter(); }));

  return {
    input(btn) {
      if (btn === 'a') enter();
      else if (btn === 'y') { store.dispatch({ type: 'SET_MAP_POS', x, y }); store.dispatch({ type: 'SET_SCREEN', screen: { id: 'tech', character: 'player' } }); }
      else if (btn === 'x') { store.dispatch({ type: 'SET_MAP_POS', x, y }); store.dispatch({ type: 'SET_SCREEN', screen: { id: 'roster' } }); }
      else if (btn === 'start') { store.dispatch({ type: 'SET_MAP_POS', x, y }); store.dispatch({ type: 'SET_SCREEN', screen: { id: 'save' } }); }
      else if (btn === 'select') { store.dispatch({ type: 'SET_MAP_POS', x, y }); store.dispatch({ type: 'SET_SCREEN', screen: { id: 'settings' } }); }
    },
    destroy() { done = true; cancelAnimationFrame(raf); },
  };
}
