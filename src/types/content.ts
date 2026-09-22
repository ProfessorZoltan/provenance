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
  /** Enemy only: how much party Tempo the hit takes away. */
  tempoDrain?: number;
  /** Party only: the Nerve this costs. Left out, the cost follows the ability's shape (see nerveCost). */
  nerve?: number;
  /** A pair tech: only with this partner on the field, who lends a hand and starts their next turn short. Formulas may read the partner as `p`. */
  pair?: { with: string };
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
  /** Who it goes for when it has a choice. Missing means the old coin flip: the weakest, or anyone. */
  targeting?: Targeting;
  /** What it is on the field, in a word the Inspect panel can show. */
  role?: string;
  /** A boss: Parley, Buyout, Open Weights and Settlement cannot take it off the field. */
  boss?: boolean;
  /** Quorum: what it gains, once, each time another enemy on the field falls. */
  rally?: { id: string; turns: number };
}

/**
 * Enemy targeting personalities. Each is one rule the player can learn and play around, and a
 * field with several on it is a field where no one stance is safe.
 */
export type Targeting = 'weakest' | 'healer' | 'buffed' | 'auditor' | 'revenge' | 'spread' | 'opportunist';

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
  /** How long this fight should run: ordinary 1-4 rounds, hard 3-8, key 7-20. See tests/balance. */
  tier: 'ordinary' | 'hard' | 'key';
  location: string;
  enemies: EncounterEnemy[];
  surprise: 'never' | 'roll' | 'always';
  story: boolean;
  flavor: string;
  scanHints: ScanHint[];
  rewardFlags?: string[];
  /** Winning this is the end of the run: the result screen hands off to the epilogue. */
  endsRun?: boolean;
  /** Extra durability on top of the tier's, for one encounter that needs to sit off the band. */
  scale?: number;
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
  /** Somewhere the party can pay for a proper night's rest. Deep Sites always can. */
  lodging?: boolean;
  /** Arriving here is a fresh stretch of ground: the era's camps are handed out again. */
  refillCamps?: boolean;
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
  /** Position in this giver's chain; they offer the lowest-numbered one still unfinished. */
  step?: number;
  /** Conditions that must hold before this step is offered at all. */
  requires?: string[];
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
  effect?: {
    heal?: number; tempo?: number; revive?: boolean; slack?: number;
    /** Statuses the item strips from its target. */
    cure?: string[];
    /** Entropy change, usually negative. */
    entropy?: number;
    /** Nerve restored to one ally. */
    nerve?: number;
    /** A status the item grants, to one ally or to the whole party. */
    status?: { id: string; turns: number; target: 'ally' | 'party' };
  };
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
  /** Tempo the party earns when one of them is hit, when they strike a weakness, and per enemy Marked. */
  tempoOnHit: number;
  tempoOnWeakness: number;
  tempoOnMark: number;
  entropyThreshold: number;
  entropyMax: number;
  rewind: { cost: number; entropy: number; base: number };
  /** Relay: swap a benched member onto the field mid-fight, for a thread. */
  relay: { threadCost: number };
  /** A paid full rest costs this much of the era's currency per level of the highest active member. */
  rest: { perLevel: number };
  /** Making camp in the field: how many times per era, and how much of max Resolve it gives back. */
  camp: { perEra: number; heal: number };
  /** Consumables are free actions, this many a turn, and the bag holds this many in total. */
  items: { perTurn: number; bagCap: number };
  /**
   * Nerve: what heals, buffs and debuffs cost, per character, refilled only by a bed, half by a
   * camp, and by tonics. The shape of an ability sets its cost unless the ability names one.
   */
  nerve: { base: number; perLevel: number; costs: { heal: number; buff: number; debuff: number; special: number }; campShare: number };
  /** Entropy is carried between fights. It creeps each round, jumps when the enemy pulls on time, and only beds and camps let it out. */
  entropyFlow: { perRound: number; enemyChronal: number; restDecay: number; campDecay: number; afterBreak: number };
  /** What Entropy does on the way up: a temptation, then the Echo, then lost turns, then a tear. */
  entropyTiers: {
    fray: { at: number; chronalBonus: number; tempoMultiplier: number };
    slip: { at: number; chance: number };
    break: { at: number; continuityLoss: number };
  };
  /** Continuity on the field: the Resolve ceiling it sets, when a member starts to flicker, and what a thin one does to Chronal. */
  continuityCombat: { resolveFloor: number; flickerBelow: number; chronalBonus: number };
  /** Level-up perks: how many picks a level grants and how many options each pick shows. */
  perks: { perLevel: number; choices: number };
  /** Pair techs: the level both partners need, and the threads the partner is short next turn. */
  pairs: { level: number; partnerPenalty: number };
  /**
   * Limits on the abilities that take enemies off the field or pile up bonuses: who can be bought and
   * for how long, how long a turned machine stays turned, who can be settled, how many copies of a
   * stacking bonus one combatant carries, and how many summons one caster keeps.
   */
  control: { buyoutBelow: number; buyoutRounds: number; openWeightsRounds: number; settleBelow: number; settleBossDamage: number; stackCap: number; copiesPerCaster: number };
  fork: { cost: number; entropy: number; threadCost: number };
  echo: { cost: number; entropy: number; turns: number };
  collapse: { cost: number; entropy: number };
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
  /** Every hit and heal is multiplied by this. Lower it and battles run longer. */
  damageScale: number;
  /** Enemy Resolve and shields by how much of a fight the encounter is meant to be. */
  tierScale: Record<'ordinary' | 'hard' | 'key', number>;
  /** Past `after` rounds, everything the enemy does grows by `perRound`: no fight stands still. */
  pressure: { after: number; perRound: number };
  markBonus: number;
}

/** A level-up choice: every level offers two of these, and one is kept for good. */
export interface PerkDef {
  id: string;
  name: string;
  description: string;
  stats?: Partial<StatBlock>;
  /** Extra Nerve capacity. */
  nerve?: number;
  passive?: string;
  value?: number;
}

/** One held frame of the opening: a scene, a heading, and what the player reads over it. */
export interface IntroSlide {
  art: string;
  role?: string;
  eyebrow: string;
  title: string;
  lines: string[];
}

export interface IntroDef {
  id: string;
  slides: IntroSlide[];
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
  intro: Record<string, IntroDef>;
  perks: Record<string, PerkDef>;
  rules: RulesDef;
}
