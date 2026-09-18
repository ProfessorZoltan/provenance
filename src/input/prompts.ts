import type { Button } from './input';

type GlyphBtn = Button | 'ls' | 'rs' | 'dpad';

const PAD: Record<GlyphBtn, string> = {
  a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', start: '☰', select: '⧉',
  up: '▲', down: '▼', left: '◀', right: '▶', scrollUp: 'R▲', scrollDown: 'R▼', ls: 'L', rs: 'R', dpad: '✚',
};
const KEY: Record<GlyphBtn, string> = {
  a: 'Enter', b: 'Esc', x: 'X', y: 'Y', lb: 'Q', rb: 'E', lt: 'Z', rt: 'C', start: 'M', select: 'Tab',
  up: '↑', down: '↓', left: '←', right: '→', scrollUp: 'PgUp', scrollDown: 'PgDn', ls: 'WASD', rs: 'PgUp/Dn', dpad: '↑↓',
};

export function glyph(btn: GlyphBtn): string {
  return `<span class="glyph" data-btn="${btn}"><span class="pad">${PAD[btn]}</span><span class="key">${KEY[btn]}</span></span>`;
}

export interface Prompt {
  btn: GlyphBtn;
  label: string;
  disabled?: boolean;
}

export function promptHtml(p: Prompt): string {
  return `<span class="prompt${p.disabled ? ' disabled' : ''}">${glyph(p.btn)}<span>${p.label}</span></span>`;
}

export function renderPrompts(prompts: Prompt[]): void {
  const el = document.getElementById('prompts');
  if (el) el.innerHTML = prompts.map(promptHtml).join('');
}
