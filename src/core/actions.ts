import type { EraId } from '../types/content';
import type { GameState, Screen, Settings } from '../types/state';

export type Action =
  | { type: 'NEW_GAME'; seed: number; lean: 'cinder' | 'choir' | 'commons'; name?: string }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'START_DIALOGUE'; id: string; returnTo?: Screen }
  | { type: 'DIALOGUE_ADVANCE' }
  | { type: 'DIALOGUE_CHOOSE'; index: number }
  | { type: 'TRAVEL'; location: string }
  | { type: 'TIME_JUMP'; era: EraId }
  | { type: 'EXPLORE'; encounters?: string[] }
  | { type: 'SET_MAP_POS'; x: number; y: number }
  | { type: 'SCAN_FIGHT' }
  | { type: 'SCAN_SKIP' }
  | { type: 'START_ENCOUNTER'; encounterId: string; surprise?: boolean; from?: 'map' | 'hub' }
  | { type: 'BATTLE_ABILITY'; actor: string; ability: string; target: string | null }
  | { type: 'BATTLE_ITEM'; actor: string; item: string; target: string }
  | { type: 'BATTLE_END_TURN'; actor: string }
  | { type: 'BATTLE_REWIND' }
  | { type: 'BATTLE_FORK'; actor: string; ability: string; target: string | null }
  | { type: 'BATTLE_FORK_DISCARD' }
  | { type: 'BATTLE_COLLAPSE' }
  | { type: 'BATTLE_ECHO'; character: string }
  | { type: 'BATTLE_ENEMY_ACT' }
  | { type: 'BATTLE_FINISH' }
  | { type: 'BATTLE_RELAY'; actor: string; incoming: string }
  | { type: 'REST' }
  | { type: 'CAMP' }
  | { type: 'UNLOCK_NODE'; character: string; node: string }
  | { type: 'SET_ACTIVE_PARTY'; members: string[] }
  | { type: 'EQUIP'; character: string; item: string }
  | { type: 'UNEQUIP'; character: string; slot: 'weapon' | 'gear' }
  | { type: 'RECRUIT'; character: string }
  | { type: 'SHOP_BUY'; item: string }
  | { type: 'SHOP_SELL_RELIC'; item: string }
  | { type: 'USE_ITEM'; item: string; target: string }
  | { type: 'QUEST_ACCEPT'; quest: string }
  | { type: 'QUEST_COMPLETE'; quest: string }
  | { type: 'TIMELINE_CHOICE'; choice: string }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'GAME_OVER_RETURN' }
  | { type: 'PROLOGUE_SKIP' }
  | { type: 'INTRO_ADVANCE' }
  | { type: 'INTRO_SKIP' };
