import { mountBackground, type BackgroundHandle } from '../art/backgrounds';
import { sceneAssetId } from '../art/pixel-backgrounds';
import { FILTER_DEFS } from '../art/rigs';
import type { AudioEngine } from '../audio/engine';
import type { Action } from '../core/actions';
import { activeVariant } from '../core/reducer';
import { deriveWorld } from '../core/timeline';
import type { Store } from '../core/store';
import type { Input } from '../input/input';
import { renderPrompts } from '../input/prompts';
import type { ContentDB, EraDef } from '../types/content';
import type { BattleLogEntry, GameState } from '../types/state';
import type { Ctx, ScreenFn, ScreenHandle } from './common';
import { advanceNarration, narrationPending, resetNarration, syncNarration } from './narration';
import { battleScreen } from './screens/battle';
import { dialogueScreen } from './screens/dialogue';
import { hubScreen } from './screens/hub';
import { logScreen } from './screens/log';
import { roomScreen } from './screens/room';
import { manualScreen } from './screens/manual';
import { rosterScreen } from './screens/roster';
import { mapScreen } from './screens/map';
import { gameOverScreen, newGameScreen, saveScreen, settingsScreen, titleScreen } from './screens/menus';
import { resultScreen, scanScreen } from './screens/scan';
import { inventoryScreen, shopScreen } from './screens/shop';
import { partyScreen, techScreen } from './screens/tech';

const SCREENS: Record<string, ScreenFn> = {
  title: titleScreen, newGame: newGameScreen, hub: hubScreen, map: mapScreen, timeJump: hubScreen,
  scan: scanScreen, battle: battleScreen, battleResult: resultScreen, dialogue: dialogueScreen,
  tech: techScreen, party: partyScreen, shop: shopScreen, inventory: inventoryScreen,
  save: saveScreen, gameOver: gameOverScreen, settings: settingsScreen, manual: manualScreen, roster: rosterScreen,
  log: logScreen, room: roomScreen,
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
    refresh: () => render(store.getState(), null),
    advanceNarration() {
      const state = store.getState();
      const next = advanceNarration();
      playPage(next, state.battle?.era ?? state.era);
      // Re-rendering runs driveBattle again, which releases the enemy once the queue empties.
      render(store.getState(), null);
    },
  };

  /** Sound and screen shake follow the narration box, so they land with the words. */
  function playPage(page: BattleLogEntry[] | null, era: string): void {
    if (!page) return;
    for (const line of page) {
      if (line.kind === 'hit') { ctx.shake(); audio.sfx(line.text.includes('chronal') ? 'chronal' : 'hit', era); }
      else if (line.kind === 'heal') audio.sfx('heal', era);
      else if (line.kind === 'tempo') audio.sfx('tempo', era);
      else if (line.kind === 'warn') audio.sfx('warn', era);
    }
  }

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
    const asset = sceneAssetId(loc, variant);
    const key = `${loc.id}|${asset}|${state.settings.reducedMotion}|${isBattle}`;
    applyEra(era, state.settings.reducedMotion);
    if (key !== bgKey) {
      bg?.destroy();
      bg = mountBackground(bgRoot, loc, era, flags, state.settings.reducedMotion, isBattle, asset);
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

  /** Queue new log lines before the screen draws, so the box lands in the same frame as the action. */
  function queueNarration(state: GameState): void {
    const b = state.battle;
    if (!b || state.screen.id !== 'battle') { resetNarration(); return; }
    playPage(syncNarration(b), b.era);
  }

  function driveBattle(state: GameState): void {
    clearTimeout(enemyTimer);
    const b = state.battle;
    if (!b || state.screen.id !== 'battle') return;
    // The enemy waits while the player is still reading.
    if (b.phase === 'enemy' && !narrationPending()) {
      enemyTimer = window.setTimeout(() => store.dispatch({ type: 'BATTLE_ENEMY_ACT' }), state.settings.reducedMotion ? 350 : 800);
    }
  }

  function render(state: GameState, action: Action | null): void {
    if (action?.type === 'SET_MAP_POS') return;
    if (state.started || ['title', 'newGame', 'settings', 'manual'].includes(state.screen.id)) syncBackground(state);
    queueNarration(state);
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
