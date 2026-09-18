import type { Button } from '../input/input';
import type { Prompt } from '../input/prompts';
import type { AudioEngine } from '../audio/engine';
import type { ContentDB } from '../types/content';
import type { GameState } from '../types/state';
import type { Store } from '../core/store';
import type { Input } from '../input/input';
import { portraitSvg } from '../art/rigs';
import { loadout } from '../core/stats';
import { deriveWorld } from '../core/timeline';

export interface Ctx {
  store: Store;
  content: ContentDB;
  input: Input;
  audio: AudioEngine;
  toast(msg: string): void;
  setPrompts(p: Prompt[]): void;
  shake(): void;
}

export interface ScreenHandle {
  input(btn: Button): void;
  destroy?(): void;
}

export type ScreenFn = (root: HTMLElement, ctx: Ctx, state: GameState) => ScreenHandle;

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

export function html(root: HTMLElement, markup: string): HTMLElement {
  root.innerHTML = markup;
  return root;
}

export const LEAN_COLOR: Record<string, string> = {
  cinder: 'var(--cinder)', choir: 'var(--choir)', commons: 'var(--commons)', chosen: 'var(--accent)', unknown: 'var(--accent2)',
};

export function accentFor(content: ContentDB, state: GameState, id: string): string {
  const def = content.characters[id];
  if (!def) return 'var(--accent)';
  if (id === 'player') {
    const lean = state.flags.find((f) => f.startsWith('lean:'))?.slice(5) ?? 'chosen';
    return LEAN_COLOR[lean] ?? def.accent;
  }
  return def.accent;
}

export function partyStrip(ctx: Ctx, state: GameState): string {
  const { content } = ctx;
  const derived = deriveWorld(content, state.world, state.party);
  return state.activeParty.map((id) => {
    const def = content.characters[id];
    const cs = state.party[id];
    const l = loadout(content, def, cs);
    const pct = Math.round((cs.hp / l.stats.resolve) * 100);
    return `<div class="member panel">
      <div class="portrait">${portraitSvg(def.rig, accentFor(content, state, id))}</div>
      <div>
        <div class="name"><b>${esc(def.shortName)}</b><span>Lv ${cs.level}${cs.skillPoints ? ` · ${cs.skillPoints} SP` : ''}</span></div>
        <div class="bar hp"><i style="width:${pct}%"></i></div>
        <div class="hp-lbl">${cs.hp}/${l.stats.resolve} Resolve · Continuity ${derived.continuity[id]}</div>
      </div>
    </div>`;
  }).join('');
}

export function prompts(...list: (Prompt | false | null | undefined)[]): Prompt[] {
  return list.filter((p): p is Prompt => !!p);
}
