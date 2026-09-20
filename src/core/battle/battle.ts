import type { AbilityDef, ContentDB, DamageType, EnemyDef, EraId, ItemDef, SecondBar } from '../../types/content';
import type { BattleLogEntry, BattleRewards, BattleState, Combatant, GameState, LogMeta, RewindPoint, StatusEffect } from '../../types/state';
import { evalFormula } from '../formula';
import { roll, rollInt } from '../rng';
import { partyLoadouts, partySync } from '../stats';
import { clamp } from '../timeline';

// ---------- construction ----------

export function createBattle(content: ContentDB, state: GameState, encounterId: string, surprise: boolean): BattleState {
  const enc = content.encounters[encounterId];
  if (!enc) throw new Error(`Unknown encounter ${encounterId}`);
  const loads = partyLoadouts(content, state);
  const passives: Record<string, Record<string, number>> = {};
  const combatants: Combatant[] = [];

  for (const id of state.activeParty) {
    const def = content.characters[id];
    const cs = state.party[id];
    const l = loads[id];
    if (!def || !cs || !l) continue;
    passives[id] = l.passives;
    const maxHp = l.stats.resolve;
    const hp = Math.min(maxHp, cs.hp);
    combatants.push({
      id, ref: id, name: def.shortName, side: 'party', machine: false,
      stats: { ...l.stats }, hp, maxHp, shield: 0, maxShield: 0,
      threads: 0, slack: 0, statuses: [], abilities: [...l.abilities], immunities: [],
      down: hp <= 0, perception: 0,
    });
  }
  // How much of a fight this is meant to be. A Warden on a wall walk and the same Warden guarding
  // the Board are the same soldier with different orders and different odds of going home.
  const stand = content.rules.tierScale[enc.tier] * (enc.scale ?? 1);
  for (const group of enc.enemies) {
    const def = content.enemies[group.enemy];
    for (let n = 1; n <= group.count; n++) {
      combatants.push(enemyCombatant(def, group.count > 1 ? `${def.id}#${n}` : def.id, group.count > 1 ? `${def.name} ${n}` : def.name, stand));
    }
  }

  const sync = partySync(state);
  let rewinds = 0;
  let openingTempo = 0;
  for (const id of state.activeParty) {
    const def = content.characters[id];
    if (def?.tags.includes('anchor')) rewinds += 1;
    rewinds += passives[id]?.extraRewind ?? 0;
    openingTempo += passives[id]?.openingTempo ?? 0;
  }

  const order = [...combatants]
    .map((c) => ({ id: c.id, lat: c.stats.latency + (surprise && c.side === 'party' ? 200 : 0), party: c.side === 'party' }))
    .sort((a, b) => a.lat - b.lat || (a.party === b.party ? 0 : a.party ? -1 : 1))
    .map((c) => c.id);

  let b: BattleState = {
    encounterId, era: enc.era, seed: state.rng, rng: state.rng, combatants, order,
    turnIndex: -1, round: 1, tempo: Math.min(content.rules.tempoMax, openingTempo), entropy: 0,
    phase: 'player', surprise, log: [], rewindsLeft: rewinds, rewindPoint: null, fork: null,
    collapsePoint: null, collapseUsed: false, echoAssistUsed: false,
    echoSpawned: false, usedSignal: false, story: enc.story, passives, partySync: sync, pendingRewards: null,
  };
  b = log(b, surprise ? `Surprise attack. ${enc.flavor}` : enc.flavor, surprise ? 'warn' : 'info');
  if (surprise) b = log(b, 'The party starts with no Slack and the enemy acts first.', 'warn');
  // A fight can be over before anyone acts: walk in with nobody standing and it is already lost.
  // Without this the enemy cycles its turns forever against a party that can never answer.
  b = checkEnd(b, content);
  return b.phase === 'won' || b.phase === 'lost' ? b : advance(b);
}

function enemyCombatant(def: EnemyDef, id: string, name: string, stand = 1): Combatant {
  const resolve = Math.round(def.stats.resolve * stand);
  const shield = Math.round(def.shield * stand);
  return {
    id, ref: def.id, name, side: 'enemy', family: def.family, machine: def.machine,
    stats: { ...def.stats, resolve }, hp: resolve, maxHp: resolve, stand,
    shield, maxShield: shield, threads: 0, slack: 0, statuses: [],
    abilities: [...def.abilities], immunities: [...def.immunities], weakness: def.weakness,
    down: false, perception: def.perception,
    bar: def.secondBar ? 1 : undefined,
    secondBarName: def.secondBar?.name,
  };
}

// ---------- helpers ----------

/**
 * Entropy rises at the same scale everything else in an exchange does. Without this, lengthening
 * battles would make the fracture open in every one of them rather than in the ones you pushed.
 */
function addEntropy(b: BattleState, amount: number, content: ContentDB): number {
  return clamp(b.entropy + Math.round(amount * content.rules.damageScale), 0, content.rules.entropyMax);
}

export function current(b: BattleState): Combatant | undefined {
  return b.combatants.find((c) => c.id === b.order[b.turnIndex]);
}

export function alive(b: BattleState, side: 'party' | 'enemy'): Combatant[] {
  return b.combatants.filter((c) => c.side === side && !c.down);
}

export function hasStatus(c: Combatant, id: string): boolean {
  return c.statuses.some((s) => s.id === id);
}

function statusCount(c: Combatant, id: string): number {
  return c.statuses.filter((s) => s.id === id).length;
}

function log(b: BattleState, text: string, kind: BattleLogEntry['kind'] = 'info', meta: LogMeta = {}): BattleState {
  return { ...b, log: [...b.log, { turn: b.round, text, kind, ...meta }] };
}

function update(b: BattleState, id: string, fn: (c: Combatant) => Combatant): BattleState {
  return { ...b, combatants: b.combatants.map((c) => (c.id === id ? fn(c) : c)) };
}

function slackCap(b: BattleState, c: Combatant, content: ContentDB): number {
  return content.rules.slackCap + (b.passives[c.id]?.slackCap ?? 0);
}

export function isOverloaded(b: BattleState, actorId: string, content: ContentDB): boolean {
  return b.partySync <= content.rules.overloadSync || (b.passives[actorId]?.overloadAlways ?? 0) > 0;
}

export function canParley(b: BattleState, content: ContentDB): boolean {
  return b.partySync >= content.rules.parleySync;
}

export interface AbilityOption {
  ability: AbilityDef;
  usable: boolean;
  reason?: string;
}

export function abilityOptions(b: BattleState, actorId: string, content: ContentDB): AbilityOption[] {
  const actor = b.combatants.find((c) => c.id === actorId);
  if (!actor) return [];
  const ids = [...actor.abilities];
  if (actor.side === 'party' && canParley(b, content) && !ids.includes('parley')) ids.push('parley');
  return ids.map((id) => {
    const ability = content.abilities[id];
    if (actor.threads < ability.cost) return { ability, usable: false, reason: `Needs ${ability.cost} threads` };
    if (ability.damageType === 'signal' && b.partySync <= content.rules.overloadSync) {
      return { ability, usable: false, reason: 'Overload disables Signal abilities' };
    }
    if (ability.requiresMachine && !alive(b, 'enemy').some((e) => e.machine)) return { ability, usable: false, reason: 'No machine to talk to' };
    return { ability, usable: true };
  });
}

export function validTargets(b: BattleState, actorId: string, ability: AbilityDef): Combatant[] {
  const actor = b.combatants.find((c) => c.id === actorId);
  if (!actor) return [];
  const foes = actor.side === 'party' ? 'enemy' : 'party';
  switch (ability.target) {
    case 'enemy': return alive(b, foes).filter((e) => !ability.requiresMachine || e.machine);
    case 'allEnemies': return alive(b, foes);
    case 'ally': return b.combatants.filter((c) => c.side === actor.side && (!c.down || ability.id === 'revive'));
    case 'allAllies': return alive(b, actor.side);
    case 'self': return [actor];
  }
}

// ---------- turn flow ----------

function tickStatuses(c: Combatant): Combatant {
  const statuses = c.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
  return { ...c, statuses };
}

function beginTurn(b: BattleState): BattleState {
  const actor = current(b);
  if (!actor) return b;
  if (actor.temporary && actor.expiresAfterRound !== undefined && b.round > actor.expiresAfterRound) {
    b = update(b, actor.id, (c) => ({ ...c, down: true, hp: 0, statuses: [] }));
    b = log(b, `${actor.name} runs out of time and dissolves.`, 'tempo', { actor: actor.name });
    return advance(b);
  }
  let c = tickStatuses(actor);
  let threads = c.stats.bandwidth + (c.side === 'party' ? c.slack : 0);
  if (hasStatus(c, 'fear')) threads = Math.max(1, threads - 1);
  c = { ...c, threads, slack: 0 };
  b = update(b, c.id, () => c);
  b = { ...b, phase: c.side === 'party' ? 'player' : 'enemy', fork: null };
  if (c.side === 'party') b = log(b, `${c.name}'s turn: ${threads} threads.`, 'system');
  return b;
}

/** Move to the next living combatant, wrapping rounds. */
function advance(b: BattleState): BattleState {
  if (b.phase === 'won' || b.phase === 'lost') return b;
  const n = b.order.length;
  for (let step = 0; step < n; step++) {
    let idx = b.turnIndex + 1;
    let round = b.round;
    if (idx >= n) { idx = 0; round += 1; }
    b = { ...b, turnIndex: idx, round };
    const c = current(b);
    if (c && !c.down) return beginTurn(b);
  }
  return b;
}

export function endTurn(b: BattleState, actorId: string, content: ContentDB): BattleState {
  const actor = current(b);
  if (!actor || actor.id !== actorId) throw new Error('Not this combatant\'s turn');
  const slack = actor.side === 'party' ? Math.min(slackCap(b, actor, content), actor.threads) : 0;
  b = update(b, actorId, (c) => ({ ...c, threads: 0, slack }));
  if (slack > 0 && actor.side === 'party') b = log(b, `${actor.name} carries ${slack} Slack forward.`, 'system');
  b = { ...b, fork: null };
  return advance(b);
}

// ---------- damage ----------

interface HitResult {
  b: BattleState;
  amount: number;
  hit: boolean;
  immune: boolean;
  note: string;
  meta: LogMeta;
}

function resolveDamage(b: BattleState, actor: Combatant, target: Combatant, ability: AbilityDef, content: ContentDB): HitResult {
  const rules = content.rules;
  const type = ability.damageType as DamageType;
  const meta: LogMeta = { actor: actor.name, target: target.name, ability: ability.name };
  const p = b.passives[actor.id] ?? {};
  const partyAccuracy = actor.side === 'party'
    ? Object.values(b.passives).reduce((s, pp) => s + (pp.partyAccuracy ?? 0), 0)
    : 0;

  // Killing Silence spends the whole charge on one shot that nothing gets a say in: it cannot miss,
  // and armor, shields, guard and immunity are all simply not consulted.
  if (ability.special === 'killingSilence') {
    const held = statusCount(actor, 'held');
    const raw = evalFormula(ability.formula ?? '0', { a: actor.stats, d: target.stats, marks: 0, lost: actor.maxHp - actor.hp });
    const dmg = Math.max(1, Math.round(raw * (1 + (0.6 + (p.holdBonus ?? 0)) * held)));
    let hp = Math.max(0, target.hp - dmg);
    const enemyDef = content.enemies[target.ref];
    let broke: SecondBar | null = null;
    const coreHp = (bar: SecondBar) => Math.round(bar.resolve * (target.stand ?? 1));
    const coreShield = (bar: SecondBar) => Math.round((bar.shield ?? 0) * (target.stand ?? 1));
    if (hp <= 0 && target.bar === 1 && enemyDef?.secondBar) { broke = enemyDef.secondBar; hp = coreHp(broke); }
    const down = hp <= 0;
    b = update(b, target.id, (c) => (broke
      ? { ...c, hp, shield: coreShield(broke), maxShield: coreShield(broke), down: false, bar: 2,
          name: broke.name, maxHp: coreHp(broke), rigOverride: broke.rig,
          abilities: broke.abilities ?? c.abilities, immunities: broke.immunities ?? c.immunities,
          weakness: broke.weakness, statuses: c.statuses.filter((st) => st.id !== 'marked') }
      : { ...c, hp, down, statuses: down ? [] : c.statuses }));
    b = update(b, actor.id, (c) => ({ ...c, statuses: c.statuses.filter((st) => st.id !== 'held') }));
    const held_ = held > 0 ? ` (held ${held})` : '';
    return { b, amount: dmg, hit: true, immune: false, meta,
      note: `${actor.name} takes the shot. ${dmg} damage to ${target.name}${held_}, and nothing on the field was asked.`
        + (broke ? ` The shell splits. ${broke.flavor}` : down ? ` ${target.name} goes down.` : '') };
  }

  // Immunities and type rules.
  if (target.immunities.includes(type)) {
    return { b, amount: 0, hit: true, immune: true, meta, note: `${actor.name} uses ${ability.name} on ${target.name}, but ${target.name} is immune to ${type} damage.` };
  }
  if (type === 'signal' && !target.machine) {
    return { b, amount: 0, hit: true, immune: true, meta, note: `${actor.name} uses ${ability.name} on ${target.name}, but Signal only bites on machines.` };
  }
  if (hasStatus(target, 'faraday') && (type === 'signal' || type === 'thermal')) {
    return { b, amount: 0, hit: true, immune: true, meta, note: `${actor.name} uses ${ability.name} on ${target.name}, but Faraday shields it.` };
  }

  // Accuracy.
  let chance = clamp(0.8 + (actor.stats.signal - target.stats.noise) / 250 + partyAccuracy, 0.5, 1);
  if (type === 'chronal' || hasStatus(target, 'locked')) chance = 1;
  const [r, rng] = roll(b.rng);
  b = { ...b, rng };
  if (r > chance) return { b, amount: 0, hit: false, immune: false, meta, note: `${actor.name} uses ${ability.name} on ${target.name}, and misses.` };

  const marks = alive(b, actor.side === 'party' ? 'enemy' : 'party').filter((e) => hasStatus(e, 'marked')).length;
  let dmg = evalFormula(ability.formula ?? '0', { a: actor.stats, d: target.stats, marks, lost: actor.maxHp - actor.hp });
  const notes: string[] = [];

  if (hasStatus(target, 'marked')) dmg *= 1 + rules.markBonus + (p.markBonus ?? 0);
  if (hasStatus(target, 'bound')) { dmg *= 1.2 + (p.boundBonus ?? 0); notes.push('in breach'); }
  if (hasStatus(actor, 'bound')) { dmg *= 0.7; notes.push('bound by terms'); }
  dmg *= 1 + 0.15 * statusCount(actor, 'inspired');
  if (ability.special === 'scalesWithMarks') dmg *= 1 + 0.3 * marks;
  // Held Shot: every turn Hale spends holding adds to the shot he finally takes.
  const held = ability.special === 'release' ? statusCount(actor, 'held') : 0;
  if (held > 0) notes.push(`held ${held}`);
  dmg *= 1 + (0.6 + (p.holdBonus ?? 0)) * held;
  if (target.machine) dmg *= 1 + (p.vsMachine ?? 0);
  if (!target.machine && target.family !== 'echo') dmg *= 1 + (p.vsHuman ?? 0);
  if (type === 'thermal') dmg *= 1 + (p.thermalBonus ?? 0);
  if (type === 'kinetic' && target.machine && actor.side === 'party' && isOverloaded(b, actor.id, content)) {
    dmg *= 1 + rules.overloadBonus;
    notes.push('Overload');
  }
  if (target.weakness === type) { dmg *= 1.5; notes.push('weakness'); }
  if (type === 'thermal' && target.family === 'warden') { dmg *= 0.5; notes.push('resisted'); }

  if (type !== 'chronal') dmg -= target.stats.grit * rules.armorFactor;
  dmg = Math.max(1, dmg);

  if (hasStatus(target, 'guard') || hasStatus(target, 'taunt')) {
    dmg *= 1 - (0.5 + (b.passives[target.id]?.guardBonus ?? 0));
    notes.push('guarded');
  }
  // Everything in an exchange moves at the same scale, so lowering it lengthens fights without
  // changing which action is the right one. Heals scale with it too, in resolveAbility.
  dmg *= rules.damageScale;
  // A fight that goes on gets worse, and only for the side holding the field. Without this a party
  // that can out-heal what it is taking never has to finish anything, and Echoes it cannot damage
  // become a place to stand rather than a problem.
  if (actor.side === 'enemy') {
    const over = Math.max(0, b.round - rules.pressure.after);
    if (over > 0) {
      dmg *= 1 + rules.pressure.perRound * over;
      if (over === 1) notes.push('pressing');
    }
  }
  dmg = Math.max(1, Math.round(dmg));

  // Shields absorb everything except thermal and chronal; Wreck shatters them first.
  let shield = target.shield;
  let hp = target.hp;
  if (ability.special === 'breakShield' && shield > 0) { shield = 0; notes.push('shield shattered'); }
  if (shield > 0 && type !== 'thermal' && type !== 'chronal') {
    const absorbed = Math.min(shield, dmg);
    shield -= absorbed;
    hp -= dmg - absorbed;
    if (absorbed > 0) notes.push(`${absorbed} absorbed`);
  } else {
    hp -= dmg;
  }
  if ((hasStatus(target, 'anchored') || hasStatus(target, 'fixed')) && hp < 1) { hp = 1; notes.push('anchored'); }
  hp = Math.max(0, hp);
  let down = hp <= 0;

  // A Construct's shell is only the first bar: break it and the core keeps fighting, with its
  // own Resolve, its own kit and its own weaknesses.
  const enemyDef = content.enemies[target.ref];
  let broke: SecondBar | null = null;
  const core = (bar: SecondBar) => Math.round(bar.resolve * (target.stand ?? 1));
  const coreShell = (bar: SecondBar) => Math.round((bar.shield ?? 0) * (target.stand ?? 1));
  if (down && target.bar === 1 && enemyDef?.secondBar) {
    broke = enemyDef.secondBar;
    down = false;
    hp = core(broke);
  }
  b = update(b, target.id, (c) => (broke
    ? {
        ...c, hp, shield: coreShell(broke), maxShield: coreShell(broke), down: false, bar: 2,
        name: broke.name, maxHp: core(broke),
        abilities: broke.abilities ?? c.abilities,
        immunities: broke.immunities ?? c.immunities,
        weakness: broke.weakness,
        rigOverride: broke.rig,
        statuses: c.statuses.filter((st) => st.id !== 'marked'),
      }
    : { ...c, hp, shield, down, statuses: down ? [] : c.statuses }));

  if (hasStatus(target, 'marked') && (p.lifestealMarked ?? 0) > 0 && dmg > 0) {
    const heal = Math.round(dmg * (p.lifestealMarked ?? 0));
    b = update(b, actor.id, (c) => ({ ...c, hp: Math.min(c.maxHp, c.hp + heal) }));
    notes.push(`+${heal} garnished`);
  }
  const tail = notes.length ? ` (${notes.join(', ')})` : '';
  const outcome = broke
    ? ` The shell splits. ${broke.flavor}`
    : down ? ` ${target.name} goes down.` : '';
  return {
    b, amount: dmg, hit: true, immune: false, meta,
    note: `${actor.name} uses ${ability.name} on ${target.name}: ${dmg} ${type} damage${tail}.${outcome}`,
  };
}

function applyStatus(b: BattleState, target: Combatant, status: StatusEffect, content: ContentDB, actorId: string): BattleState {
  if (status.id === 'fear' && target.family === 'drone') return b;
  let turns = status.turns;
  if (status.id === 'marked') turns += b.passives[actorId]?.markDuration ?? 0;
  if (status.id === 'bound') turns += b.passives[actorId]?.boundTurns ?? 0;
  void content;
  return update(b, target.id, (c) => ({ ...c, statuses: [...c.statuses, { ...status, turns }] }));
}

// ---------- abilities ----------

export function resolveAbility(b: BattleState, actorId: string, abilityId: string, targetId: string | null, content: ContentDB): BattleState {
  const actor = b.combatants.find((c) => c.id === actorId);
  if (!actor || actor.down) throw new Error('Actor unavailable');
  const ability = content.abilities[abilityId];
  if (!ability) throw new Error(`Unknown ability ${abilityId}`);
  const opts = abilityOptions(b, actorId, content).find((o) => o.ability.id === abilityId);
  if (!opts) throw new Error(`${actor.name} does not have ${abilityId}`);
  if (!opts.usable) throw new Error(opts.reason ?? 'Cannot use');

  const targets = validTargets(b, actorId, ability);
  let chosen: Combatant[];
  if (ability.target === 'allEnemies' || ability.target === 'allAllies') chosen = targets;
  else if (ability.target === 'self') chosen = [actor];
  else {
    const t = targets.find((c) => c.id === targetId);
    if (!t) throw new Error('Invalid target');
    chosen = [t];
  }

  const rules = content.rules;
  b = { ...b, fork: null };
  b = update(b, actorId, (c) => ({ ...c, threads: c.threads - ability.cost }));
  if (actor.side === 'party') {
    let gain = ability.cost * rules.tempoPerThread + (ability.tempoGain ?? 0);
    if (ability.special === 'mark') gain += (b.passives[actorId]?.tempoOnMark ?? 0) * chosen.length;
    b = { ...b, tempo: Math.min(rules.tempoMax, b.tempo + gain) };
    if (ability.damageType === 'signal') b = { ...b, usedSignal: true };
  }
  if (ability.entropyDelta) {
    b = { ...b, entropy: addEntropy(b, ability.entropyDelta, content) };
    b = log(b, `Entropy rises to ${b.entropy}.`, 'tempo');
  }

  if (ability.special === 'parley') {
    const t = chosen[0];
    const chance = clamp(0.4 + actor.stats.signal / 200 - t.stats.noise / 400 + (b.passives[actorId]?.parleyBonus ?? 0), 0.2, 0.95);
    const [r, rng] = roll(b.rng);
    b = { ...b, rng };
    if (r < chance) {
      b = update(b, t.id, (c) => ({ ...c, down: true, parleyed: true, statuses: [] }));
      b = log(b, `${actor.name} talks ${t.name} down. It powers off and drifts away.`, 'tempo', { actor: actor.name, target: t.name, ability: ability.name });
    } else {
      b = log(b, `${actor.name} tries to talk ${t.name} down, but it does not listen.`, 'info', { actor: actor.name, target: t.name, ability: ability.name });
    }
    return afterAction(b, content);
  }

  if (ability.special === 'settlement') {
    const foes = alive(b, actor.side === 'party' ? 'enemy' : 'party');
    const loose = foes.filter((f) => !hasStatus(f, 'bound'));
    if (loose.length) {
      b = log(b, `${actor.name} calls for terms, but ${loose.map((f) => f.name).join(' and ')} ${loose.length === 1 ? 'is' : 'are'} not bound to anything.`, 'warn', { actor: actor.name, ability: ability.name });
      return afterAction(b, content);
    }
    for (const f of foes) b = update(b, f.id, (c) => ({ ...c, down: true, parleyed: true, statuses: [] }));
    b = log(b, `${actor.name} settles. Every contract on the field is called in at once, and the fight is simply over.`, 'tempo', { actor: actor.name, ability: ability.name });
    return afterAction(b, content);
  }

  // Quiroga takes a Construct apart rather than beating on its shell: the frame comes off and
  // whoever is inside is fighting in the open, one bar down, without a hit landing.
  if (ability.special === 'teardown') {
    const t = chosen[0];
    const def = t ? content.enemies[t.ref] : undefined;
    if (!t || !def?.secondBar || t.bar === 2) {
      b = log(b, `${actor.name} looks for a seam on ${t?.name ?? 'nothing'} and does not find one.`, 'warn', { actor: actor.name, ability: ability.name });
      return afterAction(b, content);
    }
    const core = def.secondBar;
    b = update(b, t.id, (c) => ({
      ...c, hp: core.resolve, maxHp: core.resolve, shield: core.shield ?? 0, maxShield: core.shield ?? 0,
      bar: 2, name: core.name, rigOverride: core.rig,
      abilities: core.abilities ?? c.abilities, immunities: core.immunities ?? c.immunities,
      weakness: core.weakness, statuses: c.statuses.filter((st) => st.id !== 'marked'),
    }));
    b = log(b, `${actor.name} takes ${t.name} apart at the seam. The shell comes off in one piece. ${core.flavor}`, 'tempo', { actor: actor.name, target: t.name, ability: ability.name });
    return afterAction(b, content);
  }

  // Open Weights: every machine on the other side stops being on the other side.
  if (ability.special === 'openWeights') {
    const machines = alive(b, actor.side === 'party' ? 'enemy' : 'party').filter((c) => c.machine);
    if (!machines.length) {
      b = log(b, `${actor.name} opens the weights, and nothing on this field is listening.`, 'warn', { actor: actor.name, ability: ability.name });
      return afterAction(b, content);
    }
    for (const m of machines) {
      b = update(b, m.id, (c) => ({
        ...c, side: actor.side, temporary: true, expiresAfterRound: b.round + 3, statuses: [],
      }));
    }
    b = log(b, `${actor.name} publishes the weights. ${machines.map((m) => m.name).join(', ')} read them and change sides for three rounds.`, 'tempo', { actor: actor.name, ability: ability.name });
    return afterAction(b, content);
  }

  // Buyout: one enemy per battle is bought outright, and stays bought.
  if (ability.special === 'buyout') {
    const t = chosen[0];
    if (b.passives[actorId]?.boughtOut) {
      b = log(b, `${actor.name} has already spent this fight's position.`, 'warn', { actor: actor.name, ability: ability.name });
      return afterAction(b, content);
    }
    if (!t) return afterAction(b, content);
    b = { ...b, passives: { ...b.passives, [actorId]: { ...(b.passives[actorId] ?? {}), boughtOut: 1 } } };
    b = update(b, t.id, (c) => ({ ...c, side: actor.side, statuses: [], parleyed: false }));
    b = log(b, `${actor.name} buys ${t.name} out. Terms agreed, paperwork later, and ${t.name} is on this side now.`, 'tempo', { actor: actor.name, target: t.name, ability: ability.name });
    return afterAction(b, content);
  }

  // Acquisition: whatever the target is enjoying, the actor is enjoying instead.
  if (ability.special === 'acquisition') {
    const t = chosen[0];
    const GOOD = ['guard', 'taunt', 'inspired', 'anchored', 'fixed', 'faraday', 'held'];
    const taken = t ? t.statuses.filter((st) => GOOD.includes(st.id)) : [];
    if (!t || !taken.length) {
      b = log(b, `${actor.name} looks over ${t?.name ?? 'the field'} and finds nothing worth taking.`, 'warn', { actor: actor.name, ability: ability.name });
      return afterAction(b, content);
    }
    b = update(b, t.id, (c) => ({ ...c, statuses: c.statuses.filter((st) => !GOOD.includes(st.id)) }));
    b = update(b, actorId, (c) => ({ ...c, statuses: [...c.statuses, ...taken] }));
    b = log(b, `${actor.name} acquires ${taken.map((st) => STATUS_NAMES[st.id] ?? st.id).join(' and ')} from ${t.name}.`, 'tempo', { actor: actor.name, target: t.name, ability: ability.name });
    return afterAction(b, content);
  }

  if (ability.special === 'spawnAlly' && ability.spawn) {
    const spec = ability.spawn;
    const live = alive(b, actor.side).filter((c) => c.temporary).length;
    if (live >= 2) {
      b = log(b, `${actor.name} cannot hold a third copy together.`, 'warn', { actor: actor.name, ability: ability.name });
      return afterAction(b, content);
    }
    const hp = Math.max(1, Math.round(actor.maxHp * spec.hpFactor));
    const copy: Combatant = {
      id: `copy:${actorId}:${b.round}:${live}`, ref: actor.ref, name: `${spec.name} ${live + 1}`,
      side: actor.side, machine: actor.machine, stats: { ...actor.stats, latency: actor.stats.latency + 2 },
      hp, maxHp: hp, shield: 0, maxShield: 0, threads: 0, slack: 0, statuses: [],
      abilities: [...spec.abilities], immunities: [], down: false, perception: actor.perception,
      temporary: true, expiresAfterRound: b.round + spec.turns,
    };
    const order = [...b.order];
    order.splice(b.turnIndex + 1, 0, copy.id);
    b = { ...b, combatants: [...b.combatants, copy], order };
    b = log(b, `${actor.name} forks a copy of itself. ${copy.name} holds for ${spec.turns} round${spec.turns === 1 ? '' : 's'}.`, 'tempo', { actor: actor.name, ability: ability.name });
    return afterAction(b, content);
  }

  if (ability.special === 'marksToTempo') {
    const foes = alive(b, 'enemy').filter((e) => hasStatus(e, 'marked'));
    const gain = foes.length * 4;
    b = { ...b, tempo: Math.min(rules.tempoMax, b.tempo + gain) };
    for (const f of foes) b = update(b, f.id, (c) => ({ ...c, statuses: c.statuses.filter((s) => s.id !== 'marked') }));
    b = log(b, `${actor.name} reconciles ${foes.length} mark${foes.length === 1 ? '' : 's'} into ${gain} Tempo.`, 'tempo', { actor: actor.name, ability: ability.name });
    return afterAction(b, content);
  }

  if (ability.special === 'selfDamage') {
    const mult = (b.passives[actorId]?.penanceDouble ?? 0) > 0 ? 2 : 1;
    const cost = Math.round(actor.maxHp * 0.15 * mult);
    b = update(b, actorId, (c) => ({ ...c, hp: Math.max(1, c.hp - cost) }));
    b = log(b, `${actor.name} gives up ${cost} Resolve to pay for ${ability.name}.`, 'warn', { actor: actor.name, ability: ability.name });
  }

  // A released shot spends the charge whether it lands or not; that is the risk of holding.
  const spendsCharge = ability.special === 'release';

  for (const t of chosen) {
    if (ability.formula && ability.damageType) {
      const r = resolveDamage(b, b.combatants.find((c) => c.id === actorId)!, b.combatants.find((c) => c.id === t.id)!, ability, content);
      b = log(r.b, r.note, r.immune ? 'warn' : 'hit', r.meta);
      if (!r.hit || r.immune) continue;
    }
    if (ability.heal) {
      const a = b.combatants.find((c) => c.id === actorId)!;
      let amount = evalFormula(ability.heal, { a: a.stats, d: t.stats }) * content.rules.damageScale;
      amount *= 1 + (b.passives[actorId]?.healBonus ?? 0);
      if (ability.special === 'selfDamage') {
        if (t.id === actorId) continue;
        if ((b.passives[actorId]?.penanceDouble ?? 0) > 0) amount *= 2;
      }
      const healed = Math.round(amount);
      b = update(b, t.id, (c) => ({ ...c, hp: Math.min(c.maxHp, c.hp + healed) }));
      b = log(b, `${a.name} uses ${ability.name} on ${t.name}: ${healed} Resolve restored.`, 'heal', { actor: a.name, target: t.name, ability: ability.name });
    }
    if (ability.status) {
      const tgt = b.combatants.find((c) => c.id === t.id)!;
      if (!tgt.down) {
        b = applyStatus(b, tgt, { id: ability.status.id, turns: ability.status.turns }, content, actorId);
        const m = { actor: actor.name, target: t.name, ability: ability.name };
        if (ability.special === 'mark') b = log(b, `${actor.name} marks ${t.name}: weakness ${t.weakness ?? 'none'}, Grit ${t.stats.grit}, Noise ${t.stats.noise}.`, 'tempo', m);
        else if (!ability.formula) b = log(b, `${actor.name} uses ${ability.name} on ${t.name}.`, 'info', m);
      }
    }
  }
  if (spendsCharge) b = update(b, actorId, (c) => ({ ...c, statuses: c.statuses.filter((st) => st.id !== 'held') }));
  return afterAction(b, content);
}

function afterAction(b: BattleState, content: ContentDB): BattleState {
  b = maybeSpawnEcho(b, content);
  b = checkEnd(b, content);
  if (b.phase === 'won' || b.phase === 'lost') return b;
  const actor = current(b);
  if (actor && actor.threads <= 0) return endTurn(b, actor.id, content);
  return b;
}

export function useItem(b: BattleState, actorId: string, item: ItemDef, targetId: string, content: ContentDB): BattleState {
  const actor = current(b);
  if (!actor || actor.id !== actorId || actor.threads < 1) throw new Error('Cannot use item now');
  const target = b.combatants.find((c) => c.id === targetId && c.side === 'party');
  if (!target || !item.effect) throw new Error('Invalid item target');
  if (target.down && !item.effect.revive) throw new Error(`${target.name} is down`);
  b = { ...b, fork: null };
  b = update(b, actorId, (c) => ({ ...c, threads: c.threads - 1 }));
  const e = item.effect;
  b = update(b, targetId, (c) => ({
    ...c,
    down: e.revive ? false : c.down,
    hp: Math.min(c.maxHp, (e.revive && c.down ? 0 : c.hp) + Math.round((e.heal ?? 0) * content.rules.damageScale)),
    slack: Math.min(slackCap(b, c, content), c.slack + (e.slack ?? 0)),
  }));
  if (e.tempo) b = { ...b, tempo: Math.min(content.rules.tempoMax, b.tempo + e.tempo) };
  b = log(b, `${actor.name} uses ${item.name} on ${target.name}.`, 'heal', { actor: actor.name, target: target.name, ability: item.name });
  return afterAction(b, content);
}

// ---------- Tempo abilities ----------

/**
 * Collapse: bank the battle exactly as it stands. If the party is wiped afterwards, the banked
 * state is resumed from instead of losing, once. You pay Tempo now against a loss you may never take.
 */
export function collapse(b: BattleState, content: ContentDB): BattleState {
  const { cost, entropy } = content.rules.collapse;
  if (b.phase !== 'player') throw new Error('Collapse only on your turn');
  if (b.collapseUsed || b.collapsePoint) throw new Error('The state is already banked');
  if (b.tempo < cost) throw new Error(`Collapse needs ${cost} Tempo`);
  const point: RewindPoint = {
    combatants: b.combatants.map((c) => ({ ...c, statuses: [...c.statuses] })),
    rng: b.rng, turnIndex: b.turnIndex, round: b.round, tempo: b.tempo - cost,
    logLength: b.log.length, actorId: current(b)?.id ?? '', description: 'banked',
  };
  let nb: BattleState = {
    ...b, collapsePoint: point, tempo: b.tempo - cost,
    entropy: addEntropy(b, entropy, content), fork: null,
  };
  nb = log(nb, 'The fight is banked. If it goes badly from here, it goes badly from here again instead.', 'tempo');
  return nb;
}

/**
 * Echo: another era's version of a party member steps in for one round. They may be benched, and
 * the era has to be one the party has actually been to.
 */
export function echoAssist(b: BattleState, characterId: string, content: ContentDB, era: EraId): BattleState {
  const { cost, entropy, turns } = content.rules.echo;
  if (b.phase !== 'player') throw new Error('Echo only on your turn');
  if (b.echoAssistUsed) throw new Error('One Echo per battle');
  if (b.tempo < cost) throw new Error(`Echo needs ${cost} Tempo`);
  const def = content.characters[characterId];
  if (!def) throw new Error(`Unknown character ${characterId}`);
  const hp = Math.round(def.baseStats.resolve * 0.7);
  const ghost: Combatant = {
    id: `echo:${characterId}:${b.round}`, ref: characterId, name: `${def.shortName}, ${era}`,
    side: 'party', machine: false, stats: { ...def.baseStats, latency: def.baseStats.latency - 4 },
    hp, maxHp: hp, shield: 0, maxShield: 0, threads: 0, slack: 0, statuses: [],
    abilities: [...def.abilities], immunities: [], down: false, perception: 50,
    echoOf: characterId, temporary: true, expiresAfterRound: b.round + turns,
  };
  const order = [...b.order];
  order.splice(b.turnIndex + 1, 0, ghost.id);
  let nb: BattleState = {
    ...b, combatants: [...b.combatants, ghost], order, echoAssistUsed: true,
    tempo: b.tempo - cost, entropy: addEntropy(b, entropy, content), fork: null,
  };
  nb = log(nb, `${def.name} steps out of ${era} for one round. ${ghost.name} is not quite the person you know.`, 'tempo');
  return nb;
}

export function rewind(b: BattleState, content: ContentDB): BattleState {
  const cost = content.rules.rewind.cost;
  if (b.phase !== 'player') throw new Error('Rewind only on your turn');
  if (b.rewindsLeft <= 0) throw new Error('No Rewinds left');
  if (b.tempo < cost) throw new Error(`Rewind needs ${cost} Tempo`);
  if (!b.rewindPoint) throw new Error('Nothing to rewind');
  const rp = b.rewindPoint;
  const entropy = addEntropy(b, content.rules.rewind.entropy, content);
  let nb: BattleState = {
    ...b,
    combatants: rp.combatants.map((c) => ({ ...c, statuses: [...c.statuses] })),
    rng: rp.rng + 1,
    turnIndex: rp.turnIndex,
    round: rp.round,
    tempo: b.tempo - cost,
    entropy,
    log: b.log.slice(0, rp.logLength),
    rewindsLeft: b.rewindsLeft - 1,
    rewindPoint: null,
    fork: null,
    phase: 'enemy',
  };
  nb = log(nb, `Rewind: ${rp.description} is undone. Entropy rises to ${entropy}.`, 'tempo', { ability: 'Rewind' });
  return nb;
}

export function fork(b: BattleState, actorId: string, abilityId: string, targetId: string | null, content: ContentDB): BattleState {
  const f = content.rules.fork;
  const actor = current(b);
  if (!actor || actor.id !== actorId || b.phase !== 'player') throw new Error('Fork only on your turn');
  if (b.tempo < f.cost) throw new Error(`Fork needs ${f.cost} Tempo`);
  if (actor.threads < f.threadCost + (content.abilities[abilityId]?.cost ?? 0)) throw new Error('Not enough threads to fork and act');
  let nb: BattleState = {
    ...b,
    tempo: b.tempo - f.cost,
    entropy: addEntropy(b, f.entropy, content),
  };
  nb = update(nb, actorId, (c) => ({ ...c, threads: c.threads - f.threadCost }));
  const sim = resolveAbility(nb, actorId, abilityId, targetId, content);
  const lines: string[] = [];
  for (const before of nb.combatants) {
    const after = sim.combatants.find((c) => c.id === before.id);
    if (!after) continue;
    const parts: string[] = [];
    const hp = after.hp - before.hp;
    if (hp < 0) parts.push(`takes ${-hp} damage, Resolve ${before.hp} → ${after.hp}`);
    if (hp > 0) parts.push(`recovers ${hp} Resolve, ${before.hp} → ${after.hp}`);
    if (after.shield !== before.shield) parts.push(`shield ${before.shield} → ${after.shield}`);
    if (after.down && !before.down) parts.push(after.parleyed ? 'is talked down' : 'goes down');
    const gained = after.statuses.filter((st) => !before.statuses.some((o) => o.id === st.id));
    if (gained.length) parts.push(`gains ${gained.map((st) => STATUS_NAMES[st.id] ?? st.id).join(', ')}`);
    if (hp === 0 && after.shield === before.shield && !parts.length) continue;
    if (parts.length) lines.push(`${after.name} ${parts.join(', ')}.`);
  }
  for (const c of sim.combatants) if (!nb.combatants.some((o) => o.id === c.id)) lines.push(`${c.name} would appear.`);
  if (!lines.length) lines.push('Nothing on the field would change.');
  const tempoDelta = sim.tempo - nb.tempo;
  if (tempoDelta) lines.push(`Tempo ${tempoDelta > 0 ? '+' : ''}${tempoDelta}.`);
  const entropyDelta = sim.entropy - nb.entropy;
  if (entropyDelta) lines.push(`Entropy +${entropyDelta}.`);
  nb = log(nb, `Fork: previewing ${content.abilities[abilityId].name}. Entropy rises to ${nb.entropy}.`, 'tempo', { ability: 'Fork' });
  return { ...nb, fork: { abilityId, targetId: targetId ?? '', lines } };
}

const STATUS_NAMES: Record<string, string> = {
  guard: 'Guard', taunt: 'Bulwark', marked: 'a mark', inspired: 'Litany', anchored: 'an anchor',
  fixed: 'Fixed Point', faraday: 'Faraday', fear: 'Fear', locked: 'Target Lock', bound: 'Terms', held: 'Held',
};

function maybeSpawnEcho(b: BattleState, content: ContentDB): BattleState {
  if (b.echoSpawned || b.entropy < content.rules.entropyThreshold) return b;
  const party = alive(b, 'party');
  if (!party.length) return b;
  const [i, rng] = rollInt(b.rng, party.length);
  const src = party[i];
  const echo: Combatant = {
    id: `echo:${src.id}`, ref: 'echo', name: `Echo of ${src.name}`, side: 'enemy', family: 'echo', machine: false,
    stats: { ...src.stats, latency: 10 }, hp: Math.round(src.maxHp * 0.6), maxHp: Math.round(src.maxHp * 0.6),
    shield: 0, maxShield: 0, threads: 0, slack: 0, statuses: [],
    abilities: ['echo_fracture', 'echo_mimic'], immunities: ['kinetic', 'thermal', 'signal'], weakness: 'chronal',
    // echoOf names a character, not a combatant: the source may itself be a temporary copy or
    // another era's ghost, whose combatant id is not in the roster and has no rig to draw.
    down: false, echoOf: src.echoOf ?? src.ref, perception: 60,
  };
  const order = [...b.order];
  order.splice(b.turnIndex + 1, 0, echo.id);
  b = { ...b, rng, combatants: [...b.combatants, echo], order, echoSpawned: true };
  return log(b, `Entropy ${b.entropy}: the fracture opens. An Echo of ${src.name} steps out of a version of this fight. Only Chronal damage touches it.`, 'warn');
}

// ---------- enemy AI ----------

export function enemyTurn(b: BattleState, content: ContentDB): BattleState {
  const actor = current(b);
  if (!actor || actor.side !== 'enemy' || b.phase !== 'enemy') throw new Error('Not an enemy turn');
  const rewindPoint = {
    combatants: b.combatants.map((c) => ({ ...c, statuses: [...c.statuses] })),
    rng: b.rng, turnIndex: b.turnIndex, round: b.round, tempo: b.tempo, logLength: b.log.length,
    actorId: actor.id, description: `${actor.name}'s turn`,
  };
  b = { ...b, rewindPoint };
  let guard = 0;
  while (guard++ < 6) {
    const me = current(b);
    if (!me || me.down || me.threads <= 0 || b.phase !== 'enemy') break;
    const usable = abilityOptions(b, me.id, content).filter((o) => o.usable);
    if (!usable.length) break;
    // Prefer the heaviest affordable ability most of the time.
    const sorted = [...usable].sort((x, y) => y.ability.cost - x.ability.cost);
    const [r, rng] = roll(b.rng);
    b = { ...b, rng };
    const pick = r < 0.65 ? sorted[0] : sorted[Math.floor(r * sorted.length) % sorted.length];
    const targets = validTargets(b, me.id, pick.ability);
    if (!targets.length) break;
    let target: Combatant;
    const taunter = targets.find((t) => hasStatus(t, 'taunt'));
    if (taunter && pick.ability.target === 'enemy') target = taunter;
    else {
      const [r2, rng2] = roll(b.rng);
      b = { ...b, rng: rng2 };
      const byHp = [...targets].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
      target = r2 < 0.5 ? byHp[0] : byHp[Math.floor(r2 * byHp.length) % byHp.length];
    }
    b = resolveAbility(b, me.id, pick.ability.id, target.id, content);
  }
  if (b.phase === 'enemy') {
    const me = current(b);
    if (me && me.id === actor.id) b = endTurn(b, me.id, content);
  }
  // An enemy with no legal target breaks out of its turn without resolving an ability, so the
  // end condition has to be re-checked here rather than only after something lands.
  return checkEnd(b, content);
}

// ---------- end of battle ----------

function checkEnd(b: BattleState, content: ContentDB): BattleState {
  if (b.phase === 'won' || b.phase === 'lost') return b;
  // A banked state is spent here: the party does not fall, the fight resumes from where it was.
  if (alive(b, 'party').filter((c) => !c.temporary).length === 0 && b.collapsePoint) {
    const rp = b.collapsePoint;
    let nb: BattleState = {
      ...b,
      combatants: rp.combatants.map((c) => ({ ...c, statuses: [...c.statuses] })),
      rng: rp.rng + 1, turnIndex: rp.turnIndex, round: rp.round, tempo: rp.tempo,
      log: b.log.slice(0, rp.logLength),
      collapsePoint: null, collapseUsed: true, fork: null, phase: 'player',
    };
    nb = log(nb, 'The fight collapses back to where you banked it. You have been here before and you know what is coming.', 'tempo');
    return nb;
  }
  if (alive(b, 'enemy').length === 0) {
    b = { ...b, phase: 'won', pendingRewards: rewards(b, content) };
    return log(b, 'The field is clear.', 'system');
  }
  if (alive(b, 'party').filter((c) => !c.temporary).length === 0) {
    b = { ...b, phase: 'lost' };
    return log(b, 'The party falls.', 'warn');
  }
  return b;
}

function rewards(b: BattleState, content: ContentDB): BattleRewards {
  const enc = content.encounters[b.encounterId];
  let xp = 0;
  const items: string[] = [];
  let rng = b.rng;
  let sawWarden = false;
  for (const c of b.combatants) {
    if (c.side !== 'enemy') continue;
    if (c.family === 'warden') sawWarden = true;
    const def = content.enemies[c.ref];
    const base = def ? def.xp : Math.round(c.maxHp / 2);
    xp += c.parleyed ? Math.round(base / 2) : base;
    if (def && !c.parleyed) {
      for (const d of def.drops) {
        const [r, n] = roll(rng);
        rng = n;
        if (r < d.chance) items.push(d.item);
      }
    }
  }
  const flags = [...(enc?.rewardFlags ?? [])];
  if (sawWarden && !b.usedSignal) flags.push('killedWardenWithoutSignal');
  if (b.echoSpawned) flags.push('facedOwnEcho');
  return { xp, currency: Math.round(xp * 0.5), items, flags, levelUps: [] };
}
