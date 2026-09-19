import { librarySvg } from './library';
// Original low-resolution sprites. Each cell is one pixel; SVG keeps scaling lossless.
export type Pose = 'idle' | 'act' | 'hit' | 'down';
export const FILTER_DEFS = '';
const sprites: Record<string, string[]> = {
  auditor: [
    '......kkkkkk....','.....khhhhhhkk..','.....khhhhhhhk..','.....ksssksssk..',
    '....ksssskskk...','.....ksssssk....','......ksskk.....','.....kbbbbkk....',
    '....kblbbbbl k...'.replace(/ /g,''),'...kskblbbblk...','...kskbbbbblk...', '....kkbbbbkk....',
    '.....kggggk.....','.....kbbbkbbk...','.....kbbbkbbk...','.....kbbkkbbk...',
    '....kllk.kllk...','....kkkk.kkkk...',
  ],
  wren: [
    '.......kkkk.....','......kwwwwk....','.....kwwwwwwk...', '....kwwsswwwwk..',
    '....kwsskswwwk..','.....ksssswwk...', '......ksswwk....','.....kwwwwwwk...',
    '..a..kwwawwwk...', '..a.kwwwaawwwk..','..akswwwaawwwk..','..akkwwwaawwwk..',
    '..a.kwwwaawwwk..','..a.kwwwaawwwk..','..a.kwwwaawwwk..','..akwwwwaawwwwk.',
    '..akwwwwwwwwwwk.','...kkkkkkkkkkkk.',
  ],
  dax: [
    '......kkkkkk....','.....khhhhhhk...', '.....kssssssk...','.....kssksssk...',
    '....ksssssssk...','.....ksssss k...'.replace(/ /g,''),'......kkkkkk....','....kkrrrrrrkk..',
    '...ksskrrlrrssk.','...ksskrrlrrssk.','...ksskrrrrrssk.','....kkkggggkkk..',
    '..kkkkkrrrrk....','..klllkrrkrrk...', '..klllkrrkrrk...','...ka.krrkrrk...',
    '...ka.kllkllk...', '...ka.kkkkkkk...',
  ],
  warden: [
    '......kkkkkk....','.....kllllllk...', '....kllmmmmllk..','....kllaaaallk..',
    '.....kllllllk...','......kllllk....','....kkmmmmmmkk..','...klmlmmmmlmlk.',
    '...klmlaaa almlk.'.replace(/ /g,''),'...klmlmmmmlmlk.','....klmmmmmm lk.'.replace(/ /g,''),'....kkggggggkk..',
    '.....kmmmkmmk...','.....kmmmkmmk...', '.....klllkllk...','.....klllkllk...',
    '....kllllklllk..','....kkkkkkkkkk..',
  ],
  drone_sentry: [
    '................','..kkkk....kkkk..','..kllk....kllk..','..km lkkkk lmk..'.replace(/ /g,''),
    '...kkllllllkk...', '..kllmmmmmmllk..','..klmmaaaammlk..','..klmawwwwamlk..',
    '..klmawwwwamlk..','..klmmaaaammlk..','...kllllllllk...','....kkllllkk....',
    '......kmmk......','......kaak......','.......aa.......','................',
  ],
  drone_hunter: [
    '..kk........kk..','..klk......klk..','..kllk....kllk..','..klllkkkklllk..',
    '...kllmmmmllk...','...klmaaaamlk...', '..kllmawwamllk..','..klmmawwammlk..',
    '..klmmaaaammlk..','...kllllllllk...', '..kllkkkkkkllk..','..klk......klk..',
    '..klk......klk..','..kk........kk..','................','................',
  ],
};
function pixels(rig: string, accent: string): string {
  const palette: Record<string, string> = { k: '#101426', h: '#73513f', s: rig === 'dax' ? '#b8794e' : '#f3bd8b', b: '#4676c7', l: '#bacde0', m: '#516482', w: '#fff0c9', a: accent, r: '#c55642', g: '#e5b95c' };
  return (sprites[rig] ?? sprites.auditor).map((row, y) => [...row].map((c, x) => palette[c] ? `<rect x="${x}" y="${y + 2}" width="1" height="1" fill="${palette[c]}"/>` : '').join('')).join('');
}
const RIG_IDS: Record<string, string> = {
  player: 'auditor', warden: 'warden_2148', echo: 'echo_temporal',
  drone_sentry: 'drone_sentry_2312', drone_hunter: 'drone_hunter_2312',
};
export function rigSvg(rig: string, accent: string, _ink = 'currentColor', pose: Pose = 'idle', echo = false, era?: string): string {
  const echoId = echo && era ? `${RIG_IDS[rig] ?? rig}_echo_${era}` : undefined;
  const echoArt = echoId ? librarySvg(echoId, pose, '0 0 32 40', 'rig party-echo') : undefined;
  if (echoArt) return echoArt;
  const art = librarySvg(RIG_IDS[rig] ?? rig, pose, '0 0 32 40', `rig ${echo ? 'echo-rig' : ''}`);
  if (art) return art;
  return `<svg viewBox="0 0 18 22" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" class="rig ${echo ? 'echo-rig' : ''}"><g class="rig-${pose}">${pixels(rig, accent)}</g></svg>`;
}
export function portraitSvg(rig: string, accent: string, _ink = 'currentColor'): string {
  const art = librarySvg(RIG_IDS[rig] ?? rig, 'portrait', '0 0 32 32', 'portrait-svg');
  if (art) return art;
  return `<svg viewBox="3 1 12 12" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" class="portrait-svg">${pixels(rig, accent)}</svg>`;
}
export function tokenSvg(rig: string, accent: string, _ink = 'currentColor'): string {
  return librarySvg(RIG_IDS[rig] ?? rig, 'token', '0 0 16 20', 'map-sprite') ?? rigSvg(rig, accent);
}
