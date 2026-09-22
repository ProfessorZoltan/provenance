import { it } from 'vitest';
import { spam } from './playstyles';
import { fight } from './campaign';
import { partyAt, ERA_LEVEL, KEY_LEVEL } from '../balance';
import { content } from '../helpers';
import type { BattleState } from '../../src/types/state';

// Every party ability, with the character who owns it.
const owners: Record<string, string> = {};
for (const c of Object.values(content.characters)) for (const a of c.abilities) owners[a] = c.id;
for (const n of Object.values(content.nodes)) for (const e of n.effects) if (e.kind === 'ability') owners[e.ability] = n.character;
const skip = new Set(['strike', 'guard', 'parley', 'probe']);

// Each party ability used at every chance, against the same fights without it. Hard and key fights only.
it('spam', () => {
  const encs = Object.values(content.encounters).filter((e) => e.tier !== 'ordinary');
  const rows: string[] = [];
  for (const [ab, owner] of Object.entries(owners)) {
    if (skip.has(ab)) continue;
    const def = content.abilities[ab];
    const partner = def.pair?.with;
    const roster = ['player', owner, partner ?? (owner === 'wren' ? 'dax' : 'wren')].filter((x, i, arr) => arr.indexOf(x) === i);
    while (roster.length < 3) roster.push(['dax', 'wren', 'ilo9'].find((x) => !roster.includes(x))!);
    let base = { wins: 0, rounds: 0, n: 0, dmg: 0 }, with_ = { wins: 0, rounds: 0, n: 0, dmg: 0, fast: 0, uses: 0 };
    for (const e of encs) {
      const level = e.tier === 'key' ? KEY_LEVEL : Math.max(ERA_LEVEL[e.era], 5);
      for (const seed of [3, 11]) {
        const s = partyAt(level, roster, seed);
        const give = (b: BattleState) => ({ ...b, combatants: b.combatants.map((c) => (c.id === owner && !c.abilities.includes(ab) ? { ...c, abilities: [...c.abilities, ab] } : c)) });
        const strip = (b: BattleState) => ({ ...b, combatants: b.combatants.map((c) => (c.id === owner ? { ...c, abilities: c.abilities.filter((x) => x !== ab) } : c)) });
        const b0 = fight(s, e.id, null, seed, strip).r;
        const b1 = fight(s, e.id, spam(ab), seed, give, true).r;
        base.n++; base.wins += b0.won ? 1 : 0; base.rounds += b0.rounds; base.dmg += b0.dmgTaken;
        with_.n++; with_.wins += b1.won ? 1 : 0; with_.rounds += b1.rounds; with_.dmg += b1.dmgTaken; with_.uses += b1.use[ab] ?? 0;
        if (b1.won && b1.rounds <= 2 && e.tier !== 'ordinary') with_.fast++;
      }
    }
    rows.push(`SPAM\t${ab}\t${owner}\tbase ${base.wins}/${base.n} r${(base.rounds / base.n).toFixed(1)} dmg${Math.round(base.dmg / base.n)}\twith ${with_.wins}/${with_.n} r${(with_.rounds / with_.n).toFixed(1)} dmg${Math.round(with_.dmg / with_.n)}\tratio ${(with_.rounds / base.rounds).toFixed(2)}\tfast ${with_.fast}\tuses ${with_.uses}`);
  }
  console.log(rows.join('\n'));
}, 900000);
