import { artAssetUrl } from '../../art/library';
import { rigSvg } from '../../art/rigs';
import { abilityOptions, current, hasStatus, validTargets } from '../../core/battle/battle';
import type { AbilityDef } from '../../types/content';
import type { BattleState, Combatant, GameState } from '../../types/state';
import type { Button } from '../../input/input';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { currentPage, narrationPending } from '../narration';
import { menu, type MenuItem } from '../menu';

type Mode = 'menu' | 'target' | 'items' | 'itemTarget' | 'forkPick' | 'forkTarget' | 'inspect';

interface UI {
  encounter: string;
  mode: Mode;
  ability: string | null;
  item: string | null;
  targetIdx: number;
  menuIdx: number;
  logScroll: number;
  lastActor: string;
}

const ui: UI = { encounter: '', mode: 'menu', ability: null, item: null, targetIdx: 0, menuIdx: 0, logScroll: 0, lastActor: '' };

function reset(b: BattleState): void {
  ui.encounter = b.encounterId + ':' + b.seed;
  ui.mode = 'menu';
  ui.ability = null;
  ui.item = null;
  ui.targetIdx = 0;
  ui.menuIdx = 0;
  ui.logScroll = 0;
}

const STATUS_LABEL: Record<string, string> = {
  guard: 'Guard', taunt: 'Bulwark', marked: 'Marked', inspired: 'Litany', anchored: 'Anchored', fixed: 'Fixed Point',
  faraday: 'Faraday', fear: 'Fear', locked: 'Locked',
};

function statusText(c: Combatant): string {
  const counts = new Map<string, number>();
  for (const s of c.statuses) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
  return [...counts.entries()].map(([id, n]) => `${STATUS_LABEL[id] ?? id}${n > 1 ? ` ×${n}` : ''}`).join(' · ');
}

function tempoRing(tempo: number, max: number): string {
  const r = 40, c = 2 * Math.PI * r;
  const pct = Math.min(1, tempo / max);
  return `<svg class="tempo-ring" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="color-mix(in srgb, var(--ink) 15%, transparent)" stroke-width="7"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--choir)" stroke-width="7" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 400ms"/>
    <text x="50" y="47" text-anchor="middle" font-size="20" fill="var(--ink)">${tempo}</text>
    <text x="50" y="64" text-anchor="middle" font-size="9" fill="var(--ink)" opacity=".7">TEMPO</text>
  </svg>`;
}

export function battleScreen(root: HTMLElement, ctx: Ctx, state: GameState): ScreenHandle {
  const { content, store } = ctx;
  const b = state.battle;
  if (!b) { store.dispatch({ type: 'SET_SCREEN', screen: { id: 'hub' } }); return { input() {} }; }
  if (ui.encounter !== b.encounterId + ':' + b.seed) reset(b);
  const rules = content.rules;
  const actor = current(b);
  const playerTurn = b.phase === 'player' && !!actor && actor.side === 'party';
  if (actor && actor.id !== ui.lastActor) { ui.lastActor = actor.id; ui.mode = 'menu'; ui.menuIdx = 0; }
  const over = b.phase === 'won' || b.phase === 'lost';
  const enemies = b.combatants.filter((c) => c.side === 'enemy');
  const party = b.combatants.filter((c) => c.side === 'party');
  const rerender = () => store.dispatch({ type: 'SET_SCREEN', screen: { id: 'battle' } });

  // Targets for the current selection mode.
  let targets: Combatant[] = [];
  if (actor && (ui.mode === 'target' || ui.mode === 'forkTarget') && ui.ability) targets = validTargets(b, actor.id, content.abilities[ui.ability]);
  if (ui.mode === 'itemTarget') targets = party.filter((p) => !p.down || content.items[ui.item ?? '']?.effect?.revive);
  if (targets.length) ui.targetIdx = ((ui.targetIdx % targets.length) + targets.length) % targets.length;
  const targeted = targets[ui.targetIdx];

  const rigFor = (c: Combatant): string => {
    if (c.side === 'party') return rigSvg(content.characters[c.ref].rig, accentFor(content, state, c.ref), 'currentColor', c.down ? 'down' : 'idle');
    if (c.echoOf) return rigSvg(content.characters[c.echoOf].rig, accentFor(content, state, c.echoOf), 'currentColor', c.down ? 'down' : 'idle', true, b.era);
    const def = content.enemies[c.ref];
    const accent = c.family === 'echo' ? 'var(--choir)' : c.family === 'warden' ? 'var(--cinder)' : 'var(--accent)';
    const baseRig = def?.rig ?? 'auditor';
    const eraRig = `${baseRig}_${b.era}`;
    return rigSvg(artAssetUrl(eraRig, 'idle') ? eraRig : baseRig, accent, 'currentColor', c.down ? 'down' : 'idle', c.family === 'echo');
  };

  const entropyClass = b.entropy >= rules.entropyThreshold ? 'e3' : b.entropy >= 50 ? 'e2' : b.entropy >= 25 ? 'e1' : '';
  const logLines = b.log.slice(Math.max(0, b.log.length - 16 - ui.logScroll), b.log.length - ui.logScroll);

  const page = currentPage();
  const narrating = narrationPending();

  html(root, `<section class="battle">
    <div class="stage"><div class="field-label">${esc(content.locations[state.location].name)} / ${esc(b.era)}</div>
      ${page ? `<div class="narration" role="alert"><div class="narration-box">${page.map((line) => {
        const who = line.actor && line.target && line.actor !== line.target ? `${line.actor} → ${line.target}` : line.actor ?? '';
        const head = [who, line.ability].filter(Boolean).join(' · ');
        return `${head ? `<div class="eyebrow">${esc(head)}</div>` : ''}<p class="${line.kind}">${esc(line.text)}</p>`;
      }).join('')}<div class="narration-more"><span class="glyph" data-btn="a"><span class="pad">A</span><span class="key">Enter</span></span> Continue</div></div></div>` : ''}
      <div class="frame ${entropyClass}"></div>
      <div class="enemies">${enemies.map((e) => `<div class="enemy ${e.down ? 'down' : ''} ${targeted?.id === e.id ? 'targeted' : ''} ${actor?.id === e.id ? 'acting' : ''}" data-id="${e.id}">
        <div class="rig">${rigFor(e)}</div>
        <div class="nm"><span>${esc(e.name)}</span>${hasStatus(e, 'marked') ? '<span class="marker">MARKED</span>' : ''}</div>
        <div class="bar hp"><i style="width:${Math.round((e.hp / e.maxHp) * 100)}%"></i></div>
        ${e.maxShield ? `<div class="bar shield" style="margin-top:2px"><i style="width:${Math.round((e.shield / e.maxShield) * 100)}%"></i></div>` : ''}
        <div class="st">${hasStatus(e, 'marked') || b.combatants.some((c) => c.side === 'party' && c.ref === 'player' && (b.passives.player?.markDuration ?? 0) > 0) ? `${e.hp}/${e.maxHp}${e.maxShield ? ` · shield ${e.shield}` : ''} · weak: ${e.weakness ?? 'none'}` : e.parleyed ? 'talked down' : e.down ? 'down' : statusText(e) || '&nbsp;'}</div>
      </div>`).join('')}</div>
      <div class="actorsrow">${party.map((p) => `<div class="actor ${p.down ? 'down' : ''} ${actor?.id === p.id ? 'active' : ''} ${targeted?.id === p.id ? 'targeted' : ''}">${rigFor(p)}</div>`).join('')}</div>
    </div>
    <div class="telemetry"><div class="gauges panel">
      ${tempoRing(b.tempo, rules.tempoMax)}
      <div>
        <div class="small">Round ${b.round} · ${b.surprise ? 'Surprise attack' : content.encounters[b.encounterId].name}</div>
        <div class="entropy ${b.entropy >= rules.entropyThreshold ? 'high' : ''}" style="margin-top:8px">Entropy ${b.entropy} / ${rules.entropyMax}<div class="bar" style="margin-top:3px"><i style="width:${b.entropy}%"></i></div></div>
        <div class="small" style="margin-top:6px">Rewinds ${b.rewindsLeft} · ${b.echoSpawned ? 'An Echo has answered' : b.entropy >= rules.entropyThreshold ? 'Echoes answer above ' + rules.entropyThreshold : 'Echoes answer above ' + rules.entropyThreshold}</div>
      </div>
    </div>
    <div class="side">
      ${b.fork ? `<div class="panel fork"><div class="eyebrow">Fork · ${esc(content.abilities[b.fork.abilityId].name)}${b.fork.targetId ? ' on ' + esc(b.combatants.find((c) => c.id === b.fork!.targetId)?.name ?? '') : ''}</div><ul class="small">${b.fork.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><div class="small" style="margin-top:6px">X commits this exact outcome.</div></div>` : ''}
      <div class="panel log" id="log">${logLines.map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join('')}</div>
    </div>
    </div><div class="bottom">
      ${party.map((p) => {
        const cap = rules.slackCap + (b.passives[p.id]?.slackCap ?? 0);
        return `<div class="card panel ${actor?.id === p.id ? 'active' : ''} ${p.down ? 'down' : ''} ${targeted?.id === p.id ? 'targeted' : ''}">
          <div style="display:flex;justify-content:space-between"><b>${esc(p.name)}</b><span class="small">${p.hp}/${p.maxHp}</span></div>
          <div class="bar hp" style="margin:4px 0"><i style="width:${Math.round((p.hp / p.maxHp) * 100)}%"></i></div>
          <div class="threads" title="Threads and Slack">${Array.from({ length: p.stats.bandwidth + cap }, (_, i) => `<i class="${i < p.threads ? 'on' : i >= p.stats.bandwidth && i - p.stats.bandwidth < p.slack ? 'slack' : ''}"></i>`).join('')}</div>
          <div class="st">${p.down ? 'Down' : `${p.threads} threads${p.slack ? ` · ${p.slack} Slack` : ''}${statusText(p) ? ' · ' + statusText(p) : ''}`}</div>
        </div>`;
      }).join('')}
      <div class="card panel actionmenu" id="actions"></div>
    </div>
  </section>`);

  // ----- action panel -----
  const actions = root.querySelector('#actions') as HTMLElement;
  let m: ReturnType<typeof menu> | null = null;
  const setMode = (mode: Mode, extra: Partial<UI> = {}) => { Object.assign(ui, { mode }, extra); rerender(); };

  const abilityItems = (forFork: boolean): MenuItem[] => {
    if (!actor) return [];
    return abilityOptions(b, actor.id, content).map((o) => ({
      id: o.ability.id,
      label: o.ability.name,
      cost: `${o.ability.cost}⟋${o.ability.damageType ? ' ' + o.ability.damageType : ''}`,
      hint: o.usable ? o.ability.description : `${o.reason}. ${o.ability.description}`,
      disabled: !o.usable || (forFork && actor.threads < o.ability.cost + rules.fork.threadCost),
      onSelect: () => beginAbility(o.ability, forFork),
    }));
  };
  const beginAbility = (a: AbilityDef, forFork: boolean) => {
    if (!actor) return;
    const needsPick = a.target === 'enemy' || a.target === 'ally';
    if (needsPick) { setMode(forFork ? 'forkTarget' : 'target', { ability: a.id, targetIdx: 0 }); return; }
    commit(a.id, null, forFork);
  };
  const commit = (ability: string, target: string | null, forFork: boolean) => {
    if (!actor) return;
    // Reset the mode before dispatching: the store re-renders synchronously.
    const prev = { mode: ui.mode, ability: ui.ability };
    ui.mode = 'menu';
    ui.ability = null;
    if (forFork) store.dispatch({ type: 'BATTLE_FORK', actor: actor.id, ability, target });
    else store.dispatch({ type: 'BATTLE_ABILITY', actor: actor.id, ability, target });
    const err = store.lastError();
    if (err) { Object.assign(ui, prev); ctx.toast(err.message); ctx.audio.sfx('cancel', b.era); rerender(); }
  };

  if (narrating) {
    actions.innerHTML = `<div class="eyebrow">${b.phase === 'won' ? 'Victory' : b.phase === 'lost' ? 'Defeat' : playerTurn ? esc(actor!.name) : 'Enemy turn'}</div><p class="small">Read the report, then continue.</p>`;
    ctx.setPrompts(prompts({ btn: 'a', label: 'Continue' }));
  } else if (over) {
    actions.innerHTML = `<div class="eyebrow">${b.phase === 'won' ? 'Victory' : 'Defeat'}</div><p class="small">${b.phase === 'won' ? 'The field is clear.' : 'The party falls.'}</p>`;
    ctx.setPrompts(prompts({ btn: 'a', label: 'Continue' }));
  } else if (!playerTurn) {
    actions.innerHTML = `<div class="eyebrow">Enemy turn</div><p class="small">${esc(actor?.name ?? '')} is acting.</p>`;
    ctx.setPrompts(prompts({ btn: 'scrollUp', label: 'Scroll log' }));
  } else if (ui.mode === 'menu') {
    const items: MenuItem[] = abilityItems(false);
    const itemCount = Object.values(state.inventory.items).reduce((s, n) => s + n, 0);
    items.push({ id: 'items', label: 'Items', cost: `1⟋`, hint: itemCount ? `${itemCount} carried` : 'None carried', disabled: !itemCount || actor!.threads < 1, onSelect: () => setMode('items') });
    items.push({ id: 'end', label: 'End turn', shortcut: 'rt', hint: actor!.threads ? `Bank ${Math.min(actor!.threads, rules.slackCap + (b.passives[actor!.id]?.slackCap ?? 0))} Slack` : '', onSelect: () => store.dispatch({ type: 'BATTLE_END_TURN', actor: actor!.id }) });
    actions.innerHTML = `<div class="eyebrow">${esc(actor!.name)} · ${actor!.threads} threads</div>`;
    const desc = document.createElement('div');
    desc.className = 'desc';
    const describe = (i: number) => { const it = items[i]; desc.textContent = it?.hint ?? content.abilities[it?.id ?? '']?.description ?? ''; };
    m = menu(items, ui.menuIdx, (i) => { ui.menuIdx = i; describe(i); });
    actions.appendChild(m.el);
    actions.appendChild(desc);
    describe(m.index);
    const canFork = b.tempo >= rules.fork.cost && actor!.threads > rules.fork.threadCost;
    const canRewind = b.rewindsLeft > 0 && b.tempo >= rules.rewind.cost && !!b.rewindPoint;
    ctx.setPrompts(prompts(
      { btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Use' },
      b.fork ? { btn: 'x', label: 'Commit fork' } : { btn: 'x', label: `Fork (${rules.fork.cost} Tempo)`, disabled: !canFork },
      { btn: 'lt', label: `Rewind (${rules.rewind.cost} Tempo)`, disabled: !canRewind },
      { btn: 'y', label: 'Inspect' }, { btn: 'rt', label: 'End turn' },
    ));
  } else if (ui.mode === 'target' || ui.mode === 'forkTarget') {
    const a = content.abilities[ui.ability!];
    actions.innerHTML = `<div class="eyebrow">${ui.mode === 'forkTarget' ? 'Fork · ' : ''}${esc(a.name)} · choose target</div><p class="small">${esc(targeted?.name ?? 'No valid target')}${targeted && targeted.side === 'enemy' ? ` · ${targeted.hp}/${targeted.maxHp}${hasStatus(targeted, 'marked') ? ' · marked' : ''}` : ''}</p><p class="small" style="margin-top:6px">${esc(a.description)}</p>`;
    ctx.setPrompts(prompts({ btn: 'lb', label: 'Prev target' }, { btn: 'rb', label: 'Next target' }, { btn: 'a', label: ui.mode === 'forkTarget' ? 'Preview' : 'Confirm' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'items') {
    const items: MenuItem[] = Object.entries(state.inventory.items).filter(([, n]) => n > 0).map(([id, n]) => {
      const def = content.items[id];
      return { id, label: def.name, cost: `×${n}`, hint: def.description, onSelect: () => setMode('itemTarget', { item: id, targetIdx: 0 }) };
    });
    actions.innerHTML = `<div class="eyebrow">Items · 1 thread</div>`;
    m = menu(items, 0);
    actions.appendChild(m.el);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Select' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'itemTarget') {
    actions.innerHTML = `<div class="eyebrow">${esc(content.items[ui.item!].name)} · choose ally</div><p class="small">${esc(targeted?.name ?? '')}</p>`;
    ctx.setPrompts(prompts({ btn: 'lb', label: 'Prev' }, { btn: 'rb', label: 'Next' }, { btn: 'a', label: 'Use' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'forkPick') {
    actions.innerHTML = `<div class="eyebrow">Fork · preview which action? (${rules.fork.cost} Tempo, 1 thread, +${rules.fork.entropy} Entropy)</div>`;
    m = menu(abilityItems(true), 0);
    actions.appendChild(m.el);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Preview' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'inspect') {
    const e = enemies[ui.targetIdx % enemies.length];
    const def = e.echoOf ? null : content.enemies[e.ref];
    const marked = hasStatus(e, 'marked');
    actions.innerHTML = `<div class="eyebrow">Inspect · ${esc(e.name)}</div>
      <p class="small">${esc(def?.flavor ?? 'A glitched copy of one of your own.')}</p>
      <div class="kv small" style="margin-top:6px"><b>Family</b><span>${e.family}${e.machine ? ' · machine' : ''}</span><b>Immune</b><span>${e.immunities.join(', ') || 'nothing'}</span>
      ${marked ? `<b>Resolve</b><span>${e.hp}/${e.maxHp}</span><b>Shield</b><span>${e.shield}/${e.maxShield}</span><b>Weakness</b><span>${e.weakness ?? 'none'}</span><b>Grit</b><span>${e.stats.grit}</span><b>Noise</b><span>${e.stats.noise}</span><b>Latency</b><span>${e.stats.latency}</span>` : '<b>Stat sheet</b><span>Hidden. Audit it to expose.</span>'}</div>`;
    ctx.setPrompts(prompts({ btn: 'lb', label: 'Prev' }, { btn: 'rb', label: 'Next' }, { btn: 'b', label: 'Back' }));
  }

  root.querySelector('.narration')?.addEventListener('click', () => ctx.advanceNarration());

  // Clicking an enemy while targeting picks it.
  root.querySelectorAll('.enemy').forEach((el) => el.addEventListener('click', () => {
    const id = (el as HTMLElement).dataset.id!;
    const i = targets.findIndex((t) => t.id === id);
    if (i >= 0) { ui.targetIdx = i; confirmTarget(); }
  }));
  const confirmTarget = () => {
    if (!actor || !targeted) return;
    if (ui.mode === 'itemTarget') {
      const item = ui.item!;
      ui.mode = 'menu';
      ui.item = null;
      store.dispatch({ type: 'BATTLE_ITEM', actor: actor.id, item, target: targeted.id });
      const err = store.lastError();
      if (err) { ui.mode = 'itemTarget'; ui.item = item; ctx.toast(err.message); rerender(); }
      return;
    }
    commit(ui.ability!, targeted.id, ui.mode === 'forkTarget');
  };

  const logEl = root.querySelector('#log') as HTMLElement;
  logEl.scrollTop = logEl.scrollHeight;

  return {
    input(btn: Button) {
      if (narrating) {
        if (btn === 'a' || btn === 'b') ctx.advanceNarration();
        return;
      }
      if (btn === 'scrollUp') { ui.logScroll = Math.min(Math.max(0, b.log.length - 4), ui.logScroll + 3); rerender(); return; }
      if (btn === 'scrollDown') { ui.logScroll = Math.max(0, ui.logScroll - 3); rerender(); return; }
      if (over) { if (btn === 'a' || btn === 'b') store.dispatch({ type: 'BATTLE_FINISH' }); return; }
      if (!playerTurn) return;
      switch (ui.mode) {
        case 'menu':
          if (btn === 'x') {
            if (b.fork) { commit(b.fork.abilityId, b.fork.targetId || null, false); return; }
            if (b.tempo < rules.fork.cost) { ctx.toast(`Fork needs ${rules.fork.cost} Tempo.`); return; }
            setMode('forkPick'); return;
          }
          if (btn === 'lt') { store.dispatch({ type: 'BATTLE_REWIND' }); const e = store.lastError(); if (e) ctx.toast(e.message); return; }
          if (btn === 'y') { setMode('inspect', { targetIdx: 0 }); return; }
          m?.input(btn);
          return;
        case 'items': case 'forkPick':
          if (btn === 'b') { setMode('menu'); return; }
          m?.input(btn);
          return;
        case 'target': case 'forkTarget': case 'itemTarget':
          if (btn === 'b') { setMode(ui.mode === 'itemTarget' ? 'items' : ui.mode === 'forkTarget' ? 'forkPick' : 'menu'); return; }
          if (btn === 'lb' || btn === 'left' || btn === 'up') { ui.targetIdx--; rerender(); return; }
          if (btn === 'rb' || btn === 'right' || btn === 'down') { ui.targetIdx++; rerender(); return; }
          if (btn === 'a') confirmTarget();
          return;
        case 'inspect':
          if (btn === 'b' || btn === 'y') { setMode('menu'); return; }
          if (btn === 'lb' || btn === 'left') { ui.targetIdx = (ui.targetIdx + enemies.length - 1) % enemies.length; rerender(); return; }
          if (btn === 'rb' || btn === 'right') { ui.targetIdx = (ui.targetIdx + 1) % enemies.length; rerender(); return; }
          return;
      }
    },
  };
}
