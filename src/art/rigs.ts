// Modular SVG rigs: head, torso, arms, legs, weapon as separate groups so poses can be tweened in CSS.
// Every figure passes the silhouette test in plain ink with one faction accent.

export type Pose = 'idle' | 'act' | 'hit' | 'down';

const VB = 'viewBox="0 0 100 140"';

export const FILTER_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="chromatic" x="-10%" y="-10%" width="120%" height="120%">
      <feOffset in="SourceGraphic" dx="2" dy="0" result="r"/>
      <feColorMatrix in="r" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rc"/>
      <feOffset in="SourceGraphic" dx="-2" dy="0" result="b"/>
      <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bc"/>
      <feBlend in="rc" in2="bc" mode="screen" result="rb"/>
      <feBlend in="SourceGraphic" in2="rb" mode="lighten"/>
    </filter>
  </defs>
</svg>`;

function human(opts: { ink: string; accent: string; build: 'slim' | 'robed' | 'broad' | 'armored'; weapon: string }): string {
  const { ink, accent, build, weapon } = opts;
  const torso =
    build === 'broad' ? `<path d="M30 52 L70 52 L74 96 L26 96 Z"/>`
    : build === 'robed' ? `<path d="M36 50 L64 50 L72 118 L28 118 Z"/>`
    : build === 'armored' ? `<path d="M32 50 L68 50 L70 98 L30 98 Z"/><rect x="36" y="56" width="28" height="30" fill="${accent}" opacity="0.9"/>`
    : `<path d="M36 50 L64 50 L66 100 L34 100 Z"/>`;
  const head =
    build === 'robed' ? `<path d="M34 34 Q50 8 66 34 L62 46 L38 46 Z"/><circle cx="50" cy="30" r="9" fill="${accent}"/>`
    : build === 'armored' ? `<rect x="38" y="16" width="24" height="26" rx="4"/><rect x="40" y="26" width="20" height="4" fill="${accent}"/>`
    : `<circle cx="50" cy="28" r="12"/>`;
  const legs = build === 'robed' ? '' : `<rect x="36" y="96" width="11" height="34" rx="2"/><rect x="53" y="96" width="11" height="34" rx="2"/>`;
  const arms = build === 'broad'
    ? `<g class="arm-l"><rect x="18" y="54" width="12" height="40" rx="5"/></g><g class="arm-r"><rect x="70" y="54" width="12" height="40" rx="5"/></g>`
    : `<g class="arm-l"><rect x="26" y="52" width="9" height="38" rx="4"/></g><g class="arm-r"><rect x="65" y="52" width="9" height="38" rx="4"/></g>`;
  return `
    <g class="rig-body" fill="${ink}">
      <g class="legs">${legs}</g>
      <g class="torso">${torso}</g>
      ${arms}
      <g class="head">${head}</g>
      <g class="weapon">${weapon}</g>
      <rect x="${build === 'broad' ? 26 : 34}" y="${build === 'robed' ? 116 : 130}" width="${build === 'broad' ? 48 : 32}" height="3" fill="${accent}"/>
    </g>`;
}

const RIGS: Record<string, (accent: string, ink: string) => string> = {
  auditor: (accent, ink) => human({ ink, accent, build: 'slim', weapon: `<rect x="72" y="70" width="16" height="22" rx="1" fill="${accent}"/><rect x="74" y="73" width="12" height="2" fill="${ink}"/><rect x="74" y="78" width="12" height="2" fill="${ink}"/>` }),
  wren: (accent, ink) => human({ ink, accent, build: 'robed', weapon: `<rect x="76" y="20" width="4" height="110" fill="${ink}"/><circle cx="78" cy="18" r="6" fill="none" stroke="${accent}" stroke-width="2"/>` }),
  dax: (accent, ink) => human({ ink, accent, build: 'broad', weapon: `<rect x="80" y="40" width="6" height="70" fill="${ink}"/><rect x="72" y="34" width="24" height="14" rx="2" fill="${accent}"/>` }),
  warden: (accent, ink) => human({ ink, accent, build: 'armored', weapon: `<rect x="74" y="60" width="5" height="50" rx="2" fill="${ink}"/><rect x="72" y="58" width="9" height="8" fill="${accent}"/>` }),
  drone_sentry: (accent, ink) => `
    <g class="rig-body" transform="translate(50 60)">
      <g class="rotor" fill="${ink}">
        <polygon points="0,-46 8,-30 -8,-30"/><polygon points="40,23 26,14 34,0"/><polygon points="-40,23 -34,0 -26,14"/>
      </g>
      <polygon points="0,-26 22,-13 22,13 0,26 -22,13 -22,-13" fill="${ink}"/>
      <polygon points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7" fill="none" stroke="${accent}" stroke-width="1.5"/>
      <circle r="4" fill="${accent}"/>
      <line x1="0" y1="26" x2="0" y2="70" stroke="${accent}" stroke-width="0.8" stroke-dasharray="3 5"/>
    </g>`,
  drone_hunter: (accent, ink) => `
    <g class="rig-body" transform="translate(50 60)">
      <g fill="${ink}">
        <polygon points="0,-50 10,-26 -10,-26"/><polygon points="50,0 26,10 26,-10"/><polygon points="0,50 -10,26 10,26"/><polygon points="-50,0 -26,-10 -26,10"/>
      </g>
      <rect x="-18" y="-18" width="36" height="36" transform="rotate(45)" fill="${ink}"/>
      <rect x="-9" y="-9" width="18" height="18" transform="rotate(45)" fill="none" stroke="${accent}" stroke-width="1.5"/>
      <circle r="3" fill="${accent}"/>
    </g>`,
  echo: (accent, ink) => human({ ink, accent, build: 'slim', weapon: '' }),
};

export function rigSvg(rig: string, accent: string, ink = 'currentColor', pose: Pose = 'idle', echo = false): string {
  const fn = RIGS[rig] ?? RIGS.auditor;
  return `<svg ${VB} xmlns="http://www.w3.org/2000/svg" class="rig ${echo ? 'echo-rig' : ''}"><g class="rig-${pose}">${fn(accent, ink)}</g></svg>`;
}

export function portraitSvg(rig: string, accent: string, ink = 'currentColor'): string {
  const fn = RIGS[rig] ?? RIGS.auditor;
  const box = rig.startsWith('drone') ? '0 0 100 120' : '18 4 64 64';
  return `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" class="portrait-svg">${fn(accent, ink)}</svg>`;
}

export function tokenSvg(rig: string, accent: string, ink = 'currentColor'): string {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="${ink}"/><circle cx="20" cy="20" r="7" fill="${accent}"/><title>${rig}</title></svg>`;
}
