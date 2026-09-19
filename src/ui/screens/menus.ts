import { hasLocalSave, loadFromLocal, saveToLocal, serialize, deserialize } from '../../core/save';
import { seedFromString } from '../../core/rng';
import type { GameState } from '../../types/state';
import { glyph } from '../../input/prompts';
import { esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { menu } from '../menu';

const mem: Record<string, number> = {};

export function titleScreen(root: HTMLElement, ctx: Ctx, _state: GameState): ScreenHandle {
  const saved = hasLocalSave();
  html(root, `<section class="title">
    <div>
      <div class="eyebrow">2312 · Enclave 7 · Allocation Office</div>
      <h1>PROVENANCE</h1>
      <p class="tag">The record of who owned something, and when. Five sites, four eras, and a budget line that predates the Steward.</p>
    </div>
    <div id="title-menu"></div>
    <p class="small">${ctx.audio.isStarted() ? 'Sound on.' : 'Press a key or click once to enable sound.'} ${ctx.input.hasGamepad() ? 'Controller detected.' : 'Controller supported: press any button on it to switch prompts.'}</p>
  </section>`);
  const m = menu([
    { id: 'new', label: 'New game', hint: 'Choose a stance, then Kell Monastery', onSelect: () => ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'newGame' } }) },
    { id: 'continue', label: 'Continue', hint: saved ? 'From the browser save' : 'No save found', disabled: !saved, onSelect: () => {
      const s = loadFromLocal();
      if (s) ctx.store.dispatch({ type: 'LOAD_STATE', state: s });
    } },
    { id: 'import', label: 'Import save file', hint: 'JSON exported earlier', onSelect: () => importSave(ctx) },
    { id: 'manual', label: 'Player manual', hint: 'How to play, and what the gauges mean', onSelect: () => ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'manual' } }) },
    { id: 'settings', label: 'Settings', shortcut: 'select', onSelect: () => ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'settings' } }) },
  ], mem.title ?? 0, (i) => { mem.title = i; });
  root.querySelector('#title-menu')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move' }, { btn: 'a', label: 'Select' }, { btn: 'select', label: 'Settings' }));
  return { input: (btn) => { if (m.input(btn)) ctx.audio.sfx(btn === 'a' ? 'confirm' : 'move', '2312'); } };
}

export function importSave(ctx: Ctx): void {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0];
    if (!f) return;
    try {
      const s = deserialize(await f.text());
      ctx.store.dispatch({ type: 'LOAD_STATE', state: s });
      ctx.toast('Save imported.');
    } catch (e) {
      ctx.toast(`Import failed: ${(e as Error).message}`);
    }
  });
  inp.click();
}

export function exportSave(ctx: Ctx, state: GameState): void {
  const blob = new Blob([serialize(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `provenance-save-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ctx.toast('Save exported.');
}

const STANCES = [
  { id: 'cinder', name: 'Cinder', color: 'var(--cinder)', text: 'Every model burns, including the good ones. Start at Sync -30: Overload comes sooner, Parley later. Dax approves.' },
  { id: 'commons', name: 'Commons', color: 'var(--commons)', text: 'AI owned by everyone, ruled by no one. Start at Sync 0: nothing locked out, nothing gifted. The only road to The Commons ending.' },
  { id: 'choir', name: 'Choir', color: 'var(--choir)', text: 'The Steward is humanity\'s better self and only needs freeing. Start at Sync +30: Parley opens early; Dax will watch you.' },
] as const;

export function newGameScreen(root: HTMLElement, ctx: Ctx, _state: GameState): ScreenHandle {
  let idx = mem.stance ?? 1;
  const draw = () => {
    html(root, `<section>
      <div class="eyebrow" style="text-align:center;margin-bottom:14px">The Auditor's stance on the Steward</div>
      <div class="stance">${STANCES.map((s, i) => `<div class="card ${i === idx ? 'focused' : ''}" style="--stance-color:${s.color}" data-i="${i}"><h3>${s.name}</h3><p class="small">${s.text}</p></div>`).join('')}</div>
      <p class="small" style="text-align:center;margin-top:18px">Sync moves through dialogue afterwards. The party average gates faction content; it is never shown as a number.</p>
    </section>`);
    root.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { idx = Number((c as HTMLElement).dataset.i); mem.stance = idx; start(); }));
  };
  const start = () => ctx.store.dispatch({ type: 'NEW_GAME', seed: seedFromString(`${Date.now()}:${Math.random()}`), lean: STANCES[idx].id });
  draw();
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose stance' }, { btn: 'a', label: 'Begin' }, { btn: 'b', label: 'Back' }));
  return {
    input(btn) {
      if (btn === 'left' || btn === 'lb') { idx = (idx + 2) % 3; mem.stance = idx; draw(); }
      else if (btn === 'right' || btn === 'rb') { idx = (idx + 1) % 3; mem.stance = idx; draw(); }
      else if (btn === 'a') { ctx.audio.sfx('confirm', '2312'); start(); }
      else if (btn === 'b') ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'title' } });
    },
  };
}

export function settingsScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const s = state.settings;
  const back = () => ctx.store.dispatch({ type: 'SET_SCREEN', screen: state.started ? state.back : { id: 'title' } });
  html(root, `<section class="center"><div class="card panel settings">
    <div class="eyebrow">Settings</div>
    <div id="m"></div>
    <p class="small" style="margin-top:12px">Keyboard: ${glyph('dpad')} move · Enter confirm · Esc back · X, Y, Q (LB), E (RB), Z (LT), C (RT), M (menu), Tab (select). A standard-mapping controller works as soon as you press a button on it.</p>
  </div></section>`);
  const m = menu([
    { id: 'motion', label: `Reduced motion: ${s.reducedMotion ? 'on' : 'off'}`, hint: 'Freezes the camera, halves particles', onSelect: () => ctx.store.dispatch({ type: 'SET_SETTINGS', settings: { reducedMotion: !s.reducedMotion } }) },
    { id: 'music', label: `Music volume: ${Math.round(s.musicVolume * 100)}%`, hint: '← → adjust' },
    { id: 'sfx', label: `Effects volume: ${Math.round(s.sfxVolume * 100)}%`, hint: '← → adjust' },
    { id: 'manual', label: 'Player manual', hint: 'How to play, and what the gauges mean', onSelect: () => ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'manual' } }) },
    { id: 'back', label: 'Back', shortcut: 'b', onSelect: back },
  ], mem.settings ?? 0, (i) => { mem.settings = i; });
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move / adjust' }, { btn: 'a', label: 'Toggle' }, { btn: 'b', label: 'Back' }));
  return {
    input(btn) {
      const cur = m.current()?.id;
      if ((btn === 'left' || btn === 'right') && (cur === 'music' || cur === 'sfx')) {
        const key = cur === 'music' ? 'musicVolume' : 'sfxVolume';
        const v = Math.max(0, Math.min(1, Math.round((s[key] + (btn === 'right' ? 0.1 : -0.1)) * 10) / 10));
        ctx.store.dispatch({ type: 'SET_SETTINGS', settings: { [key]: v } });
        ctx.audio.setVolumes(key === 'musicVolume' ? v : s.musicVolume, key === 'sfxVolume' ? v : s.sfxVolume);
        return;
      }
      m.input(btn);
    },
  };
}

export function saveScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const back = () => ctx.store.dispatch({ type: 'SET_SCREEN', screen: state.back });
  const snaps = state.world.snapshots;
  html(root, `<section class="center"><div class="card panel">
    <div class="eyebrow">Save and load</div>
    <div id="m"></div>
    <div class="small" style="margin-top:14px">
      <div class="eyebrow">Timeline snapshots kept with this save (last three)</div>
      ${snaps.length ? snaps.map((sn) => `<div>${esc(sn.label)} · ${sn.history.length} edit${sn.history.length === 1 ? '' : 's'} in history</div>`).join('') : '<div>No timeline edits yet.</div>'}
    </div>
  </div></section>`);
  const m = menu([
    { id: 'save', label: 'Save to this browser', hint: 'One slot, localStorage', onSelect: () => ctx.toast(saveToLocal(state) ? 'Saved.' : 'Could not save: storage blocked.') },
    { id: 'load', label: 'Load from this browser', disabled: !hasLocalSave(), onSelect: () => { const s = loadFromLocal(); if (s) { ctx.store.dispatch({ type: 'LOAD_STATE', state: s }); ctx.toast('Loaded.'); } } },
    { id: 'export', label: 'Export save file', hint: 'Downloads a JSON file', onSelect: () => exportSave(ctx, state) },
    { id: 'import', label: 'Import save file', onSelect: () => importSave(ctx) },
    { id: 'back', label: 'Back', shortcut: 'b', onSelect: back },
  ], mem.save ?? 0, (i) => { mem.save = i; });
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'dpad', label: 'Move' }, { btn: 'a', label: 'Select' }, { btn: 'b', label: 'Back' }));
  return { input: (btn) => { m.input(btn); } };
}

export function gameOverScreen(root: HTMLElement, ctx: Ctx, _state: GameState): ScreenHandle {
  html(root, `<section class="center"><div class="card panel">
    <div class="eyebrow">The party falls</div>
    <h2>Wren drags everyone back.</h2>
    <p class="small" style="margin:10px 0 14px">Nothing is lost but the fight. The party wakes at the Deep Site at a quarter Resolve.</p>
    <div id="m"></div>
  </div></section>`);
  const m = menu([
    { id: 'return', label: 'Wake at the Deep Site', onSelect: () => ctx.store.dispatch({ type: 'GAME_OVER_RETURN' }) },
    { id: 'load', label: 'Load the last save', disabled: !hasLocalSave(), onSelect: () => { const s = loadFromLocal(); if (s) ctx.store.dispatch({ type: 'LOAD_STATE', state: s }); } },
  ]);
  root.querySelector('#m')!.appendChild(m.el);
  ctx.setPrompts(prompts({ btn: 'a', label: 'Select' }));
  return { input: (btn) => { m.input(btn); } };
}
