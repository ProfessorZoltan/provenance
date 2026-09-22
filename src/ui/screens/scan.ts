import type { GameState } from '../../types/state';
import { esc, html, prompts, type Ctx, type ScreenHandle } from '../common';

export function scanScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const scan = state.scan;
  if (!scan) { ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }); return { input() {} }; }
  const enc = ctx.content.encounters[scan.encounterId];
  html(root, `<section class="scan"><div class="card panel">
    <div class="eyebrow">Scan card · ${esc(ctx.content.eras[enc.era].name)}</div>
    <h2>${esc(enc.name)}</h2>
    <ul>${scan.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    <p class="small" style="margin-top:12px">Skipping costs nothing: no counter, no reinforcements, no harder next fight. Random battles never gate progression.</p>
    <div class="choice"><button class="prompt" id="fight"></button><button class="prompt" id="skip"></button></div>
  </div></section>`);
  const fight = () => { ctx.audio.sfx('confirm', state.era); ctx.store.dispatch({ type: 'SCAN_FIGHT' }); };
  const skip = () => { ctx.audio.sfx('cancel', state.era); ctx.store.dispatch({ type: 'SCAN_SKIP' }); };
  const f = root.querySelector('#fight') as HTMLButtonElement;
  const s = root.querySelector('#skip') as HTMLButtonElement;
  f.innerHTML = '<span class="glyph" data-btn="a"><span class="pad">A</span><span class="key">Enter</span></span> Fight';
  s.innerHTML = '<span class="glyph" data-btn="b"><span class="pad">B</span><span class="key">Esc</span></span> Skip';
  f.style.cssText = s.style.cssText = 'background:none;border:var(--line) solid var(--ink-soft);padding:8px 14px;border-radius:var(--radius);cursor:pointer';
  f.addEventListener('click', fight);
  s.addEventListener('click', skip);
  ctx.setPrompts(prompts({ btn: 'a', label: 'Fight' }, { btn: 'b', label: 'Skip (no penalty)' }));
  return { input(btn) { if (btn === 'a') fight(); else if (btn === 'b') skip(); } };
}

// A fight ends in a wall of narration the player dismisses with A, and the momentum of that
// carries straight through the rewards. They are on screen for one press either way, so the
// screen ignores input for a moment after it appears rather than being read at 100ms.
const SPOILS_GRACE_MS = 500;
let spoilsKey = '';
let spoilsShownAt = 0;

export function resultScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const b = state.battle;
  const r = b?.pendingRewards;
  const enc = b ? ctx.content.encounters[b.encounterId] : null;
  // Keyed on the fight, so a re-render (a device change, say) does not restart the grace period.
  const key = b ? `${b.encounterId}:${b.seed}` : '';
  if (spoilsKey !== key) { spoilsKey = key; spoilsShownAt = performance.now(); }
  const settled = () => performance.now() - spoilsShownAt >= SPOILS_GRACE_MS;
  const go = () => { if (settled()) ctx.store.dispatch({ type: 'SET_SCREEN', screen: { id: state.battleReturn } }); };
  const cur = b?.era === '2148' ? 'barter tokens' : 'allocation points';
  const flagText: Record<string, string> = {
    survivedSurprise: 'Held the line under a surprise attack.',
    killedWardenWithoutSignal: 'Put down a Warden without touching Signal.',
    facedOwnEcho: 'Faced an Echo of yourselves.',
    clearedGate: 'The gate is clear.',
  };
  html(root, `<section class="result"><div class="card panel">
    <div class="eyebrow">${esc(enc?.name ?? 'Battle')} · ${b?.round ?? 0} rounds</div>
    <h2>The field is clear.</h2>
    ${r ? `<ul>
      <li>${r.xp} XP to each party member</li>
      <li>${r.currency} ${cur}</li>
      ${r.items.map((i) => `<li>Found: ${esc(ctx.content.items[i]?.name ?? i)}</li>`).join('')}
      ${(r.leftBehind ?? []).map((i) => `<li class="small">Left behind, no room in the bag: ${esc(ctx.content.items[i]?.name ?? i)}</li>`).join('')}
      ${r.levelUps.map((l) => `<li><b>${esc(l)}</b>: +1 skill point</li>`).join('')}
      ${r.flags.filter((f) => flagText[f]).map((f) => `<li class="small">${flagText[f]}</li>`).join('')}
    </ul>` : ''}
    <p class="small">Entropy leaves the fight at ${b?.entropy ?? 0}, and comes into the next one there. Rewinds left unused: ${b?.rewindsLeft ?? 0}.</p>
  </div></section>`);
  root.querySelector('.card')!.addEventListener('click', go);
  ctx.setPrompts(prompts({ btn: 'a', label: 'Continue' }));
  return { input(btn) { if (btn === 'a' || btn === 'b') go(); } };
}
