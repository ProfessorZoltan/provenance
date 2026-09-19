import type { ContentDB, DialogueLine, EraId, LocationDef, LocationVariant } from '../types/content';
import type { CharacterState, GameState, Screen } from '../types/state';
import type { Action } from './actions';
import { createBattle, endTurn, enemyTurn, fork, resolveAbility, rewind, useItem } from './battle/battle';
import { evalAll } from './conditions';
import { buildScan, conditionContext, rollEncounter } from './encounter';
import { seedFromString } from './rng';
import { levelForXp, loadout, maxHp } from './stats';
import { unlockNode } from './tech';
import { applyChoice, choicesOverwrittenBy, clamp, deriveWorld, markVisited } from './timeline';

export const STATE_VERSION = 1;

const CURRENCY: Record<EraId, string> = {
  '2031': 'credits', '2064': 'credits', '2148': 'barter tokens', '2312': 'allocation points',
};

export function currencyFor(era: EraId): string {
  return CURRENCY[era];
}

export function initialState(): GameState {
  return {
    version: STATE_VERSION,
    seed: 0,
    rng: 0,
    screen: { id: 'title' },
    started: false,
    party: {},
    activeParty: [],
    world: { baseOwnership: -60, baseSync: 0, history: [], snapshots: [], visitedEras: ['2312'] },
    location: 'kell_2312',
    era: '2312',
    inventory: { currency: { 'allocation points': 60, 'barter tokens': 0, credits: 0 }, items: { ration: 2 }, relics: [] },
    quests: {},
    flags: [],
    battle: null,
    scan: null,
    dialogue: null,
    journal: [],
    map: { x: 800, y: 250 },
    back: { id: 'hub' },
    battleReturn: 'hub',
    settings: { reducedMotion: false, musicVolume: 0.7, sfxVolume: 0.8 },
    counters: { storyFights: 0, randomFights: 0, surprisesCancelled: 0, turns: 0 },
  };
}

function newCharacter(content: ContentDB, id: string, sync: number, recruitedAt: number, xp = 0): CharacterState {
  const level = levelForXp(xp, content.rules.xpPerLevel);
  const cs: CharacterState = {
    id, xp, level, skillPoints: 1 + level, nodes: [], sync, hp: 0, recruitedAt,
    equipment: { weapon: null, gear: null },
  };
  cs.hp = maxHp(content, content.characters[id], cs);
  return cs;
}

/** A recruit arrives near the party's level rather than at 1, so they are worth fielding. */
function recruitXp(content: ContentDB, state: GameState): number {
  const xps = Object.values(state.party).map((c) => c.xp);
  if (!xps.length) return 0;
  return Math.round(xps.reduce((a, b) => a + b, 0) / xps.length);
}

export function isActive(state: GameState, id: string): boolean {
  return state.activeParty.includes(id);
}

/**
 * Anyone whose leave condition now holds walks out. The Auditor never leaves, and the last
 * standing member never leaves, so a run cannot be stranded without a party.
 */
function settleDepartures(content: ContentDB, state: GameState): GameState {
  for (const id of Object.keys(state.party)) {
    if (id === 'player') continue;
    const def = content.characters[id];
    if (!def?.leavesIf) continue;
    if (!evalAll([def.leavesIf], conditionContext(content, state))) continue;
    if (Object.keys(state.party).length <= 1) continue;
    const party = { ...state.party };
    delete party[id];
    state = {
      ...state,
      party,
      activeParty: state.activeParty.filter((a) => a !== id),
      flags: state.flags.includes(`left:${id}`) ? state.flags : [...state.flags, `left:${id}`],
    };
    state = journal(state, `${def.name} has left the party. ${def.leaveLine ?? ''}`.trim());
  }
  return state;
}

export function activeVariant(content: ContentDB, state: GameState, loc: LocationDef): LocationVariant | null {
  const ctx = conditionContext(content, state);
  for (const v of loc.variants ?? []) if (evalAll(v.when, ctx)) return v;
  return null;
}

/** Which dialogue an NPC opens right now. Quest givers route by quest status. */
export function npcDialogue(content: ContentDB, state: GameState, npcId: string): string {
  const quest = Object.values(content.quests).find((q) => q.giver === npcId);
  if (quest) {
    const status = state.quests[quest.id] ?? 'available';
    if (status === 'available') return quest.dialogue.offer;
    if (status === 'active') return quest.dialogue.inProgress;
    if (status === 'readyToTurnIn') return quest.dialogue.complete;
    if (content.dialogues[`${npcId}_after`]) return `${npcId}_after`;
  }
  return npcId;
}

export function npcName(content: ContentDB, npcId: string): string {
  return NPC_NAMES[npcId] ?? content.characters[npcId]?.name ?? npcId.replace(/_/g, ' ');
}

export const NPC_NAMES: Record<string, string> = {
  // Dialogue ids used as NPCs on a location, and the speaker ids used inside lines.
  wren_hub: 'Sister Wren', dax_hub: 'Dax Okonkwo', dax_2148: 'Dax Okonkwo', captain_ade: 'Captain Ade',
  wren_2031: 'Sister Wren', dax_2031: 'Dax Okonkwo', wren_tempo_lesson: 'Sister Wren',
  pell: 'Old Pell', ansel: 'Ansel', ansel_quiet: 'Ansel', militia_captain: 'Militia Captain',
  ilse_kell: 'Mother Ilse Kell', ilse: 'Mother Ilse Kell', vance: 'Aurelia Vance',
  salvager_ruth: 'Ruth', ruth: 'Ruth', trader_sable: 'Sable', sable: 'Sable',
  ilo9: 'ILO-9', ilo9_hub: 'ILO-9', ilo9_bound_dlg: 'ILO-9, bound',
  wren: 'Sister Wren', dax: 'Dax Okonkwo', ade: 'Captain Ade', militia: 'Militia Captain', narrator: '', player: 'The Auditor',
};

function addFlags(state: GameState, flags: string[]): GameState {
  const set = new Set(state.flags);
  for (const f of flags) set.add(f);
  return { ...state, flags: [...set] };
}

function journal(state: GameState, text: string): GameState {
  return { ...state, journal: [...state.journal.slice(-49), text] };
}

function shiftSync(state: GameState, id: string, delta: number): GameState {
  const cs = state.party[id];
  if (!cs || !delta) return state;
  return { ...state, party: { ...state.party, [id]: { ...cs, sync: clamp(cs.sync + delta, -100, 100) } } };
}

// ---------- dialogue ----------

function lineVisible(content: ContentDB, state: GameState, line: DialogueLine): boolean {
  return evalAll(line.conditions, conditionContext(content, state));
}

function applyLine(state: GameState, line: DialogueLine): GameState {
  if (line.setFlags) state = addFlags(state, line.setFlags);
  if (line.syncDelta) state = shiftSync(state, 'player', line.syncDelta);
  return state;
}

function startDialogue(content: ContentDB, state: GameState, id: string, returnTo: Screen): GameState {
  const d = content.dialogues[id];
  if (!d) throw new Error(`Unknown dialogue ${id}`);
  const idx = d.lines.findIndex((l) => lineVisible(content, state, l));
  if (idx < 0) return { ...state, dialogue: null, screen: returnTo };
  state = { ...state, dialogue: { id, index: idx, returnTo }, screen: { id: 'dialogue' } };
  return applyLine(state, d.lines[idx]);
}

function runAction(content: ContentDB, state: GameState, action: string, returnTo: Screen): GameState {
  const [kind, a, b] = action.split(':');
  switch (kind) {
    case 'battle':
      return startEncounter(content, { ...state, dialogue: null, screen: returnTo }, a, undefined, 'hub');
    case 'quest':
      if (a === 'accept') return reduce(content, state, { type: 'QUEST_ACCEPT', quest: b });
      if (a === 'complete') return reduce(content, state, { type: 'QUEST_COMPLETE', quest: b });
      throw new Error(`Unknown quest action ${action}`);
    case 'recruit':
      return reduce(content, state, { type: 'RECRUIT', character: a });
    default:
      throw new Error(`Unknown dialogue action ${action}`);
  }
}

function dialogueNext(content: ContentDB, state: GameState): GameState {
  const dlg = state.dialogue;
  if (!dlg) return state;
  const d = content.dialogues[dlg.id];
  const line = d.lines[dlg.index];
  if (line.action) {
    state = runAction(content, state, line.action, dlg.returnTo);
    if (state.screen.id !== 'dialogue') return state;
  }
  if (line.next) return startDialogue(content, state, line.next, dlg.returnTo);
  for (let i = dlg.index + 1; i < d.lines.length; i++) {
    if (lineVisible(content, state, d.lines[i])) {
      state = { ...state, dialogue: { ...dlg, index: i } };
      return applyLine(state, d.lines[i]);
    }
  }
  return { ...state, dialogue: null, screen: dlg.returnTo };
}

// ---------- travel ----------

export function mapFor(content: ContentDB, era: EraId) {
  return Object.values(content.maps).find((m) => m.era === era) ?? null;
}

function arrive(content: ContentDB, state: GameState, locationId: string): GameState {
  const loc = content.locations[locationId];
  if (!loc) throw new Error(`Unknown location ${locationId}`);
  const node = mapFor(content, loc.era)?.nodes.find((n) => n.location === locationId);
  const map = node ? { x: node.x, y: node.y + node.radius + 24 } : state.map;
  state = { ...state, location: locationId, era: loc.era, screen: { id: 'hub' }, scan: null, map, back: { id: 'hub' } };
  const variant = activeVariant(content, state, loc);
  if (variant?.storyDialogue && !state.flags.includes(`seen:${variant.storyDialogue}`)) {
    state = addFlags(state, [`seen:${variant.storyDialogue}`]);
    return startDialogue(content, state, variant.storyDialogue, { id: 'hub' });
  }
  if (loc.storyDialogue && !state.flags.includes(`seen:${loc.storyDialogue}`)) {
    state = addFlags(state, [`seen:${loc.storyDialogue}`]);
    return startDialogue(content, state, loc.storyDialogue, { id: 'hub' });
  }
  return state;
}

// ---------- encounters ----------

function startEncounter(content: ContentDB, state: GameState, encounterId: string, surprise: boolean | undefined, from?: 'map' | 'hub'): GameState {
  const enc = content.encounters[encounterId];
  if (!enc) throw new Error(`Unknown encounter ${encounterId}`);
  const s = surprise ?? enc.surprise === 'always';
  const battle = createBattle(content, state, encounterId, s);
  return { ...state, battle, scan: null, screen: { id: 'battle' }, rng: battle.rng, battleReturn: from ?? state.battleReturn };
}

function finishBattle(content: ContentDB, state: GameState): GameState {
  const b = state.battle;
  if (!b) return state;
  // Persist Resolve back onto the party.
  let party = { ...state.party };
  for (const c of b.combatants) {
    if (c.side !== 'party' || !party[c.id]) continue;
    party[c.id] = { ...party[c.id], hp: c.hp };
  }
  state = { ...state, party, rng: b.rng };

  if (b.phase === 'lost') {
    return { ...state, battle: null, screen: { id: 'gameOver' } };
  }
  const r = b.pendingRewards;
  const enc = content.encounters[b.encounterId];
  const levelUps: string[] = [];
  if (r) {
    party = { ...state.party };
    const share = content.rules.benchedXpShare;
    for (const id of Object.keys(party)) {
      const cs = party[id];
      if (!cs) continue;
      const gain = state.activeParty.includes(id) ? r.xp : Math.round(r.xp * share);
      const xp = cs.xp + gain;
      const level = levelForXp(xp, content.rules.xpPerLevel);
      let next = { ...cs, xp };
      if (level > cs.level) {
        const before = maxHp(content, content.characters[id], cs);
        next = { ...next, level, skillPoints: cs.skillPoints + (level - cs.level) };
        const after = maxHp(content, content.characters[id], next);
        next.hp = Math.min(after, next.hp + (after - before));
        if (state.activeParty.includes(id)) levelUps.push(`${content.characters[id].shortName} reaches level ${level}`);
      }
      party[id] = next;
    }
    const cur = currencyFor(b.era);
    const items = { ...state.inventory.items };
    let relics = [...state.inventory.relics];
    for (const it of r.items) {
      const def = content.items[it];
      if (def?.kind === 'relic') { if (relics.length < content.rules.relicCap) relics = [...relics, it]; }
      else items[it] = (items[it] ?? 0) + 1;
    }
    state = {
      ...state,
      party,
      inventory: { ...state.inventory, items, relics, currency: { ...state.inventory.currency, [cur]: (state.inventory.currency[cur] ?? 0) + r.currency } },
      counters: { ...state.counters, storyFights: state.counters.storyFights + (b.story ? 1 : 0), randomFights: state.counters.randomFights + (b.story ? 0 : 1), turns: state.counters.turns + b.round },
    };
    state = addFlags(state, r.flags);
    if (b.surprise) state = addFlags(state, ['survivedSurprise']);
    // Quest objectives.
    for (const [qid, status] of Object.entries(state.quests)) {
      const q = content.quests[qid];
      if (q && status === 'active' && q.objectiveEncounter === b.encounterId) state = { ...state, quests: { ...state.quests, [qid]: 'readyToTurnIn' } };
    }
    state = { ...state, battle: { ...b, pendingRewards: { ...r, levelUps } } };
  }
  void enc;
  return { ...state, screen: { id: 'battleResult' } };
}

// ---------- reducer ----------

export function createReducer(content: ContentDB) {
  return (state: GameState, action: Action): GameState => reduce(content, state, action);
}

function reduce(content: ContentDB, state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'NEW_GAME': {
      const base = initialState();
      const seed = action.seed || seedFromString(String(Date.now()));
      const sync = action.lean === 'cinder' ? -30 : action.lean === 'choir' ? 30 : 0;
      const party = {
        player: newCharacter(content, 'player', sync, 0),
        wren: newCharacter(content, 'wren', content.characters.wren.baseStats.sync, 0),
        dax: newCharacter(content, 'dax', content.characters.dax.baseStats.sync, 0),
      };
      let s: GameState = { ...base, seed, rng: seed, started: true, party, activeParty: ['player', 'wren', 'dax'] };
      s = addFlags(s, [`lean:${action.lean}`]);
      s = journal(s, 'Fled the Allocation Office. Kell Monastery, 2312.');
      return arrive(content, s, 'kell_2312');
    }
    case 'LOAD_STATE': {
      const base = initialState();
      const s: GameState = { ...base, ...action.state, map: action.state.map ?? base.map, back: { id: 'hub' }, battleReturn: action.state.battleReturn ?? 'hub' };
      const live = s.battle && s.battle.phase !== 'won' && s.battle.phase !== 'lost' ? s.battle : null;
      return { ...s, battle: live, scan: null, screen: live ? { id: 'battle' } : s.dialogue ? { id: 'dialogue' } : { id: 'hub' } };
    }
    case 'SET_SCREEN': {
      // Leaving the result screen discards the finished battle.
      const battle = state.screen.id === 'battleResult' && action.screen.id !== 'battleResult' ? null : state.battle;
      // Overlay screens remember whether they were opened from the map or from inside a location.
      const overlay = ['tech', 'party', 'inventory', 'save', 'settings', 'shop', 'manual', 'roster'].includes(action.screen.id);
      const back = overlay && (state.screen.id === 'hub' || state.screen.id === 'map') ? state.screen : state.back;
      return { ...state, screen: action.screen, battle, back };
    }
    case 'SET_MAP_POS':
      return { ...state, map: { x: action.x, y: action.y } };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'START_DIALOGUE':
      return startDialogue(content, state, action.id, action.returnTo ?? state.screen);
    case 'DIALOGUE_ADVANCE': {
      const dlg = state.dialogue;
      if (!dlg) return state;
      const line = content.dialogues[dlg.id].lines[dlg.index];
      if (line.choices && line.choices.length) return state;
      return dialogueNext(content, state);
    }
    case 'DIALOGUE_CHOOSE': {
      const dlg = state.dialogue;
      if (!dlg) return state;
      const line = content.dialogues[dlg.id].lines[dlg.index];
      const visible = (line.choices ?? []).filter((c) => evalAll(c.conditions, conditionContext(content, state)));
      const choice = visible[action.index];
      if (!choice) throw new Error('No such choice');
      if (choice.setFlags) state = addFlags(state, choice.setFlags);
      if (choice.syncDelta) state = shiftSync(state, 'player', choice.syncDelta);
      if (choice.timelineChoice) state = reduce(content, state, { type: 'TIMELINE_CHOICE', choice: choice.timelineChoice });
      if (choice.action) state = runAction(content, state, choice.action, dlg.returnTo);
      if (state.screen.id !== 'dialogue') return state;
      if (choice.next) return startDialogue(content, state, choice.next, dlg.returnTo);
      // Fall through to the next visible line after the choice line.
      const d = content.dialogues[dlg.id];
      for (let i = dlg.index + 1; i < d.lines.length; i++) {
        if (lineVisible(content, state, d.lines[i])) return applyLine({ ...state, dialogue: { ...dlg, index: i } }, d.lines[i]);
      }
      return { ...state, dialogue: null, screen: dlg.returnTo };
    }

    case 'TRAVEL': {
      const target = content.locations[action.location];
      if (!target || target.era !== state.era) throw new Error('No road there');
      const map = mapFor(content, state.era);
      if (!map?.nodes.some((n) => n.location === action.location)) throw new Error('Not on this map');
      return arrive(content, state, action.location);
    }
    case 'TIME_JUMP': {
      const loc = content.locations[state.location];
      if (loc.kind !== 'deepSite') throw new Error('Time travel only at a Deep Site');
      if (!loc.timeLinks.includes(action.era)) throw new Error(`${loc.name} does not reach ${action.era}`);
      const target = Object.values(content.locations).find((l) => l.kind === 'deepSite' && l.site === loc.site && l.era === action.era);
      if (!target) throw new Error(`No ${loc.site} in ${action.era}`);
      state = { ...state, world: markVisited(state.world, action.era) };
      state = journal(state, `Jumped to ${action.era} at ${target.name}.`);
      return arrive(content, state, target.id);
    }
    case 'EXPLORE': {
      const rolled = rollEncounter(content, state, action.encounters);
      if (!rolled) throw new Error('Nothing to find here');
      state = { ...state, rng: rolled.rng, battleReturn: action.encounters ? 'map' : 'hub' };
      if (rolled.cancelledBy) {
        const loc = content.locations[state.location];
        state = addFlags(state, [`surpriseCancelled:${loc.site}:${loc.era}`]);
        state = { ...state, counters: { ...state.counters, surprisesCancelled: state.counters.surprisesCancelled + 1 } };
        state = journal(state, `${content.characters[rolled.cancelledBy].shortName} spotted the ambush first and took the hit alone.`);
      }
      if (rolled.surprise) return startEncounter(content, state, rolled.encounterId, true);
      return { ...state, scan: buildScan(content, state, rolled.encounterId, false), screen: { id: 'scan' } };
    }
    case 'SCAN_FIGHT': {
      if (!state.scan) return state;
      return startEncounter(content, state, state.scan.encounterId, false);
    }
    case 'SCAN_SKIP':
      // No penalty, no counter, no reinforcements later.
      return { ...state, scan: null, screen: { id: state.battleReturn } };
    case 'START_ENCOUNTER':
      return startEncounter(content, state, action.encounterId, action.surprise, action.from);

    case 'BATTLE_ABILITY': {
      if (!state.battle) throw new Error('No battle');
      const b = resolveAbility(state.battle, action.actor, action.ability, action.target, content);
      return { ...state, battle: b };
    }
    case 'BATTLE_ITEM': {
      if (!state.battle) throw new Error('No battle');
      const def = content.items[action.item];
      if (!def || (state.inventory.items[action.item] ?? 0) <= 0) throw new Error('No such item');
      const b = useItem(state.battle, action.actor, def, action.target, content);
      const items = { ...state.inventory.items, [action.item]: state.inventory.items[action.item] - 1 };
      return { ...state, battle: b, inventory: { ...state.inventory, items } };
    }
    case 'BATTLE_END_TURN':
      if (!state.battle) throw new Error('No battle');
      return { ...state, battle: endTurn(state.battle, action.actor, content) };
    case 'BATTLE_REWIND':
      if (!state.battle) throw new Error('No battle');
      return { ...state, battle: rewind(state.battle, content) };
    case 'BATTLE_FORK':
      if (!state.battle) throw new Error('No battle');
      return { ...state, battle: fork(state.battle, action.actor, action.ability, action.target, content) };
    case 'BATTLE_FORK_DISCARD':
      // The Tempo is already spent: looking is what it bought.
      if (!state.battle) throw new Error('No battle');
      return { ...state, battle: { ...state.battle, fork: null } };
    case 'BATTLE_ENEMY_ACT':
      if (!state.battle) throw new Error('No battle');
      return { ...state, battle: enemyTurn(state.battle, content) };
    case 'BATTLE_FINISH': {
      const s = finishBattle(content, state);
      return s.screen.id === 'battleResult' ? s : s;
    }
    case 'GAME_OVER_RETURN': {
      // Wren drags everyone back to the Deep Site at a quarter Resolve. Nothing else is lost.
      const party = { ...state.party };
      for (const id of state.activeParty) {
        const cs = party[id];
        if (cs) party[id] = { ...cs, hp: Math.max(1, Math.round(maxHp(content, content.characters[id], cs) * 0.25)) };
      }
      const loc = content.locations[state.location];
      const site = loc.kind === 'deepSite' ? loc.id : Object.values(content.locations).find((l) => l.kind === 'deepSite' && l.site === loc.site && l.era === loc.era)?.id ?? loc.id;
      return arrive(content, { ...state, party, battle: null }, site);
    }
    case 'REST': {
      const party = { ...state.party };
      for (const id of state.activeParty) {
        const cs = party[id];
        if (cs) party[id] = { ...cs, hp: maxHp(content, content.characters[id], cs) };
      }
      return { ...state, party };
    }

    case 'SET_ACTIVE_PARTY': {
      const roster = Object.keys(state.party);
      const next = action.members.filter((id) => roster.includes(id));
      if (!next.includes('player')) throw new Error('The Auditor cannot be benched');
      if (next.length === 0) throw new Error('Someone has to go');
      if (next.length > content.rules.activePartyMax) throw new Error(`At most ${content.rules.activePartyMax} can be active`);
      if (new Set(next).size !== next.length) throw new Error('Duplicate member');
      if (state.battle) throw new Error('Not in the middle of a fight');
      return { ...state, activeParty: next };
    }
    case 'EQUIP': {
      const cs = state.party[action.character];
      const def = content.items[action.item];
      if (!cs) throw new Error('Unknown character');
      if (!def || def.kind !== 'gear' || !def.slot) throw new Error('That is not equipment');
      if (def.onlyFor && !def.onlyFor.includes(cs.id)) throw new Error(`${def.name} is not for ${content.characters[cs.id].shortName}`);
      if ((state.inventory.items[action.item] ?? 0) <= 0) throw new Error('You do not carry that');
      const items = { ...state.inventory.items, [action.item]: state.inventory.items[action.item] - 1 };
      const previous = cs.equipment[def.slot];
      if (previous) items[previous] = (items[previous] ?? 0) + 1;
      const before = maxHp(content, content.characters[cs.id], cs);
      const next: CharacterState = { ...cs, equipment: { ...cs.equipment, [def.slot]: action.item } };
      const after = maxHp(content, content.characters[cs.id], next);
      next.hp = Math.max(1, Math.min(after, next.hp + (after - before)));
      return { ...state, party: { ...state.party, [cs.id]: next }, inventory: { ...state.inventory, items } };
    }
    case 'UNEQUIP': {
      const cs = state.party[action.character];
      if (!cs) throw new Error('Unknown character');
      const held = cs.equipment[action.slot];
      if (!held) throw new Error('Nothing in that slot');
      const before = maxHp(content, content.characters[cs.id], cs);
      const next: CharacterState = { ...cs, equipment: { ...cs.equipment, [action.slot]: null } };
      const after = maxHp(content, content.characters[cs.id], next);
      next.hp = Math.max(1, Math.min(after, next.hp));
      void before;
      return {
        ...state,
        party: { ...state.party, [cs.id]: next },
        inventory: { ...state.inventory, items: { ...state.inventory.items, [held]: (state.inventory.items[held] ?? 0) + 1 } },
      };
    }
    case 'RECRUIT': {
      const def = content.characters[action.character];
      if (!def) throw new Error(`Unknown character ${action.character}`);
      if (state.party[action.character]) return state;
      const cs = newCharacter(content, action.character, def.baseStats.sync, state.world.history.length, recruitXp(content, state));
      let next: GameState = { ...state, party: { ...state.party, [action.character]: cs } };
      if (next.activeParty.length < content.rules.activePartyMax) next = { ...next, activeParty: [...next.activeParty, action.character] };
      next = addFlags(next, [`recruited:${action.character}`]);
      next = journal(next, `${def.name} joined the party. ${def.joinLine ?? ''}`.trim());
      return settleDepartures(content, next);
    }
    case 'UNLOCK_NODE': {
      const cs = state.party[action.character];
      if (!cs) throw new Error('Unknown character');
      const next = unlockNode(content, cs, action.node, conditionContext(content, state));
      // Max Resolve may have grown; keep the same missing amount.
      const before = maxHp(content, content.characters[cs.id], cs);
      const after = maxHp(content, content.characters[cs.id], next);
      next.hp = Math.min(after, next.hp + Math.max(0, after - before));
      return { ...state, party: { ...state.party, [action.character]: next } };
    }

    case 'SHOP_BUY': {
      const loc = content.locations[state.location];
      const shopId = activeVariant(content, state, loc)?.shop ?? loc.shop;
      const shop = shopId ? content.shops[shopId] : null;
      const entry = shop?.stock.find((s) => s.item === action.item);
      if (!shop || !entry) throw new Error('Not for sale here');
      if (entry.when && !evalAll(entry.when, conditionContext(content, state))) throw new Error('Not in stock');
      const have = state.inventory.currency[shop.currency] ?? 0;
      if (have < entry.price) throw new Error(`Not enough ${shop.currency}`);
      const def = content.items[action.item];
      const inv = { ...state.inventory, currency: { ...state.inventory.currency, [shop.currency]: have - entry.price } };
      if (def.kind === 'relic') {
        if (inv.relics.length >= content.rules.relicCap) throw new Error('Relic carry space is full');
        inv.relics = [...inv.relics, action.item];
      } else {
        inv.items = { ...inv.items, [action.item]: (inv.items[action.item] ?? 0) + 1 };
      }
      return { ...state, inventory: inv };
    }
    case 'SHOP_SELL_RELIC': {
      const loc = content.locations[state.location];
      const shopId = activeVariant(content, state, loc)?.shop ?? loc.shop;
      const shop = shopId ? content.shops[shopId] : null;
      if (!shop) throw new Error('No shop here');
      const idx = state.inventory.relics.indexOf(action.item);
      if (idx < 0) throw new Error('You do not carry that');
      const def = content.items[action.item];
      const relics = [...state.inventory.relics];
      relics.splice(idx, 1);
      const cur = shop.currency;
      return { ...state, inventory: { ...state.inventory, relics, currency: { ...state.inventory.currency, [cur]: (state.inventory.currency[cur] ?? 0) + (def.relicValue ?? 0) } } };
    }
    case 'USE_ITEM': {
      const def = content.items[action.item];
      const count = state.inventory.items[action.item] ?? 0;
      if (!def?.effect || count <= 0) throw new Error('Cannot use that');
      const cs = state.party[action.target];
      if (!cs) throw new Error('No such ally');
      const cap = maxHp(content, content.characters[cs.id], cs);
      if (cs.hp <= 0 && !def.effect.revive) throw new Error(`${content.characters[cs.id].shortName} is down`);
      const hp = Math.min(cap, cs.hp + (def.effect.heal ?? 0));
      return { ...state, party: { ...state.party, [cs.id]: { ...cs, hp } }, inventory: { ...state.inventory, items: { ...state.inventory.items, [action.item]: count - 1 } } };
    }

    case 'QUEST_ACCEPT': {
      const q = content.quests[action.quest];
      if (!q) throw new Error('Unknown quest');
      if ((state.quests[q.id] ?? 'available') !== 'available') return state;
      state = journal(state, `Quest accepted: ${q.name}.`);
      return { ...state, quests: { ...state.quests, [q.id]: 'active' } };
    }
    case 'QUEST_COMPLETE': {
      const q = content.quests[action.quest];
      if (!q) throw new Error('Unknown quest');
      if (state.quests[q.id] !== 'readyToTurnIn') throw new Error('Quest is not ready to turn in');
      const party = { ...state.party };
      for (const id of Object.keys(party)) {
        const cs = party[id];
        if (!cs) continue;
        const active = state.activeParty.includes(id);
        const xp = cs.xp + Math.round(q.rewards.xp * (active ? 1 : content.rules.benchedXpShare));
        const level = levelForXp(xp, content.rules.xpPerLevel);
        party[id] = { ...cs, xp, level, skillPoints: cs.skillPoints + (active ? q.rewards.skillPoints : 0) + (level - cs.level) };
      }
      const cur = currencyFor(content.locations[q.location].era);
      const inv = { ...state.inventory, currency: { ...state.inventory.currency, [cur]: (state.inventory.currency[cur] ?? 0) + q.rewards.currency } };
      for (const it of q.rewards.items) {
        const def = content.items[it];
        if (def.kind === 'relic') { if (inv.relics.length < content.rules.relicCap) inv.relics = [...inv.relics, it]; }
        else inv.items = { ...inv.items, [it]: (inv.items[it] ?? 0) + 1 };
      }
      state = addFlags(state, q.rewards.flags);
      state = journal(state, `Quest complete: ${q.name}.`);
      return { ...state, party, inventory: inv, quests: { ...state.quests, [q.id]: 'complete' } };
    }

    case 'TIMELINE_CHOICE': {
      const c = content.timelineChoices[action.choice];
      if (!c) throw new Error('Unknown timeline choice');
      const world = applyChoice(content, state.world, action.choice, state.counters.turns);
      state = { ...state, world };
      const derived = deriveWorld(content, world, state.party);
      state = journal(state, `Timeline: ${c.name}. ${c.summary} (${derived.ending} is where this is heading.)`);
      const wiped = choicesOverwrittenBy(state.world.history.slice(0, -1), c.era, c.site);
      for (const w of wiped) {
        const old = content.timelineChoices[w.choiceId];
        if (old) state = journal(state, `${old.name} never happened: ${c.era} now runs differently from ${w.era} onward.`);
      }
      return settleDepartures(content, state);
    }
    default:
      return state;
  }
}
