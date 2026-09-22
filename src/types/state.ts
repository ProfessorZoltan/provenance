import type { DamageType, EraId, StatBlock } from './content';

export interface StatusEffect {
  id: string;
  turns: number;
  value?: number;
}

export interface Combatant {
  id: string;
  ref: string;
  name: string;
  side: 'party' | 'enemy';
  family?: string;
  machine: boolean;
  stats: StatBlock;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  threads: number;
  slack: number;
  statuses: StatusEffect[];
  abilities: string[];
  immunities: DamageType[];
  weakness?: DamageType;
  down: boolean;
  parleyed?: boolean;
  echoOf?: string;
  perception: number;
  /** Constructs fight on after their shell breaks; bar 2 is the core. */
  bar?: number;
  /** How much of a fight this encounter is meant to be: scales Resolve, the second bar included. */
  stand?: number;
  secondBarName?: string;
  /** Art for bar 2, when the core is not the thing you have been hitting. */
  rigOverride?: string;
  /** A short-lived copy: it fights, then dissolves, and the party does not lose when it falls. */
  temporary?: boolean;
  expiresAfterRound?: number;
  /** Items are free, but one a turn: set once this combatant has used theirs. */
  itemUsed?: boolean;
  /** Who last damaged this combatant, for enemies that hold a grudge. */
  lastHitBy?: string;
  /** Who this combatant last went for, for enemies that spread their attention. */
  lastTarget?: string;
  /** Party only: the support budget carried into this fight, and its ceiling. Enemies have none. */
  nerve: number;
  maxNerve: number;
  /** Party only: how much of this person's own timeline is still theirs. Enemies stand at 100. */
  continuity: number;
  /** Party only: the level they hold, which pair techs ask about. */
  level?: number;
}

export interface LogMeta {
  actor?: string;
  target?: string;
  ability?: string;
}

export interface BattleLogEntry extends LogMeta {
  turn: number;
  text: string;
  kind: 'info' | 'hit' | 'heal' | 'tempo' | 'warn' | 'system';
}

export interface ForkPreview {
  abilityId: string;
  targetId: string;
  lines: string[];
}

export interface RewindPoint {
  combatants: Combatant[];
  rng: number;
  turnIndex: number;
  round: number;
  tempo: number;
  logLength: number;
  actorId: string;
  description: string;
  reserve?: Combatant[];
}

export interface BattleState {
  encounterId: string;
  era: EraId;
  seed: number;
  rng: number;
  combatants: Combatant[];
  /** Party members Relayed off the field this fight, keeping the Resolve they left with. */
  reserve: Combatant[];
  order: string[];
  turnIndex: number;
  round: number;
  tempo: number;
  entropy: number;
  phase: 'player' | 'enemy' | 'won' | 'lost';
  surprise: boolean;
  log: BattleLogEntry[];
  rewindsLeft: number;
  rewindPoint: RewindPoint | null;
  fork: ForkPreview | null;
  /** Collapse: a banked battle state, spent once to resume from instead of losing. */
  collapsePoint: RewindPoint | null;
  collapseUsed: boolean;
  /** Echo: an other-era self assists once per battle. */
  echoAssistUsed: boolean;
  echoSpawned: boolean;
  usedSignal: boolean;
  /** Party members whose Continuity tore when Entropy broke this fight. Applied when it ends. */
  fractures: string[];
  story: boolean;
  passives: Record<string, Record<string, number>>;
  partySync: number;
  pendingRewards: BattleRewards | null;
}

export interface BattleRewards {
  xp: number;
  currency: number;
  items: string[];
  /** Drops the bag had no room for. */
  leftBehind?: string[];
  flags: string[];
  levelUps: string[];
}

export interface CharacterState {
  id: string;
  xp: number;
  level: number;
  skillPoints: number;
  nodes: string[];
  sync: number;
  hp: number;
  recruitedAt: number;
  equipment: { weapon: string | null; gear: string | null };
  /** Support budget between beds. Missing on older saves, which means full. */
  nerve?: number;
  /** Continuity torn away for good by Entropy breaking. */
  frayed?: number;
  /** Level-up perks kept, in the order they were chosen, and picks still waiting to be made. */
  perks?: string[];
  pendingPerks?: number;
}

export interface HistoryEntry {
  order: number;
  choiceId: string;
  era: EraId;
  site: string;
}

export interface TimelineSnapshot {
  takenAt: number;
  label: string;
  history: HistoryEntry[];
}

export interface WorldState {
  baseOwnership: number;
  baseSync: number;
  history: HistoryEntry[];
  snapshots: TimelineSnapshot[];
  visitedEras: EraId[];
}

export interface DerivedWorld {
  ownership: number;
  sync: number;
  flags: string[];
  continuity: Record<string, number>;
  activeChoices: HistoryEntry[];
  ending: string;
}

export type QuestStatus = 'available' | 'active' | 'readyToTurnIn' | 'complete';

export interface ScanState {
  encounterId: string;
  surprise: boolean;
  hints: string[];
  ambushChance: number;
}

export interface DialogueState {
  id: string;
  index: number;
  returnTo: Screen;
}

export type Screen =
  | { id: 'title' }
  | { id: 'intro'; slide: number }
  | { id: 'newGame' }
  | { id: 'hub' }
  | { id: 'map' }
  | { id: 'timeJump' }
  | { id: 'scan' }
  | { id: 'battle' }
  | { id: 'battleResult' }
  | { id: 'dialogue' }
  | { id: 'tech'; character: string }
  | { id: 'perks'; character?: string }
  | { id: 'party' }
  | { id: 'shop' }
  | { id: 'inventory' }
  | { id: 'save' }
  | { id: 'manual' }
  | { id: 'log' }
  | { id: 'room'; room: string }
  | { id: 'ending' }
  | { id: 'roster' }
  | { id: 'gameOver' }
  | { id: 'settings' };

export interface Settings {
  reducedMotion: boolean;
  musicVolume: number;
  sfxVolume: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  screen: Screen;
  started: boolean;
  party: Record<string, CharacterState>;
  activeParty: string[];
  world: WorldState;
  location: string;
  era: EraId;
  inventory: { currency: Record<string, number>; items: Record<string, number>; relics: string[] };
  quests: Record<string, QuestStatus>;
  flags: string[];
  battle: BattleState | null;
  scan: ScanState | null;
  dialogue: DialogueState | null;
  journal: string[];
  /** Case log entry ids, in the order the Auditor learned them, and how many have been read. */
  log: string[];
  logRead: number;
  map: { x: number; y: number };
  back: Screen;
  battleReturn: 'map' | 'hub';
  settings: Settings;
  counters: { storyFights: number; randomFights: number; surprisesCancelled: number; turns: number };
  /** Field camps left in this era: a half rest, and only so many before a proper bed is needed. */
  camps: number;
  /** Entropy carried from fight to fight. Beds and camps let it out; nothing else does. */
  entropy: number;
}
