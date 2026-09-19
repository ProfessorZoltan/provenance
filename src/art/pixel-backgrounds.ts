import { librarySvg } from './library';
import type { EraDef } from '../types/content';

// A 320 x 180 tile scene shared by the hub and battlefield. No raster filtering.
export function sceneAssetId(locationId: string, flags: string[]): string {
  if (locationId === 'kell_village_2312') {
    if (flags.includes('armedResistance')) return '2312_kell_village_armed_resistance';
    if (flags.includes('letItFall')) return '2312_kell_village_let_it_fall';
    return '2312_kell_village';
  }
  if (locationId === 'kell_2312') return '2312_kell';
  if (locationId === 'kell_2148') return '2148_kell';
  return locationId;
}
export function sceneSvg(id: string, role: string): string | undefined {
  return librarySvg(id, role, '0 0 320 180', 'scene-art');
}
export function pixelBackground(id: string, era: EraDef, flags: string[]): string {
  // New JSON content can name any catalog asset directly: "2031_meridian:sky".
  if (id.includes(':')) {
    const [asset, role] = id.split(':');
    const art = sceneSvg(asset, role);
    if (art) return art;
  }
  const legacy = /^kell(2312|2148)_(sky|monastery|walls|village|floor|fore)$/.exec(id);
  if (legacy) {
    const role = ({ sky: 'sky', monastery: 'distant', walls: 'distant', village: 'distant', floor: 'midground', fore: 'foreground' } as Record<string, string>)[legacy[2]];
    const asset = legacy[2] === 'village' ? sceneAssetId('kell_village_2312', flags) : `${legacy[1]}_kell`;
    const art = sceneSvg(asset, role);
    if (art) return art;
  }
  const ruined = era.id === '2148';
  const sky = ruined ? '#181c35' : '#142c50';
  const stone = ruined ? '#55546b' : '#7188a0';
  const light = ruined ? '#8b8090' : '#b5cbd4';
  const grass = ruined ? '#384e45' : '#3c6870';
  const rect = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  let art = '';
  if (id.endsWith('sky')) {
    art = rect(0, 0, 320, 180, sky);
    for (let i = 0; i < 32; i++) art += rect((i * 73) % 320, (i * 17) % 65, 1, 1, '#9baac6');
    art += rect(250, 18, 12, 12, '#f2e3b3') + rect(247, 21, 18, 6, '#f2e3b3');
    for (let i = 0; i < 10; i++) {
      const x = i * 38 - 20, top = 44 + (i * 13) % 34;
      for (let s = 0; s < 9; s++) art += rect(x - s * 4, top + s * 5, 8 + s * 8, 6, i % 2 ? '#35465f' : '#263951');
      art += rect(x, top, 8, 5, '#8794ac') + rect(x - 4, top + 5, 16, 4, '#657b95');
    }
  } else if (id.endsWith('monastery') || id.endsWith('walls') || id.endsWith('village')) {
    const village = id.endsWith('village');
    const house = (x: number, y: number, w: number, h: number) => {
      let s = rect(x, y, w, h, stone) + rect(x, y, w, 3, light);
      for (let row = 0; row < h / 6; row++) for (let col = 0; col < w / 12; col++) s += rect(x + col * 12 + (row % 2) * 5, y + row * 6 + 4, 9, 1, '#3a475f');
      for (let wx = x + 7; wx < x + w - 5; wx += 16) s += rect(wx, y + 9, 5, 9, '#18283c') + rect(wx + 1, y + 10, 2, 6, ruined ? '#d88b57' : '#8fdbda');
      return s;
    };
    if (village) {
      for (let i = 0; i < 6; i++) {
        const x = 28 + i * 46, y = 108 + (i % 2) * 8;
        art += house(x, y, 34, 38);
        for (let j = 0; j < 5; j++) art += rect(x - 3 + j * 3, y - j * 3, 40 - j * 6, 3, '#384b70');
        art += rect(x + 14, y + 22, 8, 16, '#18283c');
      }
      if (flags.includes('armedResistance')) for (let i = 0; i < 12; i++) art += rect(194 + i * 5, 132, 3, 16, '#ae7850');
      if (flags.includes('letItFall')) art += rect(154, 88, 14, 4, '#b5cbd4') + rect(159, 92, 4, 4, '#e88776');
    } else {
      art += house(63, 99, 194, 48) + house(54, 87, 28, 60) + house(238, 87, 28, 60) + house(140, 68, 40, 79);
      for (let j = 0; j < 7; j++) art += rect(132 + j * 4, 68 - j * 3, 56 - j * 8, 3, '#344565');
      art += rect(152, 125, 16, 22, '#18283c') + rect(156, 121, 8, 4, '#18283c');
      art += rect(55, 147, 210, 3, light) + rect(48, 150, 224, 3, stone);
      if (ruined) for (let i = 0; i < 19; i++) art += rect(65 + i * 10, 137 - (i % 3) * 4, 8, 9, grass);
    }
  } else if (id.endsWith('floor')) {
    art = rect(0, 153, 320, 27, grass) + rect(0, 154, 320, 2, light);
    for (let i = 0; i < 100; i++) art += rect((i * 43) % 320, 158 + (i * 7) % 22, 3, 1, i % 2 ? stone : '#263951');
  } else if (id.endsWith('fore')) {
    for (const x of [5, 305]) {
      art += rect(x, 107, 5, 67, '#172838');
      for (let j = 0; j < 5; j++) art += rect(x - 12 + j * 2, 136 - j * 9, 29 - j * 4, 11, ruined ? '#30483f' : '#28555d');
    }
  }
  return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${art}</svg>`;
}
