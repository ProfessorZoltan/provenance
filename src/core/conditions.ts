// Condition DSL shared by scan hints, dialogue lines, shop stock and condition nodes.
//   flag:x (or bare x)   !flag:x   visited:2148   party:wren   era:2148
//   quest:id:active|available|readyToTurnIn|complete
//   signal>=40    noise>=70     sync<=-40        ownership>=50   entropy>=70   continuity<=10
// `signal` and `noise` read the highest value in the active party; `sync` is the party average.
// `continuity` is the lowest in the active party, except while deciding whether one person walks
// away, where it is that person's own.

export interface ConditionContext {
  flags: string[];
  visitedEras: string[];
  party: string[];
  era: string;
  quests: Record<string, string>;
  stats: { signal: number; noise: number; sync: number; ownership: number; entropy: number; continuity: number };
}

export function evalCondition(cond: string, ctx: ConditionContext): boolean {
  const c = cond.trim();
  if (c.startsWith('!')) return !evalCondition(c.slice(1), ctx);
  const cmp = c.match(/^(signal|noise|sync|ownership|entropy|continuity)\s*(>=|<=|>|<|==)\s*(-?\d+)$/);
  if (cmp) {
    const v = ctx.stats[cmp[1] as keyof ConditionContext['stats']];
    const n = parseInt(cmp[3], 10);
    switch (cmp[2]) {
      case '>=': return v >= n;
      case '<=': return v <= n;
      case '>': return v > n;
      case '<': return v < n;
      default: return v === n;
    }
  }
  const [kind, ...rest] = c.split(':');
  const arg = rest.join(':');
  switch (kind) {
    case 'flag': return ctx.flags.includes(arg);
    case 'visited': return ctx.visitedEras.includes(arg);
    case 'party': return ctx.party.includes(arg);
    case 'era': return ctx.era === arg;
    case 'quest': {
      const [id, status] = arg.split(':');
      return (ctx.quests[id] ?? 'available') === status;
    }
    case 'always': return true;
    default:
      // A bare word is a flag.
      if (rest.length === 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(kind)) return ctx.flags.includes(kind);
      throw new Error(`Unknown condition "${cond}"`);
  }
}

export function evalAll(conds: string[] | undefined, ctx: ConditionContext): boolean {
  if (!conds || conds.length === 0) return true;
  return conds.every((c) => evalCondition(c, ctx));
}
