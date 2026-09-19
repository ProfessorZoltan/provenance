import { mountBackground, type BackgroundHandle } from '../art/backgrounds';
import { FILTER_DEFS } from '../art/rigs';
import type { AudioEngine } from '../audio/engine';
import type { Action } from '../core/actions';
import { activeVariant } from '../core/reducer';
import { deriveWorld } from '../core/timeline';
import type { Store } from '../core/store';
import type { Input } from '../input/input';
import { renderPrompts } from '../input/prompts';
import type { ContentDB, EraDef } from '../types/content';
import type { GameState } from '../types/state';
import type { Ctx, ScreenFn, ScreenHandle } from './common';
import { battleScreen } from './screens/battle';
import { dialogueScreen } from './screens/dialogue';
import { hubScreen } from './screens/hub';
import { mapScreen } from './screens/map';
import { gameOverScreen, newGameScreen, saveScreen, settingsScreen, titleScreen } from './screens/menus';
import { resultScreen, scanScreen } from './screens/scan';
import { inventoryScreen, shopScreen } from './screens/shop';
import { partyScreen, techScreen } from './screens/tech';

const SCREENS: Record<string, ScreenFn> = {
  title: titleScreen, newGame: newGameScreen, hub: hubScreen, map: mapScreen, timeJump: hubScreen,
  scan: scanScreen, battle: battleScreen, battleResult: resultScreen, dialogue: dialogueScreen,
  tech: techScreen, party: partyScreen, shop: shopScreen, inventory: inventoryScreen,
  save: saveScreen, gameOver: gameOverScreen, settings: settingsScreen,
};

export function createApp(store: Store, content: ContentDB, input: Input, audio: AudioEngine): void {
  const screenRoot = document.getElementById('screen')!;
  const bgRoot = document.getElementById('bg')!;
  const toastEl = document.getElementById('toast')!;
  document.getElementById('app')!.insertAdjacentHTML('afterbegin', FILTER_DEFS);

  let handle: ScreenHandle | null = null;
  let bg: BackgroundHandle | null = null;
  let bgKey = '';
  let toastTimer = 0;
  let enemyTimer = 0;
  let lastLogLen = 0;
  let lastScreen = '';

  const ctx: Ctx = {
    store, content, input, audio,
    toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2200);
    },
    setPrompts: renderPrompts,
    shake: () => bg?.shake(),
  };

  function applyEra(era: EraDef, reduced: boolean): void {
    const r = document.documentElement.style;
    r.setProperty('--bg', era.palette.bg);
    r.setProperty('--surface', era.palette.surface);
    r.setProperty('--ink', era.palette.ink);
    r.setProperty('--accent', era.palette.accent);
    r.setProperty('--accent2', era.palette.accent2);
    r.setProperty('--line', `${era.lineWeight}px`);
    r.setProperty('--font', era.fontStack);
    document.body.dataset.era = era.id;
    document.body.dataset.reducedMotion = String(reduced);
  }

  function syncBackground(state: GameState): void {
    const loc = content.locations[state.location];
    const era = content.eras[state.era];
    if (!loc || !era) return;
    const derived = deriveWorld(content, state.world, state.party);
    const flags = [...state.flags, ...derived.flags];
    const variant = activeVariant(content, state, loc);
    const isBattle = state.screen.id === 'battle';
    const key = `${loc.id}|${variant?.shop ?? ''}|${state.settings.reducedMotion}|${isBattle}|${flags.join(',')}`;
    applyEra(era, state.settings.reducedMotion);
    if (key !== bgKey) {
      bg?.destroy();
      bg = mountBackground(bgRoot, loc, era, flags, state.settings.reducedMotion, isBattle);
      bgKey = key;
    }
  }

  function syncMusic(state: GameState): void {
    const era = content.eras[state.era];
    if (state.screen.id === 'title' || state.screen.id === 'newGame') {
      audio.play(content.scores.hub_2312, content.eras['2312']);
      audio.setTempo(0);
      audio.setEntropy(0);
      return;
    }
    if (state.battle && state.screen.id === 'battle') {
      const enc = content.encounters[state.battle.encounterId];
      audio.play(content.scores[enc.music], era);
      audio.setTempo(state.battle.tempo);
      audio.setEntropy(state.battle.entropy);
      return;
    }
    const loc = content.locations[state.location];
    if (loc) audio.play(content.scores[loc.music], era);
    audio.setTempo(0);
    audio.setEntropy(0);
  }

  function driveBattle(state: GameState): void {
    clearTimeout(enemyTimer);
    const b = state.battle;
    if (!b || state.screen.id !== 'battle') { lastLogLen = 0; return; }
    // Sound and shake for new log lines.
    const fresh = b.log.slice(lastLogLen);
    lastLogLen = b.log.length;
    for (const line of fresh) {
      if (line.kind === 'hit') { ctx.shake(); audio.sfx(line.text.includes('chronal') ? 'chronal' : 'hit', b.era); }
      else if (line.kind === 'heal') audio.sfx('heal', b.era);
      else if (line.kind === 'tempo') audio.sfx('tempo', b.era);
      else if (line.kind === 'warn') audio.sfx('warn', b.era);
    }
    if (b.phase === 'enemy') {
      enemyTimer = window.setTimeout(() => store.dispatch({ type: 'BATTLE_ENEMY_ACT' }), state.settings.reducedMotion ? 350 : 800);
    }
  }

  function render(state: GameState, action: Action | null): void {
    if (action?.type === 'SET_MAP_POS') return;
    if (state.started || state.screen.id === 'title' || state.screen.id === 'newGame' || state.screen.id === 'settings') syncBackground(state);
    const fn = SCREENS[state.screen.id] ?? titleScreen;
    handle?.destroy?.();
    if (lastScreen !== state.screen.id) screenRoot.scrollTop = 0;
    lastScreen = state.screen.id;
    handle = fn(screenRoot, ctx, state);
    syncMusic(state);
    driveBattle(state);
    void action;
  }

  input.on((btn) => {
    if (!audio.isStarted() && input.getDevice() === 'keyboard') void audio.start();
    if (['up', 'down', 'left', 'right'].includes(btn) && store.getState().screen.id !== 'map') audio.sfx('move', store.getState().era);
    handle?.input(btn);
  });
  input.deviceChanged(() => render(store.getState(), null));
  window.addEventListener('pointerdown', () => { if (!audio.isStarted()) void audio.start(); }, { passive: true });

  store.subscribe(render);
  render(store.getState(), null);
}
