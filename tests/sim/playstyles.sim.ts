import { it } from 'vitest';
import { POLICIES } from './playstyles';
import { playEra, playStack } from './campaign';
import { ERA_LEVEL } from '../balance';
import { content } from '../helpers';
import type { DifficultyId } from '../../src/types/content';

// DIFF=story|standard|hard|audit plays every fight on that setting.
const DIFF = process.env.DIFF as DifficultyId | undefined;

const ROSTER: Record<string, string[]> = {
  '2312': ['player', 'wren', 'dax'],
  '2148': ['player', 'wren', 'dax', 'ilo9'],
  '2064': ['player', 'wren', 'dax', 'ilo9', 'mara'],
  '2031': ['player', 'wren', 'dax', 'ilo9', 'mara', 'hale', 'quiroga'],
};
// Every player style through every era and the Stack. ONLY=novice,expert narrows the styles.
it('eras', () => {
  const rows: string[] = [];
  for (const [name, pol] of Object.entries(POLICIES).filter(([n]) => (process.env.ONLY ?? n).split(',').includes(n))) {
    for (const era of ['2312', '2148', '2064', '2031'] as const) {
      for (const seed of [3, 7]) {
        const t0 = Date.now();
        const r = playEra(era, ERA_LEVEL[era], ROSTER[era], name, name === 'competent' ? null : pol, seed, 120, DIFF);
        const avg = (r.rounds.reduce((a, b) => a + b, 0) / r.rounds.length).toFixed(1);
        const lost = r.results.filter((x) => !x.won).map((x) => x.id).join(',');
        for (const tier of ['ordinary', 'hard'] as const) {
          const rs = r.results.filter((x) => content.encounters[x.id].tier === tier);
          if (!rs.length) continue;
          const rr = rs.map((x) => x.rounds);
          rows.push(`TIER\t${name}\t${era}\t${tier}\ts${seed}\tn ${rs.length}\twins ${rs.filter((x) => x.won).length}\tavgR ${(rr.reduce((a, b) => a + b, 0) / rr.length).toFixed(1)}\tdown ${rs.filter((x) => x.downs > 0).length}\tminHP ${Math.round(Math.min(...rs.map((x) => x.minFrac)) * 100)}%\tdmg ${Math.round(rs.reduce((a, x) => a + x.dmgTaken, 0) / rs.length)}\titems ${rs.reduce((a, x) => a + x.items, 0)}\trewinds ${rs.reduce((a, x) => a + x.rewinds, 0)}`);
        }
        rows.push(`ERA\t${name}\t${era}\ts${seed}\tfights ${r.fights}\twins ${r.wins}\tlosses ${r.losses}\trounds ${avg}\tdownFights ${r.downs}\tworst ${Math.round(r.worst * 100)}%\tcamps ${r.camps}\trests ${r.rests}\tbroke ${r.broke}\tentropyPeak ${r.entropyPeak}\t${Date.now() - t0}ms\t${lost}`);
      }
    }
    for (const seed of [3, 7]) {
      for (const level of [14, 20]) {
        const r = playStack(level, ['player', 'wren', 'dax', 'ilo9', 'mara', 'hale', 'quiroga'], name, name === 'competent' ? null : pol, seed, DIFF);
        rows.push(`STACK\t${name}\tL${level}\ts${seed}\tfloors ${r.wins}/${r.fights}\trounds ${r.rounds.join('/')}\tworst ${Math.round(r.worst * 100)}%\tcamps ${r.camps}\tentropyPeak ${r.entropyPeak}`);
      }
    }
  }
  console.log(rows.join('\n'));
}, 600000);
