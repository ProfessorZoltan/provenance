// One description of what a status actually does, read by the engine's log, the Fork preview and
// the battle screen alike. The numbers come from the same places the damage maths reads them, so a
// tuning change cannot leave the player with a stale explanation.
import type { Combatant, StatusEffect } from '../../types/state';
import type { RulesDef } from '../../types/content';

export interface StatusInfo {
  /** What the fight calls it. */
  label: string;
  /** Good for whoever is carrying it, or bad. Decides the colour on the card. */
  polarity: 'good' | 'bad';
  /** The mechanical effect, in the player's terms. */
  effect: (rules: RulesDef) => string;
  /** True when several copies stack rather than refresh, so the card shows a count. */
  stacks?: boolean;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const STATUS_INFO: Record<string, StatusInfo> = {
  guard: {
    label: 'Guard',
    polarity: 'good',
    effect: () => 'Takes 50% less damage.',
  },
  taunt: {
    label: 'Bulwark',
    polarity: 'good',
    effect: () => 'Takes 50% less damage, and enemies attack this target first.',
  },
  inspired: {
    label: 'Litany',
    polarity: 'good',
    stacks: true,
    effect: (r) => `Deals 15% more damage per stack, up to ${r.control.stackCap} stacks.`,
  },
  anchored: {
    label: 'Anchored',
    polarity: 'good',
    effect: () => 'Cannot be dropped below 1 Resolve.',
  },
  fixed: {
    label: 'Fixed Point',
    polarity: 'good',
    effect: () => 'Cannot be dropped below 1 Resolve.',
  },
  faraday: {
    label: 'Faraday',
    polarity: 'good',
    effect: () => 'Takes no Signal or Thermal damage at all.',
  },
  held: {
    label: 'Held Shot',
    polarity: 'good',
    stacks: true,
    effect: (r) => `The next released shot hits 60% harder per turn held, up to ${r.control.stackCap} turns.`,
  },
  marked: {
    label: 'Marked',
    polarity: 'bad',
    effect: (r) => `Takes ${pct(r.markBonus)} more damage, and its weakness is on show.`,
  },
  bound: {
    label: 'Bound by terms',
    polarity: 'bad',
    effect: () => 'Takes 20% more damage and deals 30% less.',
  },
  fear: {
    label: 'Fear',
    polarity: 'bad',
    effect: () => 'Starts each turn with one fewer thread. Drones do not feel it.',
  },
  locked: {
    label: 'Target Lock',
    polarity: 'bad',
    effect: () => 'Attacks against it cannot miss.',
  },
  wall: {
    label: 'Standing between',
    polarity: 'good',
    effect: () => 'Every single hit thrown at its side lands on it instead. It takes them at full strength.',
  },
  spent: {
    label: 'Lent a hand',
    polarity: 'bad',
    effect: () => 'Starts the next turn one thread short, for the pair tech they helped with.',
  },
  charging: {
    label: 'Winding up',
    polarity: 'good',
    effect: () => 'Unleashes a heavy hit next turn. Bound by terms or Target Lock breaks the wind-up.',
  },
};

export function statusLabel(id: string): string {
  return STATUS_INFO[id]?.label ?? id;
}

export function statusEffect(id: string, rules: RulesDef): string {
  return STATUS_INFO[id]?.effect(rules) ?? '';
}

/** The effect as a clause that reads inside a sentence: no capital, no full stop. */
export function statusClause(id: string, rules: RulesDef): string {
  const e = statusEffect(id, rules).replace(/\.$/, '');
  return e ? e[0].toLowerCase() + e.slice(1) : '';
}

/** "Marked: takes 25% more damage... 3 turns." — what the log says the moment it lands. */
export function statusSentence(id: string, turns: number, rules: RulesDef): string {
  const effect = statusClause(id, rules);
  return `${statusLabel(id)}${effect ? `: ${effect}` : ''} ${turnsText(turns)}.`;
}

export function turnsText(turns: number): string {
  return turns >= 9 ? 'until it is spent' : `for ${turns} turn${turns === 1 ? '' : 's'}`;
}

export interface StatusChip {
  id: string;
  label: string;
  polarity: 'good' | 'bad';
  /** Turns left on the longest-running copy. */
  turns: number;
  /** How many copies are running, for the ones that stack. */
  count: number;
  effect: string;
}

/** Everything currently on a combatant, collapsed one row per status, longest first. */
export function statusChips(c: Combatant, rules: RulesDef): StatusChip[] {
  const byId = new Map<string, StatusEffect[]>();
  for (const s of c.statuses) byId.set(s.id, [...(byId.get(s.id) ?? []), s]);
  return [...byId.entries()].map(([id, list]) => ({
    id,
    label: statusLabel(id),
    polarity: STATUS_INFO[id]?.polarity ?? 'bad',
    turns: Math.max(...list.map((s) => s.turns)),
    count: list.length,
    effect: statusEffect(id, rules),
  })).sort((a, b) => b.turns - a.turns);
}
