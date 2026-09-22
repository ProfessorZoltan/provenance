import { artAssetUrl } from '../../art/library';
import { rigSvg } from '../../art/rigs';
import { abilityOptions, current, enemyIntent, hasStatus, itemNeedsTarget, validTargets } from '../../core/battle/battle';
import { nerveCost } from '../../core/stats';
import type { Targeting } from '../../types/content';
import type { AbilityDef, RulesDef } from '../../types/content';
import { statusChips } from '../../core/battle/statuses';
import { loadout } from '../../core/stats';
import type { BattleState, Combatant, GameState } from '../../types/state';
import type { Button } from '../../input/input';
import { accentFor, esc, html, prompts, type Ctx, type ScreenHandle } from '../common';
import { currentPage, narrationPending } from '../narration';
import { menu, type MenuItem } from '../menu';

type Mode = 'menu' | 'target' | 'items' | 'itemTarget' | 'timePick' | 'forkPick' | 'forkTarget' | 'echoPick' | 'relayPick' | 'inspect';

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

/** Where Entropy stands and what the next line up does, for the gauge panel. */
function entropyLine(b: BattleState, rules: RulesDef): string {
  const t = rules.entropyTiers;
  if (b.entropy >= t.slip.at) return `Slipping: turns can be lost. At ${t.break.at} it breaks over someone`;
  if (b.entropy >= rules.entropyThreshold) return `${b.echoSpawned ? 'An Echo has answered' : 'Echoes answer'}. Slipping at ${t.slip.at}`;
  if (b.entropy >= t.fray.at) return `Fraying: Chronal +${Math.round(t.fray.chronalBonus * 100)}%, Tempo ×${t.fray.tempoMultiplier}. Echoes at ${rules.entropyThreshold}`;
  return `Fraying at ${t.fray.at}, Echoes at ${rules.entropyThreshold}`;
}

/** Each personality in the player's terms, for the Inspect panel. */
const TARGETING_TEXT: Record<Targeting, string> = {
  opportunist: 'Whoever is weakest, or whoever is nearest. It has no method.',
  weakest: 'Whoever is closest to going down. It finishes things.',
  healer: 'Whoever has the highest Signal: the one who mends.',
  buffed: 'Whoever is carrying the most: Litany, Guard, Anchor. It takes the shine off.',
  auditor: 'The Auditor. You are the case.',
  revenge: 'Whoever hurt it last.',
  spread: 'Never the same target twice running.',
};

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

/** A row of chips: what is running, how long it has left, and what it is doing. */
function statusChipsHtml(c: Combatant, rules: RulesDef): string {
  const chips = statusChips(c, rules);
  if (!chips.length) return '';
  return `<div class="statuses">${chips.map((s) => `<span class="chip ${s.polarity}" title="${esc(`${s.label}: ${s.effect}`)}"><span class="chip-name">${esc(s.label)}${s.count > 1 ? ` ×${s.count}` : ''}</span><span class="chip-turns">${s.turns >= 9 ? '∞' : s.turns}</span></span>`).join('')}</div>`;
}

// Resolve changes are easy to miss when the whole screen redraws, so whoever moved glows for a
// moment: red for damage, green for healing. Kept outside the render and cleared on a timer.
const FLASH_MS = 1600;
const lastHp = new Map<string, number>();
const flash = new Map<string, 'hurt' | 'healed'>();
const flashUntil = new Map<string, number>();
let flashKey = '';
let flashTimer: ReturnType<typeof setTimeout> | null = null;

/** Compare this frame's Resolve against the last one and remember who moved, and which way. */
function noteResolveChanges(b: BattleState, key: string, redraw: () => void): void {
  if (flashKey !== key) { flashKey = key; lastHp.clear(); flash.clear(); flashUntil.clear(); }
  const now = Date.now();
  for (const c of b.combatants) {
    const was = lastHp.get(c.id);
    lastHp.set(c.id, c.hp);
    if (was === undefined || was === c.hp) continue;
    flash.set(c.id, c.hp < was ? 'hurt' : 'healed');
    flashUntil.set(c.id, now + FLASH_MS);
  }
  let soonest = Infinity;
  for (const [id, until] of flashUntil) {
    if (until <= now) { flash.delete(id); flashUntil.delete(id); } else soonest = Math.min(soonest, until);
  }
  // One timer for the whole field: when the last glow is due to end, draw once more without it.
  if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
  if (soonest < Infinity) flashTimer = setTimeout(() => { flashTimer = null; redraw(); }, soonest - now + 30);
}

const flashClass = (id: string): string => flash.get(id) ?? '';

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
  if (actor && (ui.mode === 'target' || ui.mode === 'forkTarget') && ui.ability) targets = validTargets(b, actor.id, content.abilities[ui.ability], content);
  if (ui.mode === 'itemTarget') targets = party.filter((p) => !p.down || content.items[ui.item ?? '']?.effect?.revive);
  if (targets.length) ui.targetIdx = ((ui.targetIdx % targets.length) + targets.length) % targets.length;
  const targeted = targets[ui.targetIdx];

  // What each enemy will do next, read off the same planner that runs its turn.
  const intentHtml = (e: Combatant): string => {
    if (e.down || over) return '';
    const plan = enemyIntent(b, e, content);
    if (!plan) return '';
    const a = plan.ability;
    const who = plan.target ? plan.target.name : a.target === 'allEnemies' ? 'everyone' : a.target === 'allAllies' ? 'its side' : '';
    const kind = a.special === 'unleash' ? 'heavy' : a.special === 'charge' ? 'charge' : a.heal ? 'heal' : a.damageType ? 'hit' : 'support';
    return `<div class="intent ${kind}" title="${esc(a.description)}">▸ ${esc(a.name)}${who ? ` → ${esc(who)}` : ''}</div>`;
  };

  const rigFor = (c: Combatant): string => {
    // Whoever this is a copy of, if anyone: temporaries and Echoes both point back at a character.
    const who = content.characters[c.echoOf ?? ''] ?? content.characters[c.ref];
    if (c.side === 'party' && who) return rigSvg(who.rig, accentFor(content, state, who.id), 'currentColor', c.down ? 'down' : 'idle');
    if (c.echoOf && who) return rigSvg(who.rig, accentFor(content, state, who.id), 'currentColor', c.down ? 'down' : 'idle', true, b.era);
    const def = content.enemies[c.ref];
    const accent = c.family === 'echo' ? 'var(--choir)' : c.family === 'warden' ? 'var(--cinder)' : 'var(--accent)';
    const baseRig = c.rigOverride ?? def?.rig ?? 'auditor';
    const eraRig = `${baseRig}_${b.era}`;
    return rigSvg(artAssetUrl(eraRig, 'idle') ? eraRig : baseRig, accent, 'currentColor', c.down ? 'down' : 'idle', c.family === 'echo');
  };

  const entropyClass = b.entropy >= rules.entropyThreshold ? 'e3' : b.entropy >= 50 ? 'e2' : b.entropy >= 25 ? 'e1' : '';
  const logLines = b.log.slice(Math.max(0, b.log.length - 16 - ui.logScroll), b.log.length - ui.logScroll);

  const page = currentPage();
  const narrating = narrationPending();
  noteResolveChanges(b, ui.encounter, rerender);

  html(root, `<section class="battle">
    <div class="stage"><div class="field-label">${esc(content.locations[state.location].name)} / ${esc(b.era)}</div>
      ${b.fork && !page ? `<div class="fork-preview" role="status"><div class="fork-box">
        <div class="eyebrow">Fork · ${esc(content.abilities[b.fork.abilityId].name)}${b.fork.targetId ? ' on ' + esc(b.combatants.find((c) => c.id === b.fork!.targetId)?.name ?? '') : ''}</div>
        <ul>${b.fork.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <div class="fork-foot"><span class="prompt"><span class="glyph" data-btn="x"><span class="pad">X</span><span class="key">X</span></span> Commit exactly this</span><span class="prompt"><span class="glyph" data-btn="b"><span class="pad">B</span><span class="key">Esc</span></span> Choose something else</span></div>
      </div></div>` : ''}
      ${page ? `<div class="narration" role="alert"><div class="narration-box">${page.map((line) => {
        const who = line.actor && line.target && line.actor !== line.target ? `${line.actor} → ${line.target}` : line.actor ?? '';
        const head = [who, line.ability].filter(Boolean).join(' · ');
        return `${head ? `<div class="eyebrow">${esc(head)}</div>` : ''}<p class="${line.kind}">${esc(line.text)}</p>`;
      }).join('')}<div class="narration-more"><span class="glyph" data-btn="a"><span class="pad">A</span><span class="key">Enter</span></span> Continue</div></div></div>` : ''}
      <div class="frame ${entropyClass}"></div>
      <div class="enemies">${enemies.map((e) => `<div class="enemy ${e.down ? 'down' : ''} ${targeted?.id === e.id ? 'targeted' : ''} ${actor?.id === e.id ? 'acting' : ''} ${flashClass(e.id)}" data-id="${e.id}">
        <div class="rig">${rigFor(e)}</div>
        <div class="nm"><span>${esc(e.name)}</span></div>
        ${e.bar ? `<div class="bar hp"><i style="width:${e.bar === 2 ? 0 : Math.round((e.hp / e.maxHp) * 100)}%"></i></div>
        <div class="bar core ${e.bar === 2 ? 'on' : ''}" style="margin-top:2px"><i style="width:${e.bar === 2 ? Math.round((e.hp / e.maxHp) * 100) : 100}%"></i></div>`
        : `<div class="bar hp"><i style="width:${Math.round((e.hp / e.maxHp) * 100)}%"></i></div>`}
        ${e.maxShield ? `<div class="bar shield" style="margin-top:2px"><i style="width:${Math.round((e.shield / e.maxShield) * 100)}%"></i></div>` : ''}
        ${e.down ? '' : statusChipsHtml(e, rules)}
        ${intentHtml(e)}
        <div class="st">${hasStatus(e, 'marked') || b.combatants.some((c) => c.side === 'party' && c.ref === 'player' && (b.passives.player?.markDuration ?? 0) > 0) ? `${e.hp}/${e.maxHp}${e.maxShield ? ` · shield ${e.shield}` : ''} · weak: ${e.weakness ?? 'none'}` : e.parleyed ? 'talked down' : e.down ? 'down' : ''}</div>
      </div>`).join('')}</div>
      <div class="actorsrow">${party.map((p) => `<div class="actor ${p.down ? 'down' : ''} ${actor?.id === p.id ? 'active' : ''} ${targeted?.id === p.id ? 'targeted' : ''} ${flashClass(p.id)}">${rigFor(p)}</div>`).join('')}</div>
    </div>
    <div class="telemetry"><div class="gauges panel">
      ${tempoRing(b.tempo, rules.tempoMax)}
      <div>
        <div class="small">Round ${b.round} · ${b.surprise ? 'Surprise attack' : content.encounters[b.encounterId].name}</div>
        <div class="entropy ${b.entropy >= rules.entropyThreshold ? 'high' : ''}" style="margin-top:8px">Entropy ${b.entropy} / ${rules.entropyMax}<div class="bar" style="margin-top:3px"><i style="width:${b.entropy}%"></i></div></div>
        <div class="small" style="margin-top:6px">Rewinds ${b.rewindsLeft} · ${entropyLine(b, rules)}</div>
      </div>
    </div>
    <div class="side">
      <div class="panel log" id="log">${logLines.map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join('')}</div>
    </div>
    </div><div class="bottom">
      ${party.map((p) => {
        const cap = rules.slackCap + (b.passives[p.id]?.slackCap ?? 0);
        return `<div class="card panel ${actor?.id === p.id ? 'active' : ''} ${p.down ? 'down' : ''} ${targeted?.id === p.id ? 'targeted' : ''} ${flashClass(p.id)}">
          <div style="display:flex;justify-content:space-between"><b>${esc(p.name)}</b><span class="small">${p.hp}/${p.maxHp}</span></div>
          <div class="bar hp" style="margin:4px 0"><i style="width:${Math.round((p.hp / p.maxHp) * 100)}%"></i></div>
          <div class="threads" title="Threads and Slack">${Array.from({ length: p.stats.bandwidth + cap }, (_, i) => `<i class="${i < p.threads ? 'on' : i >= p.stats.bandwidth && i - p.stats.bandwidth < p.slack ? 'slack' : ''}"></i>`).join('')}</div>
          <div class="st">${p.down ? 'Down' : `${p.threads} threads${p.slack ? ` · ${p.slack} Slack` : ''}`}${p.temporary ? '' : ` · <span class="nerve ${p.nerve === 0 ? 'out' : ''}" title="Nerve: what heals, buffs and debuffs cost. Refilled by a bed.">Nerve ${p.nerve}/${p.maxNerve}</span>`}${p.continuity < 100 ? ` · <span class="cont ${p.continuity < rules.continuityCombat.flickerBelow ? 'thin' : ''}" title="Continuity: how much of their own timeline is still theirs.">Continuity ${p.continuity}</span>` : ''}</div>
          ${p.down ? '' : statusChipsHtml(p, rules)}
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
      cost: `${o.ability.cost}⟋${o.ability.damageType ? ' ' + o.ability.damageType : ''}${nerveCost(content, o.ability) ? ` · ${nerveCost(content, o.ability)} Nerve` : ''}`,
      hint: `${o.ability.pair ? `With ${content.characters[o.ability.pair.with]?.shortName ?? o.ability.pair.with}. ` : ''}${o.usable ? o.ability.description : `${o.reason}. ${o.ability.description}`}`,
      disabled: !o.usable || (forFork && actor.threads < o.ability.cost + rules.fork.threadCost),
      onSelect: () => beginAbility(o.ability, forFork),
    }));
  };
  /** Fork, Rewind, Echo and Collapse: the Tempo actions, gathered behind one row so the list stays short. */
  const timeActions = (): MenuItem[] => {
    if (!actor) return [];
    const canFork = b.tempo >= rules.fork.cost && actor.threads > rules.fork.threadCost;
    const canRewind = b.rewindsLeft > 0 && b.tempo >= rules.rewind.cost && !!b.rewindPoint;
    const forkReason = b.tempo < rules.fork.cost ? `Needs ${rules.fork.cost} Tempo.`
      : actor.threads <= rules.fork.threadCost ? 'Needs a thread to spare beyond the action itself.' : '';
    const rewindReason = !b.rewindPoint ? 'Nothing to undo yet: the enemy has not acted.'
      : b.rewindsLeft <= 0 ? 'No Rewinds left this battle.'
      : b.tempo < rules.rewind.cost ? `Needs ${rules.rewind.cost} Tempo.` : '';
    const items: MenuItem[] = [];
    items.push({
      id: 'fork',
      label: b.fork ? 'Commit the fork' : 'Fork',
      shortcut: 'x',
      cost: b.fork ? '' : `${rules.fork.cost} Tempo`,
      hint: b.fork
        ? 'Carry out the action you previewed, exactly as the preview showed it.'
        : `${forkReason} Spend ${rules.fork.cost} Tempo and 1 thread to see exactly what an action would do before committing. Raises Entropy by ${rules.fork.entropy}.`.trim(),
      disabled: !b.fork && !canFork,
      onSelect: () => {
        if (b.fork) { commit(b.fork.abilityId, b.fork.targetId || null, false); return; }
        setMode('forkPick');
      },
    });
    items.push({
      id: 'rewind',
      label: 'Rewind',
      shortcut: 'lt',
      cost: `${rules.rewind.cost} Tempo`,
      hint: `${rewindReason} Spend ${rules.rewind.cost} Tempo to undo the enemy's last turn and make them take it again. ${b.rewindsLeft} left this battle. Raises Entropy by ${rules.rewind.entropy}.`.trim(),
      disabled: !canRewind,
      onSelect: () => {
        ui.mode = 'menu';
        store.dispatch({ type: 'BATTLE_REWIND' });
        const e = store.lastError();
        if (e) ctx.toast(e.message);
      },
    });
    // Echo and Collapse: the other two Tempo abilities, in the same list so they explain themselves.
    const otherEras = state.world.visitedEras.filter((e) => e !== state.era);
    const echoWho = state.activeParty.concat(Object.keys(state.party).filter((id) => !state.activeParty.includes(id)));
    const canEcho = !b.echoAssistUsed && b.tempo >= rules.echo.cost && otherEras.length > 0 && echoWho.length > 0;
    const echoReason = b.echoAssistUsed ? 'One Echo per battle, and it has answered.'
      : !otherEras.length ? 'You have not been to another era yet.'
      : b.tempo < rules.echo.cost ? `Needs ${rules.echo.cost} Tempo.` : '';
    items.push({
      id: 'echo',
      label: 'Echo',
      cost: `${rules.echo.cost} Tempo`,
      hint: `${echoReason} Spend ${rules.echo.cost} Tempo and another era's version of someone steps in for a round. Benched members count. Raises Entropy by ${rules.echo.entropy}.`.trim(),
      disabled: !canEcho,
      onSelect: () => setMode('echoPick'),
    });
    const canCollapse = !b.collapseUsed && !b.collapsePoint && b.tempo >= rules.collapse.cost;
    const collapseReason = b.collapseUsed ? 'Already spent this battle.'
      : b.collapsePoint ? 'The fight is already banked.'
      : b.tempo < rules.collapse.cost ? `Needs ${rules.collapse.cost} Tempo.` : '';
    items.push({
      id: 'collapse',
      label: b.collapsePoint ? 'Banked' : 'Collapse',
      cost: b.collapsePoint ? '' : `${rules.collapse.cost} Tempo`,
      hint: `${collapseReason} Spend ${rules.collapse.cost} Tempo to bank the fight exactly as it stands. If the party is wiped after that, it resumes from here instead of ending. Raises Entropy by ${rules.collapse.entropy}.`.trim(),
      disabled: !canCollapse,
      onSelect: () => {
        ui.mode = 'menu';
        store.dispatch({ type: 'BATTLE_COLLAPSE' });
        const e = store.lastError();
        if (e) ctx.toast(e.message);
      },
    });
    return items;
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
    // Tempo abilities sit in the action list beside the abilities so they explain themselves.
    // The shortcut glyph on each row teaches the button for players who prefer it.
    const items: MenuItem[] = abilityItems(false);
    const time = timeActions();
    if (b.fork) items.push(time.find((x) => x.id === 'fork')!);
    const ready = time.filter((x) => !x.disabled && x.id !== 'fork').map((x) => x.label);
    items.push({ id: 'time', label: 'Time', cost: `${b.tempo} Tempo`, hint: `Fork, Rewind, Echo and Collapse. ${ready.length ? `Ready now: ${ready.join(', ')}.` : 'Nothing affordable yet.'} X forks and LT rewinds from anywhere in this list.`, onSelect: () => setMode('timePick') });
    const itemCount = Object.entries(state.inventory.items).reduce((s, [id, n]) => s + (content.items[id]?.kind === 'consumable' ? n : 0), 0);
    items.push({ id: 'items', label: 'Items', cost: 'free', hint: actor!.itemUsed ? 'One item a turn, and this turn\'s is used.' : itemCount ? `${itemCount} carried. No thread: one a turn, on top of everything else.` : 'None carried', disabled: !itemCount || !!actor!.itemUsed, onSelect: () => setMode('items') });
    // Relay: whoever is benched can take this member's place and the rest of their turn.
    const benched = Object.keys(state.party).filter((id) => !b.combatants.some((c) => c.id === id) && (b.reserve.find((c) => c.id === id)?.hp ?? state.party[id].hp) > 0);
    const relayReason = actor!.id === 'player' ? 'The Auditor is the case, and stays.'
      : !benched.length ? 'Nobody on the bench who can stand.'
      : actor!.threads < rules.relay.threadCost ? `Needs ${rules.relay.threadCost} thread.` : '';
    items.push({ id: 'relay', label: 'Relay', cost: `${rules.relay.threadCost}⟋`, hint: `${relayReason} Fall back and a benched member takes the field in your place with the threads you have left.`.trim(), disabled: !!relayReason, onSelect: () => setMode('relayPick') });
    items.push({ id: 'end', label: 'End turn', shortcut: 'rt', hint: actor!.threads ? `Bank ${Math.min(actor!.threads, rules.slackCap + (b.passives[actor!.id]?.slackCap ?? 0))} Slack` : '', onSelect: () => store.dispatch({ type: 'BATTLE_END_TURN', actor: actor!.id }) });
    actions.innerHTML = `<div class="eyebrow">${esc(actor!.name)} · ${actor!.threads} threads · ${b.tempo} Tempo</div>`;
    const desc = document.createElement('div');
    desc.className = 'desc';
    const describe = (i: number) => { const it = items[i]; desc.textContent = it?.hint ?? content.abilities[it?.id ?? '']?.description ?? ''; };
    m = menu(items, ui.menuIdx, (i) => { ui.menuIdx = i; describe(i); }, { columns: 2 });
    actions.appendChild(m.el);
    actions.appendChild(desc);
    describe(m.index);
    ctx.setPrompts(prompts(
      { btn: 'dpad', label: 'Choose' },
      b.fork ? { btn: 'x', label: 'Commit fork' } : { btn: 'a', label: 'Use' },
      b.fork ? { btn: 'b', label: 'Discard fork' } : { btn: 'y', label: 'Inspect' },
      { btn: 'rt', label: 'End turn' },
    ));
  } else if (ui.mode === 'target' || ui.mode === 'forkTarget') {
    const a = content.abilities[ui.ability!];
    actions.innerHTML = `<div class="eyebrow">${ui.mode === 'forkTarget' ? 'Fork · ' : ''}${esc(a.name)} · choose target</div><p class="small">${esc(targeted?.name ?? 'No valid target')}${targeted && targeted.side === 'enemy' ? ` · ${targeted.hp}/${targeted.maxHp}${hasStatus(targeted, 'marked') ? ' · marked' : ''}` : ''}</p><p class="small" style="margin-top:6px">${esc(a.description)}</p>`;
    ctx.setPrompts(prompts({ btn: 'lb', label: 'Prev target' }, { btn: 'rb', label: 'Next target' }, { btn: 'a', label: ui.mode === 'forkTarget' ? 'Preview' : 'Confirm' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'items') {
    const items: MenuItem[] = Object.entries(state.inventory.items).filter(([, n]) => n > 0).map(([id, n]) => {
      const def = content.items[id];
      return { id, label: def.name, cost: `×${n}`, hint: def.description, onSelect: () => {
        if (itemNeedsTarget(def)) { setMode('itemTarget', { item: id, targetIdx: 0 }); return; }
        setMode('menu');
        store.dispatch({ type: 'BATTLE_ITEM', actor: actor!.id, item: id, target: actor!.id });
        const err = store.lastError();
        if (err) { ctx.toast(err.message); setMode('items'); }
      } };
    }).filter((it) => content.items[it.id]?.kind === 'consumable');
    actions.innerHTML = `<div class="eyebrow">Items · free, one a turn</div>`;
    m = menu(items, 0);
    actions.appendChild(m.el);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Select' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'itemTarget') {
    actions.innerHTML = `<div class="eyebrow">${esc(content.items[ui.item!].name)} · choose ally</div><p class="small">${esc(targeted?.name ?? '')}</p>`;
    ctx.setPrompts(prompts({ btn: 'lb', label: 'Prev' }, { btn: 'rb', label: 'Next' }, { btn: 'a', label: 'Use' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'timePick') {
    const time = timeActions();
    actions.innerHTML = `<div class="eyebrow">Time · ${b.tempo} Tempo · Entropy ${b.entropy}</div>`;
    const desc = document.createElement('div');
    desc.className = 'desc';
    const describe = (i: number) => { desc.textContent = time[i]?.hint ?? ''; };
    m = menu(time, 0, describe);
    actions.appendChild(m.el);
    actions.appendChild(desc);
    describe(0);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Use' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'forkPick') {
    actions.innerHTML = `<div class="eyebrow">Fork · preview which action? (${rules.fork.cost} Tempo, 1 thread, +${rules.fork.entropy} Entropy)</div>`;
    m = menu(abilityItems(true), 0);
    actions.appendChild(m.el);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Preview' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'echoPick') {
    // Anyone in the roster, fielded or benched: it is their other-era self that turns up.
    const era = state.world.visitedEras.filter((e) => e !== state.era).slice(-1)[0];
    actions.innerHTML = `<div class="eyebrow">Echo · whose other-era self? (${rules.echo.cost} Tempo, +${rules.echo.entropy} Entropy)</div>
      <p class="small">They step out of ${esc(era ?? '')} for one round, then they are gone.</p>`;
    m = menu(Object.keys(state.party).map((id) => ({
      id,
      label: content.characters[id].name,
      hint: state.activeParty.includes(id) ? 'On the field' : 'Benched',
      onSelect: () => {
        store.dispatch({ type: 'BATTLE_ECHO', character: id });
        const e = store.lastError();
        if (e) ctx.toast(e.message);
        setMode('menu');
      },
    })), 0);
    actions.appendChild(m.el);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Call' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'relayPick') {
    const benched = Object.keys(state.party).filter((id) => !b.combatants.some((c) => c.id === id));
    actions.innerHTML = `<div class="eyebrow">Relay · who takes ${esc(actor!.name)}'s place? (${rules.relay.threadCost} thread)</div>
      <p class="small">They arrive with ${actor!.threads - rules.relay.threadCost} thread${actor!.threads - rules.relay.threadCost === 1 ? '' : 's'} and finish this turn. ${esc(actor!.name)} keeps the Resolve they leave with.</p>`;
    m = menu(benched.map((id) => {
      const waiting = b.reserve.find((c) => c.id === id);
      const hp = waiting ? waiting.hp : state.party[id].hp;
      const cap = waiting ? waiting.maxHp : loadout(content, content.characters[id], state.party[id]).stats.resolve;
      return {
        id,
        label: content.characters[id].name,
        hint: hp > 0 ? `${hp}/${cap} Resolve${waiting ? ' · fell back earlier' : ''}` : 'Down. Cannot take the field.',
        disabled: hp <= 0,
        onSelect: () => {
          store.dispatch({ type: 'BATTLE_RELAY', actor: actor!.id, incoming: id });
          const e = store.lastError();
          if (e) ctx.toast(e.message);
          setMode('menu');
        },
      };
    }), 0);
    actions.appendChild(m.el);
    ctx.setPrompts(prompts({ btn: 'dpad', label: 'Choose' }, { btn: 'a', label: 'Relay' }, { btn: 'b', label: 'Back' }));
  } else if (ui.mode === 'inspect') {
    const e = enemies[ui.targetIdx % enemies.length];
    const def = e.echoOf ? null : content.enemies[e.ref];
    const marked = hasStatus(e, 'marked');
    const plan = enemyIntent(b, e, content);
    actions.innerHTML = `<div class="eyebrow">Inspect · ${esc(e.name)}${def?.role ? ` · ${esc(def.role)}` : ''}</div>
      <p class="small">${esc(def?.flavor ?? 'A glitched copy of one of your own.')}</p>
      <div class="kv small" style="margin-top:6px"><b>Family</b><span>${e.family}${e.machine ? ' · machine' : ''}</span><b>Immune</b><span>${e.immunities.join(', ') || 'nothing'}</span>
      <b>Goes for</b><span>${esc(TARGETING_TEXT[def?.targeting ?? 'opportunist'])}</span>
      <b>Next</b><span>${plan ? `${esc(plan.ability.name)}${plan.target ? ' on ' + esc(plan.target.name) : ''}: ${esc(plan.ability.description)}` : 'nothing it can do'}</span>
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
          if (btn === 'b' && b.fork) { store.dispatch({ type: 'BATTLE_FORK_DISCARD' }); return; }
          if (btn === 'lt') { store.dispatch({ type: 'BATTLE_REWIND' }); const e = store.lastError(); if (e) ctx.toast(e.message); return; }
          if (btn === 'y') { setMode('inspect', { targetIdx: 0 }); return; }
          m?.input(btn);
          return;
        case 'items': case 'timePick': case 'forkPick': case 'echoPick': case 'relayPick':
          if (btn === 'b') { setMode(ui.mode === 'forkPick' || ui.mode === 'echoPick' ? 'timePick' : 'menu'); return; }
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
