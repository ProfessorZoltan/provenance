// Every background is a stack of four SVG layers plus one canvas of particles, driven by a shared
// parallax camera on a 12-second sinusoid. Art is keyed by id from the location JSON.

import type { BackgroundLayer, EraDef, LocationDef } from '../types/content';

const VB = 'viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice"';

type ArtFn = (era: EraDef, flags: string[]) => string;

const ART: Record<string, ArtFn> = {
  kell2312_sky: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <rect width="1600" height="900" fill="${era.palette.bg}"/>
      <g stroke="${era.palette.accent2}" stroke-width="0.5" opacity="0.5">
        ${Array.from({ length: 18 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="1600" y2="${i * 50}"/>`).join('')}
      </g>
      <g fill="${era.palette.surface}">
        <polygon points="0,620 260,380 520,620"/>
        <polygon points="380,620 700,300 1020,620"/>
        <polygon points="900,620 1180,360 1460,620"/>
        <polygon points="1300,620 1500,420 1700,620"/>
      </g>
      <g class="amb-pulse" fill="none" stroke="${era.palette.accent}" stroke-width="0.7">
        <circle cx="1180" cy="200" r="70"/><circle cx="1180" cy="200" r="52"/><circle cx="1180" cy="200" r="34"/>
        <line x1="1110" y1="200" x2="1250" y2="200"/><line x1="1180" y1="130" x2="1180" y2="270"/>
      </g>
      <g class="drift-cross" opacity="0.6" fill="${era.palette.ink}">
        <polygon points="0,150 14,146 28,150 14,154"/><circle cx="14" cy="150" r="2" fill="${era.palette.accent}"/>
      </g>
    </svg>`,
  kell2312_monastery: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <g class="amb-breathe" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="0.5">
        <rect x="380" y="430" width="840" height="300"/>
        <rect x="300" y="520" width="120" height="210"/><rect x="1180" y="520" width="120" height="210"/>
        <rect x="700" y="330" width="200" height="120"/>
        <polygon points="690,330 800,250 910,330"/>
        <g stroke="${era.palette.accent}" stroke-width="0.6" fill="none">
          ${Array.from({ length: 9 }, (_, i) => `<line x1="${720 + i * 20}" y1="350" x2="${720 + i * 20}" y2="430"/>`).join('')}
          ${Array.from({ length: 4 }, (_, i) => `<line x1="720" y1="${350 + i * 20}" x2="880" y2="${350 + i * 20}"/>`).join('')}
        </g>
        ${Array.from({ length: 10 }, (_, i) => `<rect x="${420 + i * 80}" y="470" width="24" height="60" fill="${era.palette.bg}"/>`).join('')}
        ${Array.from({ length: 10 }, (_, i) => `<rect x="${420 + i * 80}" y="580" width="24" height="60" fill="${era.palette.bg}"/>`).join('')}
        <rect x="770" y="620" width="60" height="110" fill="${era.palette.bg}"/>
      </g>
      <g stroke="${era.palette.ink}" stroke-width="0.5" fill="${era.palette.bg}">
        <rect x="200" y="700" width="1200" height="30"/><rect x="260" y="730" width="1080" height="30"/>
      </g>
    </svg>`,
  kell2312_village: (era, flags) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <g class="amb-breathe" fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="0.5">
        ${[220, 420, 620, 860, 1080, 1280].map((x, i) => `<rect x="${x}" y="${560 - (i % 2) * 20}" width="150" height="${170 + (i % 2) * 20}"/><polygon points="${x - 10},${560 - (i % 2) * 20} ${x + 75},${500 - (i % 2) * 20} ${x + 160},${560 - (i % 2) * 20}"/><rect x="${x + 60}" y="660" width="30" height="70" fill="${era.palette.bg}"/>`).join('')}
        <rect x="700" y="470" width="220" height="40"/><rect x="700" y="510" width="16" height="220"/><rect x="904" y="510" width="16" height="220"/>
      </g>
      ${flags.includes('armedResistance') ? `
      <g stroke="${era.palette.ink}" stroke-width="0.5" fill="${era.palette.surface}">
        <rect x="960" y="600" width="260" height="130"/>
        ${Array.from({ length: 24 }, (_, i) => `<line x1="${975 + (i % 8) * 30}" y1="${625 + Math.floor(i / 8) * 26}" x2="${995 + (i % 8) * 30}" y2="${625 + Math.floor(i / 8) * 26}" stroke="${era.palette.ink}"/>`).join('')}
        ${Array.from({ length: 5 }, (_, i) => `<line x1="${985 + i * 48}" y1="585" x2="${1005 + i * 48}" y2="560" stroke="var(--cinder)" stroke-width="3"/>`).join('')}
      </g>` : ''}
      ${flags.includes('letItFall') ? `
      <g class="amb-pulse" transform="translate(800 300)">
        <polygon points="-40,0 0,-12 40,0 0,12" fill="${era.palette.ink}"/>
        <circle r="5" fill="${era.palette.accent}"/>
        <line x1="0" y1="12" x2="0" y2="120" stroke="${era.palette.accent}" stroke-width="0.7" stroke-dasharray="4 6"/>
      </g>` : ''}
    </svg>`,
  kell2312_floor: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="720" width="1600" height="180" fill="${era.palette.bg}"/>
      <g stroke="${era.palette.accent2}" stroke-width="0.5" opacity="0.7">
        ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${730 + i * 22}" x2="1600" y2="${730 + i * 22}"/>`).join('')}
        ${Array.from({ length: 17 }, (_, i) => `<line x1="${i * 100}" y1="720" x2="${(i - 8) * 260 + 800}" y2="900"/>`).join('')}
      </g>
      <line x1="0" y1="720" x2="1600" y2="720" stroke="${era.palette.ink}" stroke-width="0.5"/>
    </svg>`,
  kell2312_fore: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <g class="amb-sway" stroke="${era.palette.ink}" stroke-width="0.5" fill="${era.palette.surface}">
        <rect x="-20" y="0" width="90" height="900"/><rect x="1530" y="0" width="90" height="900"/>
        <line x1="70" y1="120" x2="1530" y2="150" stroke="${era.palette.accent}" stroke-width="0.7"/>
        ${Array.from({ length: 12 }, (_, i) => `<rect x="${140 + i * 120}" y="${121 + i * 2.5}" width="26" height="18" fill="${i % 3 === 0 ? era.palette.accent : era.palette.surface}"/>`).join('')}
      </g>
    </svg>`,

  kell2148_sky: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.18"/></feComponentTransfer></filter>
      </defs>
      <rect width="1600" height="900" fill="${era.palette.bg}"/>
      <rect width="1600" height="900" filter="url(#grain)"/>
      <g fill="${era.palette.surface}" opacity="0.9">
        <polygon points="0,600 220,330 380,470 560,300 760,600"/>
        <polygon points="700,600 980,280 1300,600"/>
        <polygon points="1200,600 1420,380 1600,470 1600,600"/>
      </g>
      <g class="amb-fog" fill="${era.palette.ink}" opacity="0.08">
        <ellipse cx="400" cy="560" rx="520" ry="60"/><ellipse cx="1200" cy="600" rx="600" ry="50"/>
      </g>
      <g stroke="${era.palette.ink}" stroke-width="1" opacity="0.15">
        ${Array.from({ length: 40 }, (_, i) => `<line x1="${i * 41}" y1="${(i * 37) % 300}" x2="${i * 41 - 30}" y2="${(i * 37) % 300 + 140}"/>`).join('')}
      </g>
    </svg>`,
  kell2148_walls: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="${era.palette.ink}" stroke-width="1" opacity="0.35"/></pattern></defs>
      <g fill="${era.palette.surface}" stroke="${era.palette.ink}" stroke-width="1.5" stroke-linejoin="bevel">
        <path d="M360 440 L380 720 L1240 730 L1210 420 L1050 450 L900 400 L700 430 L560 380 Z"/>
        <path d="M280 540 L300 730 L400 730 L380 520 Z"/><path d="M1220 520 L1240 730 L1330 730 L1300 510 Z"/>
        <path d="M700 330 L710 440 L900 430 L890 320 Z"/>
        <path d="M690 330 L800 260 L900 320 Z" fill="${era.palette.ink}" opacity="0.7"/>
      </g>
      <rect x="360" y="400" width="880" height="330" fill="url(#hatch)"/>
      <g fill="${era.palette.ink}" opacity="0.8">
        ${Array.from({ length: 9 }, (_, i) => `<rect x="${430 + i * 90}" y="470" width="30" height="60"/>`).join('')}
        ${Array.from({ length: 9 }, (_, i) => `<rect x="${430 + i * 90}" y="590" width="30" height="60"/>`).join('')}
      </g>
      <g class="amb-flicker">
        ${[520, 1080].map((x) => `<ellipse cx="${x}" cy="700" rx="60" ry="24" fill="${era.palette.accent}" opacity="0.6"/><polygon points="${x - 14},700 ${x},640 ${x + 14},700" fill="#EF9F27"/><polygon points="${x - 6},700 ${x + 4},662 ${x + 12},700" fill="#F6E27A" opacity="0.9"/>`).join('')}
        <ellipse cx="800" cy="440" rx="90" ry="14" fill="${era.palette.accent}" opacity="0.12"/>
      </g>
      <g stroke="${era.palette.accent2}" stroke-width="1.5" fill="none" opacity="0.7">
        <path d="M400 560 q60 -40 120 0 t120 0" /><path d="M980 600 q40 -60 90 -10"/>
      </g>
      <g fill="#3B6D11" opacity="0.8">
        ${Array.from({ length: 14 }, (_, i) => `<ellipse cx="${380 + i * 62}" cy="${726 + (i % 3) * 3}" rx="18" ry="6"/>`).join('')}
      </g>
    </svg>`,
  kell2148_floor: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="720" width="1600" height="180" fill="${era.palette.surface}"/>
      <g stroke="${era.palette.ink}" stroke-width="1.5" opacity="0.5" stroke-dasharray="14 9 4 12">
        ${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${740 + i * 28} q400 ${(i % 2 ? 8 : -8)} 800 0 t800 0"/>`).join('')}
      </g>
      <g fill="${era.palette.ink}" opacity="0.35">
        ${Array.from({ length: 30 }, (_, i) => `<rect x="${(i * 97) % 1600}" y="${740 + (i * 53) % 140}" width="${8 + (i % 4) * 6}" height="3"/>`).join('')}
      </g>
      <g fill="#3B6D11" opacity="0.5">
        ${Array.from({ length: 10 }, (_, i) => `<ellipse cx="${(i * 173) % 1600}" cy="${750 + (i * 41) % 120}" rx="22" ry="5"/>`).join('')}
      </g>
    </svg>`,
  kell2148_fore: (era) => `
    <svg ${VB} xmlns="http://www.w3.org/2000/svg">
      <g class="amb-sway" stroke="${era.palette.ink}" stroke-width="2" fill="${era.palette.surface}">
        <path d="M-10 0 L60 0 L90 900 L-10 900 Z"/><path d="M1540 0 L1610 0 L1610 900 L1500 900 Z"/>
        <path d="M60 90 q500 120 1000 20 t500 60" fill="none" stroke="${era.palette.ink}" stroke-width="3"/>
        <path d="M60 130 q400 90 800 40 t700 60" fill="none" stroke="${era.palette.accent2}" stroke-width="1.5" opacity="0.6"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M${120 + i * 160} ${110 + (i % 3) * 14} l14 22 l-20 6 z" fill="#3B6D11"/>`).join('')}
      </g>
    </svg>`,
};

export function artFor(id: string, era: EraDef, flags: string[]): string {
  const fn = ART[id];
  if (!fn) return `<svg ${VB}><text x="40" y="80" fill="currentColor">missing art ${id}</text></svg>`;
  return fn(era, flags);
}

export interface BackgroundHandle {
  shake(): void;
  destroy(): void;
  setReducedMotion(v: boolean): void;
}

export function mountBackground(root: HTMLElement, loc: LocationDef, era: EraDef, flags: string[], reducedMotion: boolean): BackgroundHandle {
  root.innerHTML = '';
  const layers: { el: HTMLDivElement; drift: number }[] = [];
  for (const layer of loc.background.layers) {
    const el = document.createElement('div');
    el.className = 'layer';
    el.dataset.drift = String(layer.drift);
    el.style.zIndex = String(Math.round(layer.drift * 10));
    el.innerHTML = artFor(layer.art, era, flags);
    root.appendChild(el);
    layers.push({ el, drift: layer.drift });
  }
  const canvas = document.createElement('canvas');
  canvas.style.zIndex = '12';
  root.appendChild(canvas);
  const fade = document.createElement('div');
  fade.className = 'era-fade on';
  root.appendChild(fade);
  requestAnimationFrame(() => fade.classList.remove('on'));

  let reduced = reducedMotion;
  let raf = 0;
  const start = performance.now();
  const particles = makeParticles(loc.background.particles, era, reduced ? 20 : 45);

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = (now - start) / 1000;
    const dx = reduced ? 0 : Math.sin((t / 12) * Math.PI * 2) * 8;
    const dy = reduced ? 0 : Math.sin((t / 6) * Math.PI * 2) * 3;
    for (const l of layers) l.el.style.transform = `translate(${dx * l.drift}px, ${dy * l.drift}px)`;
    drawParticles(canvas, particles, reduced ? 0 : 1 / 60, dx * 1.2);
  };
  raf = requestAnimationFrame(frame);

  return {
    shake() {
      if (reduced) return;
      root.classList.remove('shake');
      void root.offsetWidth;
      root.classList.add('shake');
    },
    setReducedMotion(v) { reduced = v; },
    destroy() { cancelAnimationFrame(raf); },
  };
}

interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; }

function makeParticles(kind: string, era: EraDef, count: number): { kind: string; color: string; list: Particle[] } {
  const list: Particle[] = [];
  for (let i = 0; i < count; i++) list.push(spawn(kind, Math.random()));
  const color = kind === 'snow' ? era.palette.accent2 : kind === 'ash' ? '#B8AFA0' : era.palette.accent;
  return { kind, color, list };
}

function spawn(kind: string, y: number): Particle {
  if (kind === 'ash') return { x: Math.random(), y, vx: (Math.random() - 0.5) * 0.02, vy: -0.01 - Math.random() * 0.02, r: 1 + Math.random() * 2, a: 0.3 + Math.random() * 0.5 };
  return { x: Math.random(), y, vx: (Math.random() - 0.5) * 0.01, vy: 0.02 + Math.random() * 0.03, r: 1.5 + Math.random() * 2.5, a: 0.5 + Math.random() * 0.5 };
}

function drawParticles(canvas: HTMLCanvasElement, p: { kind: string; color: string; list: Particle[] }, dt: number, wind: number): void {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = p.color;
  for (const q of p.list) {
    q.x += q.vx * dt + wind * 0.00002;
    q.y += q.vy * dt;
    if (q.y > 1.05 || q.y < -0.05 || q.x < -0.05 || q.x > 1.05) Object.assign(q, spawn(p.kind, p.kind === 'ash' ? 1.02 : -0.02));
    ctx.globalAlpha = q.a;
    ctx.beginPath();
    ctx.arc(q.x * w, q.y * h, q.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function layerSummary(layers: BackgroundLayer[]): string {
  return layers.map((l) => `${l.id} ×${l.drift}`).join(', ');
}
