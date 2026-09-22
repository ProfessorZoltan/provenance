import { STATUS_INFO, statusClause, statusLabel, statusSentence, turnsText } from './statuses';
import type { AbilityDef, ContentDB, DamageType, EnemyDef, EraId, ItemDef, SecondBar, Targeting } from '../../types/content';
import type { BattleLogEntry, BattleRewards, BattleState, Combatant, GameState, LogMeta, RewindPoint, StatusEffect } from '../../types/state';
import { evalFormula } from '../formula';
import { rngFloat, roll, rollInt, seedFromString } from '../rng';
import { loadout, maxNerve, nerveCost, nerveOf, partySync } from '../stats';
import { clamp, deriveWorld } from '../timeline';

// ---------- construction ----------

export function createBattle(content: ContentDB, state: GameState, encounterId: string, surprise: boolean): BattleState {
  const enc = content.encounters[encounterId];
  if (!enc) throw new Error(`Unknown encounter ${encounterId}`);
  const passives: Record<string, Record<string, number>> = {};
  const combatants: Combatant[] = [];

  for (const id of state.activeParty) {
    const made = partyCombatant(content, state, id);
    if (!made) continue;
    passives[id] = made.passives;
    combatants.push(made.combatant);
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
  // One Rewind every fight, whoever is on the field: a charge that cannot be saved up is a charge
  // that gets used. Anchors and the nodes that grant more add to it.
  let rewinds = content.rules.rewind.base;
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
    encounterId, era: enc.era, seed: state.rng, rng: state.rng, combatants, reserve: [], order,
    turnIndex: -1, round: 1, tempo: Math.min(content.rules.tempoMax, openingTempo), entropy: clamp(state.entropy ?? 0, 0, content.rules.entropyMax),
    phase: 'player', surprise, log: [], rewindsLeft: rewinds, rewindPoint: null, fork: null,
    collapsePoint: null, collapseUsed: false, echoAssistUsed: false,
    echoSpawned: false, usedSignal: false, fractures: [], story: enc.story, passives, partySync: sync, pendingRewards: null,
  };
  b = log(b, surprise ? `Surprise attack. ${enc.flavor}` : enc.flavor, surprise ? 'warn' : 'info');
  if (b.entropy > 0) b = log(b, `Entropy comes in at ${b.entropy}${entropyTier(b, content) ? ` (${entropyTier(b, content)})` : ''}.`, 'tempo');
  if (surprise) b = log(b, 'The party starts with no Slack and the enemy acts first.', 'warn');
  // A fight can be over before anyone acts: walk in with nobody standing and it is already lost.
  // Without this the enemy cycles its turns forever against a party that can never answer.
  b = checkEnd(b, content);
  return b.phase === 'won' || b.phase === 'lost' ? b : advance(b, content);
}

/** A party member as they would take the field right now: stats, kit and the Resolve they carry. */
export function partyCombatant(content: ContentDB, state: GameState, id: string): { combatant: Combatant; passives: Record<string, number> } | null {
  const def = content.characters[id];
  const cs = state.party[id];
  if (!def || !cs) return null;
  const l = loadout(content, def, cs);
  // A person who has been edited out of their own century has less of themselves to stand on.
  const continuity = deriveWorld(content, state.world, state.party).continuity[id] ?? 100;
  const floor = content.rules.continuityCombat.resolveFloor;
  const maxHp = Math.max(1, Math.round(l.stats.resolve * (floor + (1 - floor) * continuity / 100)));
  const hp = Math.min(maxHp, cs.hp);
  return {
    passives: l.passives,
    combatant: {
      id, ref: id, name: def.shortName, side: 'party', machine: false,
      stats: { ...l.stats }, hp, maxHp, shield: 0, maxShield: 0,
      threads: 0, slack: 0, statuses: [], abilities: [...l.abilities], immunities: [],
      down: hp <= 0, perception: 0,
      nerve: nerveOf(content, cs), maxNerve: maxNerve(content, cs), continuity, level: cs.level,
    },
  };
}

function enemyCombatant(def: EnemyDef, id: string, name: string, stand = 1): Combatant {
  const resolve = Math.round(def.stats.resolve * stand);
  const shield = Math.round(def.shield * stand);
  return {
    id, ref: def.id, name, side: 'enemy', family: def.family, machine: def.machine,
    stats: { ...def.stats, resolve }, hp: resolve, maxHp: resolve, stand,
    shield, maxShield: shield, threads: 0, slack: 0, statuses: [],
    abilities: [...def.abilities], immunities: [...def.immunities], weakness: def.weakness,
    down: false, perception: def.perception, nerve: 0, maxNerve: 0, continuity: 100,
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

/** Entropy in real points, for the creep and the enemy's pull: things that are not an exchange. */
function bumpEntropy(b: BattleState, amount: number, content: ContentDB): BattleState {
  return { ...b, entropy: clamp(b.entropy + amount, 0, content.rules.entropyMax) };
}

/** The tier the fight is in, in a word, or nothing while Entropy is still quiet. */
export function entropyTier(b: BattleState, content: ContentDB): string {
  const t = content.rules.entropyTiers;
  if (b.entropy >= t.slip.at) return 'slipping';
  if (b.entropy >= content.rules.entropyThreshold) return 'echoing';
  if (b.entropy >= t.fray.at) return 'fraying';
  return '';
}

/** Tempo comes faster once time is fraying: the temptation to keep pulling. */
export function tempoScale(b: BattleState, content: ContentDB): number {
  return b.entropy >= content.rules.entropyTiers.fray.at ? content.rules.entropyTiers.fray.tempoMultiplier : 1;
}

/**
 * Entropy at its ceiling breaks over someone: a piece of their Continuity goes for good, applied
 * when the fight ends, and the gauge falls back to where the fracture closed.
 */
function settleEntropy(b: BattleState, content: ContentDB): BattleState {
  const brk = content.rules.entropyTiers.break;
  if (b.entropy < brk.at) return b;
  const who = alive(b, 'party').filter((c) => !c.temporary);
  if (!who.length) return b;
  const [r, rng] = roll(b.rng);
  const victim = who[Math.floor(r * who.length) % who.length];
  b = { ...b, rng, fractures: [...b.fractures, victim.id], entropy: content.rules.entropyFlow.afterBreak };
  b = update(b, victim.id, (c) => ({ ...c, continuity: Math.max(content.rules.continuityFloor, c.continuity - brk.continuityLoss) }));
  return log(b, `Entropy breaks over ${victim.name}. A piece of their Continuity tears away: ${brk.continuityLoss} gone for good. The gauge falls back to ${b.entropy}.`, 'warn', { target: victim.name });
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

export function abilityOptions(b: BattleState, actorId: string, content: ContentDB, threads?: number): AbilityOption[] {
  const actor = b.combatants.find((c) => c.id === actorId);
  if (!actor) return [];
  const have = threads ?? actor.threads;
  const ids = [...actor.abilities];
  if (actor.side === 'party' && canParley(b, content) && !ids.includes('parley')) ids.push('parley');
  return ids.map((id) => {
    const ability = content.abilities[id];
    if (have < ability.cost) return { ability, usable: false, reason: `Needs ${ability.cost} threads` };
    if (ability.special === 'unleash' && !hasStatus(actor, 'charging')) return { ability, usable: false, reason: 'Needs a wind-up first' };
    if (actor.side === 'party') {
      const nerve = nerveCost(content, ability);
      if (nerve > actor.nerve) return { ability, usable: false, reason: `Needs ${nerve} Nerve (${actor.nerve} left)` };
      if (ability.pair) {
        const partner = pairPartner(b, actor, ability, content);
        if (partner.reason) return { ability, usable: false, reason: partner.reason };
      }
    }
    if (ability.damageType === 'signal' && b.partySync <= content.rules.overloadSync) {
      return { ability, usable: false, reason: 'Overload disables Signal abilities' };
    }
    if (ability.requiresMachine && !alive(b, 'enemy').some((e) => e.machine)) return { ability, usable: false, reason: 'No machine to talk to' };
    return { ability, usable: true };
  });
}

/** The partner a pair tech needs, or why it is not on: they have to be standing, at level, and not already lending. */
export function pairPartner(b: BattleState, actor: Combatant, ability: AbilityDef, content: ContentDB): { partner?: Combatant; reason?: string } {
  const withId = ability.pair?.with;
  if (!withId) return {};
  const name = content.characters[withId]?.shortName ?? withId;
  const partner = b.combatants.find((c) => c.id === withId && c.side === 'party' && !c.temporary);
  if (!partner || partner.down) return { reason: `Needs ${name} standing on the field` };
  const need = content.rules.pairs.level;
  if ((actor.level ?? 1) < need || (partner.level ?? 1) < need) return { reason: `Both need to be level ${need}` };
  if (hasStatus(partner, 'spent')) return { reason: `${name} has already lent a hand this round` };
  return { partner };
}

export function validTargets(b: BattleState, actorId: string, ability: AbilityDef): Combatant[] {
  const actor = b.combatants.find((c) => c.id === actorId);
  if (!actor) return [];
  const foes = actor.side === 'party' ? 'enemy' : 'party';
  switch (ability.target) {
    case 'enemy': {
      const all = alive(b, foes).filter((e) => !ability.requiresMachine || e.machine);
      // Whoever is standing in front takes it: a Bulwark on either side draws every single hit.
      const wall = all.filter((e) => hasStatus(e, 'taunt') || hasStatus(e, 'wall'));
      return wall.length ? wall : all;
    }
    case 'allEnemies': return alive(b, foes);
    case 'ally': return b.combatants.filter((c) => c.side === actor.side && (!c.down || ability.id === 'revive'));
    case 'allAllies': return alive(b, actor.side);
    case 'self': return [actor];
  }
}

// ---------- turn flow ----------

/** Count every status down one, and say out loud which ones have run out. */
function tickStatuses(b: BattleState, c: Combatant): { b: BattleState; c: Combatant } {
  const statuses = c.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
  const gone = [...new Set(c.statuses.map((s) => s.id))].filter((id) => !statuses.some((s) => s.id === id));
  for (const id of gone) b = log(b, `${statusLabel(id)} on ${c.name} wears off.`, 'system', { target: c.name });
  return { b, c: { ...c, statuses } };
}

function beginTurn(b: BattleState, content: ContentDB): BattleState {
  const actor = current(b);
  if (!actor) return b;
  if (actor.temporary && actor.expiresAfterRound !== undefined && b.round > actor.expiresAfterRound) {
    b = update(b, actor.id, (c) => ({ ...c, down: true, hp: 0, statuses: [] }));
    b = log(b, `${actor.name} runs out of time and dissolves.`, 'tempo', { actor: actor.name });
    return advance(b, content);
  }
  const ticked = tickStatuses(b, actor);
  b = ticked.b;
  let c = ticked.c;
  let threads = c.stats.bandwidth + (c.side === 'party' ? c.slack : 0);
  const feared = hasStatus(c, 'fear');
  if (feared) threads = Math.max(1, threads - 1);
  const lent = c.side === 'party' && hasStatus(c, 'spent');
  if (lent) threads = Math.max(1, threads - content.rules.pairs.partnerPenalty);
  c = { ...c, threads, slack: 0, itemUsed: false };
  b = update(b, c.id, () => c);
  b = { ...b, phase: c.side === 'party' ? 'player' : 'enemy', fork: null };
  if (c.side === 'party' && !c.temporary) {
    // Someone thinned by edits to their own century is not always entirely here.
    const cc = b.combatants.find((x) => x.id === c.id)!;
    const cr = content.rules.continuityCombat;
    if (cc.continuity < cr.flickerBelow) {
      const [r, rng] = roll(b.rng);
      b = { ...b, rng };
      if (r < (cr.flickerBelow - cc.continuity) / 100) {
        b = log(b, `${c.name} flickers. For a moment they are not here, and the turn goes by without them.`, 'warn', { actor: c.name });
        b = update(b, c.id, (x) => ({ ...x, threads: 0 }));
        return advance(b, content);
      }
    }
    // Past the slipping line, a turn can belong to a version of you that took a different swing.
    const slip = content.rules.entropyTiers.slip;
    if (b.entropy >= slip.at) {
      const [r, rng] = roll(b.rng);
      b = { ...b, rng };
      if (r < slip.chance) return slipTurn(b, c.id, content);
    }
  }
  if (c.side === 'party') {
    b = log(b, `${c.name}'s turn: ${threads} threads${feared ? ' (one short, from Fear)' : ''}${lent ? ' (short, for the hand they lent)' : ''}.`, 'system');
  }
  return b;
}

/**
 * A slipped turn: the member strikes whoever the other version of them was facing, which is
 * anyone on the field but themselves. Control comes back next turn.
 */
function slipTurn(b: BattleState, actorId: string, content: ContentDB): BattleState {
  const actor = b.combatants.find((c) => c.id === actorId)!;
  const strikeId = actor.abilities.find((a) => a === 'strike') ?? actor.abilities.find((a) => content.abilities[a]?.damageType && content.abilities[a].target === 'enemy');
  const ability = strikeId ? content.abilities[strikeId] : undefined;
  const others = b.combatants.filter((c) => !c.down && c.id !== actorId);
  b = log(b, `${actor.name} slips. Another version of them is standing here, and it is not sure whose side it is on.`, 'warn', { actor: actor.name });
  if (ability && others.length) {
    const [r, rng] = roll(b.rng);
    b = { ...b, rng };
    const target = others[Math.floor(r * others.length) % others.length];
    const hit = resolveDamage(b, actor, target, ability, content);
    b = log(hit.b, hit.note, hit.immune ? 'warn' : 'hit', hit.meta);
    b = checkEnd(b, content);
    if (b.phase === 'won' || b.phase === 'lost') return b;
  }
  b = update(b, actorId, (c) => ({ ...c, threads: 0 }));
  return advance(b, content);
}

/** Move to the next living combatant, wrapping rounds. */
/** Every round that passes pulls a little on time, whoever is winning. */
function creep(b: BattleState, content: ContentDB): BattleState {
  const per = content.rules.entropyFlow.perRound;
  if (per <= 0 || b.entropy >= content.rules.entropyMax) return b;
  const before = entropyTier(b, content);
  b = bumpEntropy(b, per, content);
  const after = entropyTier(b, content);
  if (after && after !== before) b = log(b, `Entropy creeps to ${b.entropy}: ${TIER_TEXT[after]}`, 'warn');
  return settleEntropy(b, content);
}

const TIER_TEXT: Record<string, string> = {
  fraying: 'time is fraying. Chronal hits harder on both sides, and Tempo comes twice as fast.',
  echoing: 'an Echo can answer from here.',
  slipping: 'turns can slip. Someone may not be entirely themselves.',
};

function advance(b: BattleState, content: ContentDB): BattleState {
  if (b.phase === 'won' || b.phase === 'lost') return b;
  const n = b.order.length;
  for (let step = 0; step < n; step++) {
    let idx = b.turnIndex + 1;
    let round = b.round;
    if (idx >= n) { idx = 0; round += 1; }
    b = { ...b, turnIndex: idx, round };
    if (idx === 0 && step === 0 && round > 1) b = creep(b, content);
    const c = current(b);
    if (c && !c.down) return beginTurn(b, content);
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
  return advance(b, content);
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
  const partner = ability.pair ? pairPartner(b, actor, ability, content).partner : undefined;
  let dmg = evalFormula(ability.formula ?? '0', { a: actor.stats, p: partner?.stats ?? actor.stats, d: target.stats, marks, lost: actor.maxHp - actor.hp });
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
  if (type === 'chronal') {
    // Fraying time cuts deeper for everyone; a person with less of their own timeline cuts deepest.
    if (b.entropy >= rules.entropyTiers.fray.at) { dmg *= 1 + rules.entropyTiers.fray.chronalBonus; notes.push('fraying'); }
    if (actor.side === 'party' && actor.continuity < 100) {
      dmg *= 1 + ((100 - actor.continuity) / 100) * rules.continuityCombat.chronalBonus;
      notes.push('thin');
    }
  }
  if (target.weakness === type) {
    dmg *= 1.5;
    notes.push('weakness');
    // Reading the type chart is what earns Tempo, not spending threads.
    if (actor.side === 'party' && rules.tempoOnWeakness > 0) {
      const gain = rules.tempoOnWeakness * tempoScale(b, content);
      b = { ...b, tempo: Math.min(rules.tempoMax, b.tempo + gain) };
      notes.push(`+${gain} Tempo`);
    }
  }
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
    : { ...c, hp, shield, down, statuses: down ? [] : c.statuses, lastHitBy: actor.id }));

  // Quorum: an enemy that watches one of its own fall closes ranks.
  if (down && target.side === 'enemy') {
    for (const ally of alive(b, 'enemy')) {
      const rally = content.enemies[ally.ref]?.rally;
      if (!rally) continue;
      b = log(b, `${ally.name} closes ranks.`, 'warn', { actor: ally.name });
      b = applyStatus(b, ally, { id: rally.id, turns: rally.turns }, content, ally.id);
    }
  }

  // Taking a hit is the other thing that earns it: pressure on the party is what pays for the
  // undo, so the fights that need a Rewind are the ones that can afford one.
  if (target.side === 'party' && actor.side === 'enemy' && dmg > 0 && rules.tempoOnHit > 0) {
    const gain = rules.tempoOnHit * tempoScale(b, content);
    b = { ...b, tempo: Math.min(rules.tempoMax, b.tempo + gain) };
    notes.push(`+${gain} Tempo`);
  }
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
  if (status.id === 'fear' && target.family === 'drone') {
    return log(b, `${target.name} is a drone. Fear is not something it has.`, 'warn', { target: target.name });
  }
  if ((status.id === 'bound' || status.id === 'locked') && hasStatus(target, 'charging')) {
    b = update(b, target.id, (c) => ({ ...c, statuses: c.statuses.filter((st) => st.id !== 'charging') }));
    b = log(b, `${target.name}'s wind-up is broken.`, 'tempo', { target: target.name });
  }
  let turns = status.turns;
  if (status.id === 'marked') turns += b.passives[actorId]?.markDuration ?? 0;
  if (status.id === 'bound') turns += b.passives[actorId]?.boundTurns ?? 0;
  b = update(b, target.id, (c) => ({ ...c, statuses: [...c.statuses, { ...status, turns }] }));
  const info = STATUS_INFO[status.id];
  const kind = info?.polarity === 'good' ? 'tempo' : 'warn';
  return log(b, `${target.name} — ${statusSentence(status.id, turns, content.rules)}`, kind, { target: target.name });
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
  const nerve = actor.side === 'party' ? nerveCost(content, ability) : 0;
  b = update(b, actorId, (c) => ({ ...c, threads: c.threads - ability.cost, nerve: Math.max(0, c.nerve - nerve) }));
  if (ability.pair) {
    const { partner } = pairPartner(b, actor, ability, content);
    if (partner) {
      b = update(b, partner.id, (c) => ({ ...c, statuses: [...c.statuses, { id: 'spent', turns: 2 }] }));
      b = log(b, `${partner.name} lends a hand to ${actor.name}: ${ability.name}.`, 'tempo', { actor: partner.name, ability: ability.name });
    }
  }
  if (actor.side === 'party') {
    let gain = ability.cost * rules.tempoPerThread + (ability.tempoGain ?? 0);
    if (ability.special === 'mark') gain += (rules.tempoOnMark + (b.passives[actorId]?.tempoOnMark ?? 0)) * chosen.length;
    gain *= tempoScale(b, content);
    b = { ...b, tempo: Math.min(rules.tempoMax, b.tempo + gain) };
    if (ability.damageType === 'signal') b = { ...b, usedSignal: true };
    if (nerve > 0) b = log(b, `${actor.name} spends ${nerve} Nerve (${b.combatants.find((c) => c.id === actorId)!.nerve} left).`, 'system', { actor: actor.name });
  } else if (ability.damageType === 'chronal' && !ability.entropyDelta && rules.entropyFlow.enemyChronal > 0) {
    // The enemy pulling on time frays it for everyone.
    b = bumpEntropy(b, rules.entropyFlow.enemyChronal, content);
    b = log(b, `${actor.name} pulls on time. Entropy rises to ${b.entropy}.`, 'warn', { actor: actor.name });
  }
  if (ability.entropyDelta) {
    b = { ...b, entropy: addEntropy(b, ability.entropyDelta, content) };
    b = log(b, `Entropy rises to ${b.entropy}.`, 'tempo');
  }
  if (ability.tempoDrain && actor.side === 'enemy' && b.tempo > 0) {
    const taken = Math.min(b.tempo, ability.tempoDrain);
    b = { ...b, tempo: b.tempo - taken };
    b = log(b, `${actor.name} strikes ${taken} Tempo from the record.`, 'warn', { actor: actor.name, ability: ability.name });
  }
  if (ability.special === 'charge') {
    b = log(b, `${actor.name} winds up. ${ability.description}`, 'warn', { actor: actor.name, ability: ability.name });
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
    const GOOD = GOOD_STATUSES.filter((id) => id !== 'charging');
    const taken = t ? t.statuses.filter((st) => GOOD.includes(st.id)) : [];
    if (!t || !taken.length) {
      b = log(b, `${actor.name} looks over ${t?.name ?? 'the field'} and finds nothing worth taking.`, 'warn', { actor: actor.name, ability: ability.name });
      return afterAction(b, content);
    }
    b = update(b, t.id, (c) => ({ ...c, statuses: c.statuses.filter((st) => !GOOD.includes(st.id)) }));
    b = update(b, actorId, (c) => ({ ...c, statuses: [...c.statuses, ...taken] }));
    b = log(b, `${actor.name} acquires ${taken.map((st) => statusLabel(st.id)).join(' and ')} from ${t.name}.`, 'tempo', { actor: actor.name, target: t.name, ability: ability.name });
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
      nerve: actor.nerve, maxNerve: actor.maxNerve, continuity: actor.continuity,
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
      const partner = ability.pair ? pairPartner(b, a, ability, content).partner : undefined;
      let amount = evalFormula(ability.heal, { a: a.stats, p: partner?.stats ?? a.stats, d: t.stats }) * content.rules.damageScale;
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
  if (ability.special === 'unleash') b = update(b, actorId, (c) => ({ ...c, statuses: c.statuses.filter((st) => st.id !== 'charging') }));
  if (chosen.length === 1 && chosen[0].id !== actorId) b = update(b, actorId, (c) => ({ ...c, lastTarget: chosen[0].id }));
  return afterAction(b, content);
}

function afterAction(b: BattleState, content: ContentDB): BattleState {
  b = settleEntropy(b, content);
  b = maybeSpawnEcho(b, content);
  b = checkEnd(b, content);
  if (b.phase === 'won' || b.phase === 'lost') return b;
  const actor = current(b);
  if (actor && actor.threads <= 0) return endTurn(b, actor.id, content);
  return b;
}

/** True for an item that does something to one ally in particular, so the player has to pick one. */
export function itemNeedsTarget(item: ItemDef): boolean {
  const e = item.effect;
  if (!e) return false;
  return !!e.heal || !!e.revive || !!e.slack || !!e.nerve || !!e.cure?.length || e.status?.target === 'ally';
}

/**
 * Items are free: they cost no thread, and the only limit is one a turn. What they do that
 * abilities cannot is the reason to carry them: a cure nothing else offers, Entropy going down,
 * a shield against a whole damage type.
 */
export function useItem(b: BattleState, actorId: string, item: ItemDef, targetId: string, content: ContentDB): BattleState {
  const actor = current(b);
  if (!actor || actor.id !== actorId || b.phase !== 'player') throw new Error('Cannot use item now');
  if (actor.itemUsed) throw new Error('One item a turn');
  const target = b.combatants.find((c) => c.id === targetId && c.side === 'party');
  if (!target || !item.effect) throw new Error('Invalid item target');
  if (target.down && !item.effect.revive) throw new Error(`${target.name} is down`);
  const e = item.effect;
  const cured = e.cure ? target.statuses.filter((s) => e.cure!.includes(s.id)) : [];
  if (e.cure && !cured.length && !e.heal && !e.revive) throw new Error(`${target.name} has nothing ${item.name} would clear`);
  b = { ...b, fork: null };
  b = update(b, actorId, (c) => ({ ...c, itemUsed: true }));
  b = update(b, targetId, (c) => ({
    ...c,
    down: e.revive ? false : c.down,
    hp: Math.min(c.maxHp, (e.revive && c.down ? 0 : c.hp) + Math.round((e.heal ?? 0) * content.rules.damageScale)),
    slack: Math.min(slackCap(b, c, content), c.slack + (e.slack ?? 0)),
    statuses: e.cure ? c.statuses.filter((s) => !e.cure!.includes(s.id)) : c.statuses,
  }));
  if (e.tempo) b = { ...b, tempo: Math.min(content.rules.tempoMax, b.tempo + e.tempo) };
  const notes: string[] = [];
  if (e.nerve) {
    b = update(b, targetId, (c) => ({ ...c, nerve: Math.min(c.maxNerve, c.nerve + e.nerve!) }));
    notes.push(`Nerve ${b.combatants.find((c) => c.id === targetId)!.nerve}/${target.maxNerve}`);
  }
  if (cured.length) notes.push(`${[...new Set(cured.map((s) => statusLabel(s.id)))].join(' and ')} cleared`);
  if (e.entropy) {
    const before = b.entropy;
    b = { ...b, entropy: clamp(b.entropy + e.entropy, 0, content.rules.entropyMax) };
    notes.push(`Entropy ${before} → ${b.entropy}`);
  }
  b = log(b, `${actor.name} uses ${item.name}${itemNeedsTarget(item) ? ` on ${target.name}` : ''}${notes.length ? ` (${notes.join(', ')})` : ''}.`, 'heal', { actor: actor.name, target: target.name, ability: item.name });
  if (e.status) {
    const who = e.status.target === 'party' ? alive(b, 'party') : [b.combatants.find((c) => c.id === targetId)!];
    for (const c of who) b = applyStatus(b, c, { id: e.status.id, turns: e.status.turns }, content, actorId);
  }
  return afterAction(b, content);
}

/**
 * Relay: a benched member takes the field in the acting member's place, for a thread, and
 * inherits the rest of the turn. The one leaving keeps the Resolve they left with and can come
 * back the same way. The Auditor is the case, and stays.
 */
export function relay(b: BattleState, actorId: string, incoming: Combatant, passives: Record<string, number>, content: ContentDB): BattleState {
  const cost = content.rules.relay.threadCost;
  const actor = current(b);
  if (!actor || actor.id !== actorId || b.phase !== 'player') throw new Error('Relay only on your turn');
  if (actor.side !== 'party' || actor.temporary) throw new Error('Only a party member can relay out');
  if (actor.id === 'player') throw new Error('The Auditor cannot leave the field');
  if (actor.threads < cost) throw new Error(`Relay needs ${cost} thread${cost === 1 ? '' : 's'}`);
  if (b.combatants.some((c) => c.id === incoming.id)) throw new Error(`${incoming.name} is already on the field`);
  if (incoming.hp <= 0 || incoming.down) throw new Error(`${incoming.name} is in no state to fight`);
  const fresh: Combatant = { ...incoming, threads: actor.threads - cost, slack: 0, statuses: [], itemUsed: actor.itemUsed, down: false };
  const outgoing: Combatant = { ...actor, threads: 0, slack: 0, statuses: [], itemUsed: false };
  const reserve = [...(b.reserve ?? []).filter((c) => c.id !== incoming.id), outgoing];
  let nb: BattleState = {
    ...b,
    combatants: b.combatants.map((c) => (c.id === actorId ? fresh : c)),
    order: b.order.map((id) => (id === actorId ? fresh.id : id)),
    reserve,
    passives: { ...b.passives, [fresh.id]: passives },
    fork: null,
  };
  nb = log(nb, `${actor.name} falls back and ${fresh.name} takes the field with ${fresh.threads} thread${fresh.threads === 1 ? '' : 's'}.`, 'system', { actor: actor.name, target: fresh.name, ability: 'Relay' });
  return afterAction(nb, content);
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
    reserve: [...b.reserve],
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
    nerve: 99, maxNerve: 99, continuity: 100,
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
    reserve: rp.reserve ?? b.reserve,
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
    // The preview exists to answer "what exactly does this do", so spell the status out here too.
    if (gained.length) {
      parts.push(`gains ${gained.map((st) =>
        `${statusLabel(st.id)} (${statusClause(st.id, content.rules)}) ${turnsText(st.turns)}`).join(', ')}`);
    }
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

function maybeSpawnEcho(b: BattleState, content: ContentDB): BattleState {
  if (b.echoSpawned || b.entropy < content.rules.entropyThreshold) return b;
  const party = alive(b, 'party');
  if (!party.length) return b;
  const [i, rng] = rollInt(b.rng, party.length);
  const src = party[i];
  const echo: Combatant = {
    id: `echo:${src.id}`, ref: 'echo', name: `Echo of ${src.name}`, side: 'enemy', family: 'echo', machine: false,
    stats: { ...src.stats, latency: 10 }, hp: Math.round(src.maxHp * 0.6), maxHp: Math.round(src.maxHp * 0.6),
    shield: 0, maxShield: 0, threads: 0, slack: 0, statuses: [], nerve: 0, maxNerve: 0, continuity: 100,
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

export interface EnemyPlan {
  ability: AbilityDef;
  target: Combatant | null;
}

/**
 * A roll the enemy's plan can make without touching the battle's RNG: the same board and the same
 * round give the same answer, which is what lets the card say what is coming and mean it.
 */
function planRoll(b: BattleState, me: Combatant, step: number, salt: number): number {
  return rngFloat((b.seed ^ seedFromString(`${me.id}:${b.round}:${step}:${salt}`)) | 0);
}

const GOOD_STATUSES = ['guard', 'taunt', 'wall', 'inspired', 'anchored', 'fixed', 'faraday', 'held', 'charging'];

/** Who an enemy goes for, by its personality, among the targets it may legally hit. */
export function pickTarget(b: BattleState, me: Combatant, targets: Combatant[], step: number, content: ContentDB): Combatant {
  const mode: Targeting = content.enemies[me.ref]?.targeting ?? 'opportunist';
  const byHp = [...targets].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
  if (targets.length === 1) return targets[0];
  switch (mode) {
    case 'weakest': return byHp[0];
    case 'healer': return [...targets].sort((x, y) => y.stats.signal - x.stats.signal || x.hp / x.maxHp - y.hp / y.maxHp)[0];
    case 'buffed': {
      const good = (c: Combatant) => c.statuses.filter((st) => GOOD_STATUSES.includes(st.id)).length;
      return [...targets].sort((x, y) => good(y) - good(x) || x.hp / x.maxHp - y.hp / y.maxHp)[0];
    }
    case 'auditor': return targets.find((c) => c.ref === 'player') ?? byHp[0];
    case 'revenge': return targets.find((c) => c.id === me.lastHitBy) ?? byHp[0];
    case 'spread': {
      const fresh = targets.filter((c) => c.id !== me.lastTarget);
      const pool = fresh.length ? fresh : targets;
      return pool[Math.floor(planRoll(b, me, step, 2) * pool.length) % pool.length];
    }
    default: {
      const r = planRoll(b, me, step, 2);
      return r < 0.5 ? byHp[0] : byHp[Math.floor(r * byHp.length) % byHp.length];
    }
  }
}

/**
 * What an enemy will do with its next action, given the board as it stands. The turn runs on the
 * same function, so the intent on the card is the truth unless the board changes first.
 */
export function planEnemyAction(b: BattleState, me: Combatant, step: number, threads: number, content: ContentDB): EnemyPlan | null {
  const usable = abilityOptions(b, me.id, content, threads).filter((o) => o.usable).map((o) => o.ability);
  if (!usable.length) return null;
  const withTarget = (ability: AbilityDef, target: Combatant | null): EnemyPlan => ({ ability, target });
  const allies = alive(b, 'enemy');

  // A wind-up already taken is released, whatever else is on offer.
  const unleash = usable.find((a) => a.special === 'unleash');
  if (unleash) {
    const targets = validTargets(b, me.id, unleash);
    if (targets.length) return withTarget(unleash, pickTarget(b, me, targets, step, content));
  }
  // Someone hurt gets mended before anyone gets hit.
  const heal = usable.find((a) => a.heal && (a.target === 'ally' || a.target === 'allAllies'));
  if (heal) {
    const hurt = allies.filter((c) => c.hp < c.maxHp * 0.6).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
    if (hurt.length) return withTarget(heal, heal.target === 'ally' ? hurt[0] : null);
  }
  // A buff nobody is carrying yet goes on.
  const buff = usable.find((a) => a.status && !a.damageType && (a.target === 'ally' || a.target === 'allAllies' || a.target === 'self'));
  if (buff?.status) {
    const bare = (buff.target === 'self' ? [me] : allies).filter((c) => !hasStatus(c, buff.status!.id));
    if (bare.length) return withTarget(buff, buff.target === 'ally' ? bare[0] : buff.target === 'self' ? me : null);
  }
  // A wind-up is taken most of the time it is on offer: the point of it is that you see it coming.
  const charge = usable.find((a) => a.special === 'charge');
  if (charge && !hasStatus(me, 'charging') && planRoll(b, me, step, 3) < 0.7) return withTarget(charge, me);

  const hostile = usable.filter((a) => a.target === 'enemy' || a.target === 'allEnemies').filter((a) => a.special !== 'charge');
  const pool = hostile.length ? hostile : usable.filter((a) => a.special !== 'charge' && a.special !== 'unleash');
  if (!pool.length) return null;
  const sorted = [...pool].sort((x, y) => y.cost - x.cost);
  const r = planRoll(b, me, step, 1);
  const pick = r < 0.65 ? sorted[0] : sorted[Math.floor(r * sorted.length) % sorted.length];
  const targets = validTargets(b, me.id, pick);
  if (!targets.length) return null;
  if (pick.target === 'allEnemies' || pick.target === 'allAllies') return withTarget(pick, null);
  if (pick.target === 'self') return withTarget(pick, me);
  return withTarget(pick, pickTarget(b, me, targets, step, content));
}

/** The intent shown on an enemy's card: its first action next time it acts, on this board. */
export function enemyIntent(b: BattleState, me: Combatant, content: ContentDB): EnemyPlan | null {
  if (me.down || me.side !== 'enemy') return null;
  const threads = Math.max(1, me.stats.bandwidth - (hasStatus(me, 'fear') ? 1 : 0));
  return planEnemyAction(b, me, 0, threads, content);
}

export function enemyTurn(b: BattleState, content: ContentDB): BattleState {
  const actor = current(b);
  if (!actor || actor.side !== 'enemy' || b.phase !== 'enemy') throw new Error('Not an enemy turn');
  const rewindPoint = {
    combatants: b.combatants.map((c) => ({ ...c, statuses: [...c.statuses] })),
    reserve: [...b.reserve],
    rng: b.rng, turnIndex: b.turnIndex, round: b.round, tempo: b.tempo, logLength: b.log.length,
    actorId: actor.id, description: `${actor.name}'s turn`,
  };
  b = { ...b, rewindPoint };
  let guard = 0;
  while (guard++ < 6) {
    const me = current(b);
    if (!me || me.down || me.threads <= 0 || b.phase !== 'enemy') break;
    const plan = planEnemyAction(b, me, guard - 1, me.threads, content);
    if (!plan) break;
    b = resolveAbility(b, me.id, plan.ability.id, plan.target?.id ?? null, content);
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
      reserve: rp.reserve ?? b.reserve,
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
  return { xp, currency: Math.round(xp * 0.5), items, leftBehind: [], flags, levelUps: [] };
}
