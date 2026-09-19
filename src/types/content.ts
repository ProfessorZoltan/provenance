// Content schemas. Every file under /content is validated against these shapes at load time.

export type EraId = '2031' | '2064' | '2148' | '2312';
export type Lean = 'cinder' | 'choir' | 'commons' | 'chosen' | 'unknown';
export type DamageType = 'kinetic' | 'thermal' | 'signal' | 'chronal';
export type EnemyFamily = 'drone' | 'warden' | 'construct' | 'echo';
export type TrunkKey = 'breaker' | 'weaver' | 'anchor' | 'fork';
export type EquipSlot = 'weapon' | 'gear';
export type NodeType = 'standard' | 'condition' | 'era' | 'contradiction';

export interface StatBlock {
  resolve: number;
  bandwidth: number;
  latency: number;
  signal: number;
  noise: number;
  grit: number;
  sync: number;
  continuity: number;
}

export type StatName = keyof StatBlock;

export interface TrunkDef {
  key: TrunkKey;
  name: string;
  flavor: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  shortName: string;
  lean: Lean;
  homeEra: EraId;
  /** Conditions that make this member walk away, all of which must hold. Evaluated whenever the world moves. */
  leavesIf?: string[];
  leaveLine?: string;
  joinLine?: string;
  role: string;
  signature: string;
  baseStats: StatBlock;
  rig: string;
  accent: string;
  trunks: TrunkDef[];
  abilities: string[];
  tags: string[];
  motif: number[];
  bio: string;
}

export type NodeEffect =
  | { kind: 'stat'; stat: StatName; delta: number }
  | { kind: 'ability'; ability: string }
  | { kind: 'flag'; flag: string }
  | { kind: 'passive'; passive: string; value?: number };

export interface NodeDef {
  id: string;
  character: string;
  trunk: TrunkKey;
  name: string;
  type: NodeType;
  cost: number;
  requires: string[];
  excludes: string[];
  condition?: string;
  conditionHint?: string;
  era?: EraId;
  effects: NodeEffect[];
  description: string;
  row: number;
  col: number;
}

export type TargetKind = 'enemy' | 'ally' | 'self' | 'allEnemies' | 'allAllies';

export interface AbilityDef {
  id: string;
  name: string;
  cost: number;
  damageType?: DamageType;
  target: TargetKind;
  formula?: string;
  heal?: string;
  tempoCost: number;
  entropyDelta: number;
  tempoGain?: number;
  status?: { id: string; turns: number; onTarget?: boolean };
  special?: string;
  requiresMachine?: boolean;
  /** For abilities that put a short-lived copy of the caster on the field. */
  spawn?: { name: string; hpFactor: number; turns: number; abilities: string[] };
  description: string;
  prompt?: string;
}

/** A Construct's second health bar: break the shell and the core keeps fighting, differently. */
export interface SecondBar {
  name: string;
  resolve: number;
  abilities?: string[];
  immunities?: DamageType[];
  weakness?: DamageType;
  /** Catalog art for the second bar, when the core looks nothing like the shell. */
  rig?: string;
  shield?: number;
  flavor: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  family: EnemyFamily;
  era: EraId;
  machine: boolean;
  stats: StatBlock;
  shield: number;
  secondBar?: SecondBar;
  abilities: string[];
  immunities: DamageType[];
  perception: number;
  rig: string;
  weakness?: DamageType;
  xp: number;
  drops: { item: string; chance: number }[];
  flavor: string;
}

export interface EncounterEnemy {
  enemy: string;
  count: number;
}

export interface ScanHint {
  when: string;
  text: string;
}

export interface EncounterDef {
  id: string;
  name: string;
  era: EraId;
  location: string;
  enemies: EncounterEnemy[];
  surprise: 'never' | 'roll' | 'always';
  story: boolean;
  flavor: string;
  scanHints: ScanHint[];
  rewardFlags?: string[];
  /** Winning this is the end of the run: the result screen hands off to the epilogue. */
  endsRun?: boolean;
  music: string;
}

export interface BackgroundLayer {
  id: string;
  drift: number;
  art: string;
  ambient?: string;
}

export interface LocationVariant {
  when: string[];
  description: string;
  npcs: string[];
  shop?: string;
  storyDialogue?: string;
  actions?: { label: string; dialogue: string; hint?: string; requires?: string[] }[];
  /** Catalog asset id for this variant's scene, if it differs from the location's. */
  art?: string;
}

export interface LocationDef {
  id: string;
  name: string;
  kind: 'deepSite' | 'waypoint';
  era: EraId;
  site: string;
  type: string;
  description: string;
  /** Catalog asset id under public/art/locations, e.g. "2148_server_graveyard". */
  art: string;
  background: { layers: BackgroundLayer[]; particles: string };
  music: string;
  npcs: string[];
  quests: string[];
  encounters: string[];
  shop?: string;
  variants?: LocationVariant[];
  /** Extra entries in this location's action list: a way on, a way down, a thing to do. */
  actions?: { label: string; dialogue: string; hint?: string; requires?: string[] }[];
  /** Reached only from somewhere else, so it needs no node on the era map. */
  offMap?: boolean;
  links: { to: string; label: string }[];
  timeLinks: EraId[];
  storyDialogue?: string;
}

/**
 * An interior the Auditor walks around: the prologue's Allocation Office, and anything like it
 * later. Solid props block movement; interactive props raise a prompt when you stand on them.
 */
export interface RoomProp {
  id: string;
  kind: 'solid' | 'interact' | 'decor';
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  /** Dialogue id opened with A. Interactive props need one. */
  dialogue?: string;
  art?: 'desk' | 'monitors' | 'cabinet' | 'window' | 'door' | 'chair' | 'partition' | 'plant';
  requires?: string[];
}

export interface RoomDef {
  id: string;
  name: string;
  subtitle: string;
  era: EraId;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  music: string;
  props: RoomProp[];
  storyDialogue?: string;
}

/** One thing the Auditor has learned. Unlocks when its conditions first hold, and stays learned. */
export type LogCategory = 'people' | 'places' | 'dates' | 'clues';

export interface LogEntryDef {
  id: string;
  category: LogCategory;
  title: string;
  detail: string;
  /** Where the Auditor learned it. Kept apart from the detail so the screen can column it. */
  source: string;
  when: string[];
  order: number;
}

/** One of the five endings: chosen by Ownership, Sync and who is standing next to you. */
export interface EndingDef {
  id: string;
  name: string;
  art: string;
  summary: string;
  epilogue: string[];
  coda: string;
}

export interface EraDef {
  id: EraId;
  name: string;
  subtitle: string;
  palette: { bg: string; surface: string; ink: string; accent: string; accent2: string };
  lineWeight: number;
  font: string;
  fontStack: string;
  tuning: { edo: number; root: number; drift: number };
  instrumentSet: string[];
  particles: string;
}

export interface ScoreLayer {
  id: string;
  minTempo: number;
  instrument: string;
  pattern: 'bass' | 'pad' | 'perc' | 'motif' | 'motifInverted' | 'harmony' | 'ornament';
  degrees?: number[];
  durations?: number[];
  gain: number;
}

export interface ScoreDef {
  id: string;
  name: string;
  era: EraId;
  motifs: string[];
  motif: number[];
  scale: number[];
  baseBpm: number;
  swing: number;
  layers: ScoreLayer[];
  instruments: Record<string, string>;
}

export interface DialogueChoice {
  text: string;
  next?: string;
  syncDelta?: number;
  setFlags?: string[];
  timelineChoice?: string;
  conditions?: string[];
  action?: string;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  syncDelta?: number;
  conditions?: string[];
  choices?: DialogueChoice[];
  setFlags?: string[];
  next?: string;
  action?: string;
}

export interface DialogueDef {
  id: string;
  lines: DialogueLine[];
}

export interface TimelineChoiceDef {
  id: string;
  era: EraId;
  site: string;
  name: string;
  ownershipDelta: number;
  syncDelta: number;
  flags: string[];
  partyEffects: string[];
  lean: Lean;
  summary: string;
}

export interface QuestDef {
  id: string;
  name: string;
  location: string;
  giver: string;
  description: string;
  objectiveEncounter: string;
  rewards: { xp: number; currency: number; items: string[]; skillPoints: number; flags: string[] };
  dialogue: { offer: string; inProgress: string; complete: string };
}

export interface ShopItem {
  item: string;
  price: number;
  when?: string[];
}

export interface ShopDef {
  id: string;
  name: string;
  era: EraId;
  currency: string;
  stock: ShopItem[];
}

export interface ItemDef {
  id: string;
  name: string;
  kind: 'consumable' | 'relic' | 'gear';
  description: string;
  relicValue?: number;
  effect?: { heal?: number; tempo?: number; revive?: boolean; slack?: number };
  /** Gear only: where it goes, what it changes, and who may carry it. */
  slot?: EquipSlot;
  stats?: Partial<StatBlock>;
  grants?: string[];
  onlyFor?: string[];
  era?: EraId;
}

export interface MapNode {
  id: string;
  kind: 'location' | 'encounter';
  location?: string;
  encounter?: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  requires?: string[];
  icon?: string;
}

export interface MapZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  encounters: string[];
  chance: number;
  stride: number;
}

export interface MapDef {
  id: string;
  era: EraId;
  name: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  nodes: MapNode[];
  roads: number[][];
  zones: MapZone[];
}

export interface RulesDef {
  slackCap: number;
  tempoMax: number;
  tempoPerThread: number;
  entropyThreshold: number;
  entropyMax: number;
  rewind: { cost: number; entropy: number };
  fork: { cost: number; entropy: number; threadCost: number };
  surprise: { base: number; noiseBelowPerception: number };
  xpPerLevel: number;
  statGrowthPerLevel: number;
  activePartyMax: number;
  benchedXpShare: number;
  continuityFloor: number;
  continuityPerEdit: number;
  relicCap: number;
  parleySync: number;
  overloadSync: number;
  overloadBonus: number;
  armorFactor: number;
  markBonus: number;
}

export interface ContentDB {
  characters: Record<string, CharacterDef>;
  nodes: Record<string, NodeDef>;
  abilities: Record<string, AbilityDef>;
  enemies: Record<string, EnemyDef>;
  encounters: Record<string, EncounterDef>;
  locations: Record<string, LocationDef>;
  eras: Record<string, EraDef>;
  scores: Record<string, ScoreDef>;
  dialogues: Record<string, DialogueDef>;
  timelineChoices: Record<string, TimelineChoiceDef>;
  quests: Record<string, QuestDef>;
  shops: Record<string, ShopDef>;
  items: Record<string, ItemDef>;
  maps: Record<string, MapDef>;
  log: Record<string, LogEntryDef>;
  rooms: Record<string, RoomDef>;
  endings: Record<string, EndingDef>;
  rules: RulesDef;
}
