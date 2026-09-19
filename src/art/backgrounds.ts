import type { BackgroundLayer, EraDef, LocationDef } from '../types/content';
import { pixelBackground, sceneAssetId, sceneSvg } from './pixel-backgrounds';
import { artAssetUrl } from './library';

export const artFor = pixelBackground;
export interface BackgroundHandle {
  shake(): void;
  destroy(): void;
  setReducedMotion(v: boolean): void;
}

export function mountBackground(root: HTMLElement, loc: LocationDef, era: EraDef, flags: string[], reducedMotion: boolean, battle = false, assetId?: string): BackgroundHandle {
  root.innerHTML = '';
  const layers: { el: HTMLDivElement; drift: number }[] = [];
  const asset = assetId ?? sceneAssetId(loc);
  const roles = ['sky', 'distant', 'midground', 'foreground'];
  const hasScene = roles.every(role => artAssetUrl(asset, role));
  const sceneLayers = hasScene ? roles.map((role, i) => ({ art: `${asset}:${role}`, drift: [0.1, 0.3, 0.6, 1][i] })) : loc.background.layers;
  const composedBattle = battle ? sceneSvg(asset, 'battle') : undefined;
  const renderLayers = composedBattle ? [{art: `${asset}:battle`, drift: 0.6}] : sceneLayers;
  for (const layer of renderLayers) {
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
