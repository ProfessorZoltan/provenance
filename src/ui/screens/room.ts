import { evalAll } from '../../core/conditions';
import { conditionContext } from '../../core/encounter';
import { tokenSvg } from '../../art/rigs';
import type { EraDef, RoomDef, RoomProp } from '../../types/content';
import type { GameState } from '../../types/state';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';

const SPEED = 190; // room units per second
const BODY = 16;   // half-width of the Auditor's footprint, for blocking

const PROPS: Record<string, (p: RoomProp, era: EraDef) => string> = {
  workstation: (p, era) => {
    const deskY = p.y + p.h - 74;
    return `<rect x="${p.x}" y="${deskY}" width="${p.w}" height="74" rx="3" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`
      + `<rect x="${p.x + 6}" y="${deskY + 6}" width="${p.w - 12}" height="62" fill="none" stroke="${era.palette.ink}" stroke-width="1" opacity="0.4"/>`
      + [0, 1, 2, 3].map((i) => {
        const w = (p.w - 24) / 4 - 6, x = p.x + 12 + i * ((p.w - 24) / 4);
        return `<rect x="${x}" y="${p.y}" width="${w}" height="${p.h - 82}" fill="${era.palette.bg}" stroke="${era.palette.accent2}" stroke-width="${era.lineWeight}"/>`
          + `<rect class="amb-pulse" x="${x + 3}" y="${p.y + 4}" width="${w - 6}" height="4" fill="${era.palette.accent}" opacity="0.75"/>`;
      }).join('');
  },
  desk: (p, era) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="3" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><rect x="${p.x + 6}" y="${p.y + 6}" width="${p.w - 12}" height="${p.h - 12}" fill="none" stroke="${era.palette.ink}" stroke-width="1" opacity="0.4"/>`,
  monitors: (p, era) => `<rect x="${p.x}" y="${p.y + p.h - 10}" width="${p.w}" height="10" fill="${era.palette.ink}" opacity="0.6"/>${[0, 1, 2, 3].map((i) => `<rect x="${p.x + 4 + i * (p.w - 8) / 4}" y="${p.y}" width="${(p.w - 8) / 4 - 4}" height="${p.h - 14}" fill="${era.palette.bg}" stroke="${era.palette.accent2}" stroke-width="${era.lineWeight}"/><rect class="amb-pulse" x="${p.x + 7 + i * (p.w - 8) / 4}" y="${p.y + 4}" width="${(p.w - 8) / 4 - 10}" height="4" fill="${era.palette.accent}" opacity="0.7"/>`).join('')}`,
  cabinet: (p, era) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>${[0, 1, 2].map((i) => `<rect x="${p.x + 5}" y="${p.y + 6 + i * (p.h - 10) / 3}" width="${p.w - 10}" height="${(p.h - 10) / 3 - 4}" fill="none" stroke="${era.palette.ink}" stroke-width="1" opacity="0.5"/>`).join('')}`,
  window: (p, era) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${era.palette.accent2}" opacity="0.25" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><line x1="${p.x + p.w / 2}" y1="${p.y}" x2="${p.x + p.w / 2}" y2="${p.y + p.h}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`,
  door: (p, era) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${era.palette.bg}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight + 1}"/><circle cx="${p.x + p.w - 10}" cy="${p.y + p.h / 2}" r="3" fill="${era.palette.accent}"/>`,
  chair: (p, era) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="6" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`,
  partition: (p, era) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}" opacity="0.8"/>`,
  plant: (p, era) => `<rect x="${p.x + p.w / 2 - 6}" y="${p.y + p.h - 12}" width="12" height="12" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/><circle cx="${p.x + p.w / 2}" cy="${p.y + p.h / 2 - 6}" r="${Math.min(p.w, p.h) / 2 - 2}" fill="#2f6b4a" stroke="${era.palette.ink}" stroke-width="${era.lineWeight}"/>`,
};

function roomSvg(room: RoomDef, era: EraDef, props: RoomProp[]): string {
  const { width: W, height: H } = room;
  return `<svg class="room-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${era.palette.bg}"/>
    <g stroke="${era.palette.ink}" stroke-width="0.5" opacity="0.25">
      ${Array.from({ length: Math.ceil(W / 40) }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="${H}"/>`).join('')}
      ${Array.from({ length: Math.ceil(H / 40) }, (_, i) => `<line x1="0" y1="${i * 40}" x2="${W}" y2="${i * 40}"/>`).join('')}
    </g>
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${era.palette.ink}" stroke-width="${era.lineWeight + 2}"/>
    ${props.map((p) => `<g class="prop ${p.kind}" data-prop="${p.id}">${(PROPS[p.art ?? ''] ?? PROPS.partition)(p, era)}</g>`).join('')}
    <g class="token" id="token"></g>
  </svg>`;
}

export function roomScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store, input } = ctx;
  const id = state.screen.id === 'room' ? state.screen.room : '';
  const room = content.rooms[id];
  if (!room) { store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }); return { input() {} }; }
  const era = content.eras[room.era];
  const cctx = conditionContext(content, state);
  const props = room.props.filter((p) => evalAll(p.requires, cctx));
  const solid = props.filter((p) => p.kind === 'solid' || p.kind === 'interact');

  html(root, `<section class="room">
    ${roomSvg(room, era, props)}
    <div class="hud panel"><div class="eyebrow">${esc(room.era)} · ${esc(room.subtitle)}</div><h2 style="font-size:20px">${esc(room.name)}</h2>
      <p class="small">Walk with the left stick or WASD. Stand at something and press A.</p></div>
    <div class="near-prompt panel" id="near" hidden></div>
  </section>`);

  const svg = root.querySelector('svg.room-svg') as SVGSVGElement;
  const token = root.querySelector('#token') as SVGGElement;
  const near = root.querySelector('#near') as HTMLElement;
  token.innerHTML = `<g transform="translate(-16 -30) scale(1.8)">${tokenSvg('auditor', accentFor(content, state, 'player')).replace('<svg ', '<svg width="18" height="22" ')}</g>`;

  let x = state.map.x || room.spawn.x;
  let y = state.map.y || room.spawn.y;
  if (x < 0 || x > room.width || y < 0 || y > room.height) { x = room.spawn.x; y = room.spawn.y; }
  let last = performance.now();
  let raf = 0;
  let done = false;
  let nearProp: RoomProp | null = null;
  let primed = false;

  const blocked = (nx: number, ny: number) => solid.some((p) =>
    nx + BODY > p.x && nx - BODY < p.x + p.w && ny + BODY > p.y && ny - BODY < p.y + p.h);
  const place = () => token.setAttribute('transform', `translate(${x} ${y})`);
  /** Reach is generous: standing beside a desk counts as standing at it. */
  const touching = (p: RoomProp) => x + 34 > p.x && x - 34 < p.x + p.w && y + 34 > p.y && y - 34 < p.y + p.h;

  const updateNear = () => {
    const p = props.find((q) => q.kind === 'interact' && touching(q)) ?? null;
    if (primed && p === nearProp) return;
    primed = true;
    nearProp = p;
    svg.querySelectorAll('.prop').forEach((el) => el.classList.toggle('near', (el as SVGGElement).dataset.prop === p?.id));
    if (p) {
      near.hidden = false;
      near.innerHTML = `<span class="prompt"><span class="glyph" data-btn="a"><span class="pad">A</span><span class="key">Enter</span></span><span>${esc(p.label ?? '')}</span></span>`;
    } else near.hidden = true;
    ctx.setPrompts(prompts(
      { btn: 'ls', label: 'Walk' },
      p ? { btn: 'a', label: p.label ?? 'Use' } : null,
      { btn: 'lb', label: 'Case log' }, { btn: 'start', label: 'Save' }, { btn: 'select', label: 'Settings' },
    ));
  };

  const use = () => {
    if (!nearProp?.dialogue) return;
    ctx.audio.sfx('confirm', state.era);
    store.dispatch({ type: 'SET_MAP_POS', x, y });
    store.dispatch({ type: 'START_DIALOGUE', id: nearProp.dialogue, returnTo: { id: 'room', room: room.id } });
  };

  const frame = (now: number) => {
    if (done) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const v = input.moveVector();
    if (!v.x && !v.y) return;
    // Axes resolve separately so a wall slides you along it rather than stopping you dead.
    const nx = Math.max(BODY + 4, Math.min(room.width - BODY - 4, x + v.x * SPEED * dt));
    const ny = Math.max(BODY + 4, Math.min(room.height - BODY - 4, y + v.y * SPEED * dt));
    if (!blocked(nx, y)) x = nx;
    if (!blocked(x, ny)) y = ny;
    place();
    updateNear();
  };
  place();
  updateNear();
  raf = requestAnimationFrame(frame);

  svg.querySelectorAll('.prop.interact').forEach((el) => el.addEventListener('click', () => {
    const p = props.find((q) => q.id === (el as SVGGElement).dataset.prop);
    if (!p?.dialogue) return;
    store.dispatch({ type: 'SET_MAP_POS', x, y });
    store.dispatch({ type: 'START_DIALOGUE', id: p.dialogue, returnTo: { id: 'room', room: room.id } });
  }));

  return {
    input(btn) {
      if (btn === 'a') use();
      else if (btn === 'lb') { store.dispatch({ type: 'SET_MAP_POS', x, y }); store.dispatch({ type: 'SET_SCREEN', screen: { id: 'log' } }); }
      else if (btn === 'start') { store.dispatch({ type: 'SET_MAP_POS', x, y }); store.dispatch({ type: 'SET_SCREEN', screen: { id: 'save' } }); }
      else if (btn === 'select') { store.dispatch({ type: 'SET_MAP_POS', x, y }); store.dispatch({ type: 'SET_SCREEN', screen: { id: 'settings' } }); }
    },
    destroy() { done = true; cancelAnimationFrame(raf); },
  };
}
