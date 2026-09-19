// Battle narration: every consequential log line is shown in a box in the middle of the field
// and dismissed with A, so the player reads who did what to whom before anything else happens.
// The queue lives in the UI layer; the battle log in state stays the source of truth.

import type { BattleLogEntry, BattleState } from '../types/state';

const LINES_PER_PAGE = 3;

let pages: BattleLogEntry[][] = [];
let seen = new WeakSet<BattleLogEntry>();
let key = '';

function battleKey(b: BattleState): string {
  return `${b.encounterId}:${b.seed}`;
}

/** Narrate everything except turn bookkeeping, which the side log already shows. */
function narratable(line: BattleLogEntry): boolean {
  return line.kind !== 'system';
}

/**
 * Queue any log lines added since the last sync. Returns the page now on screen, if it is new.
 * Lines are tracked by object identity rather than by count, because a Rewind rewrites the tail
 * of the log: the surviving prefix keeps its entries, so the Rewind's own message still narrates
 * while the undone turn's messages are dropped from the queue.
 */
export function syncNarration(b: BattleState | null): BattleLogEntry[] | null {
  if (!b) {
    resetNarration();
    return null;
  }
  const k = battleKey(b);
  if (k !== key) {
    key = k;
    pages = [];
    seen = new WeakSet();
  }
  const fresh: BattleLogEntry[] = [];
  for (const line of b.log) {
    if (seen.has(line)) continue;
    seen.add(line);
    if (narratable(line)) fresh.push(line);
  }
  // Anything queued but not yet read that the Rewind erased never gets shown.
  pages = pages.filter((p) => p.every((line) => b.log.includes(line)));
  const before = pages.length;
  for (let i = 0; i < fresh.length; i += LINES_PER_PAGE) pages.push(fresh.slice(i, i + LINES_PER_PAGE));
  if (pages.length === before) return null;
  return before === 0 ? pages[0] : null;
}

export function currentPage(): BattleLogEntry[] | null {
  return pages[0] ?? null;
}

export function narrationPending(): boolean {
  return pages.length > 0;
}

/** Dismiss the page on screen. Returns the next page, if the queue is not empty. */
export function advanceNarration(): BattleLogEntry[] | null {
  pages.shift();
  return pages[0] ?? null;
}

export function resetNarration(): void {
  pages = [];
  seen = new WeakSet();
  key = '';
}
