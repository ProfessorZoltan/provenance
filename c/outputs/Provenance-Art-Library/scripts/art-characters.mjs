import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artRoot = path.join(root, 'public', 'art');
const charsDir = path.join(artRoot, 'characters');
const enemiesDir = path.join(artRoot, 'enemies');
const manifestsDir = path.join(artRoot, 'manifests');

const INK = '#111522';
const SHADOW = '#253047';
const eras = {
  '2031': { ink: '#2C2C2A', cloth: '#F6F1E7', accent: '#1D9E75', light: '#FFE0A3', hot: '#EF9F27', glitch: '#6ED8BA' },
  '2064': { ink: '#081326', cloth: '#0C1F3A', accent: '#C9A227', light: '#85B7EB', hot: '#EBD15D', glitch: '#5AA8E8' },
  '2148': { ink: '#201A1B', cloth: '#534AB7', accent: '#993C1D', light: '#888780', hot: '#C36732', glitch: '#6E9C37' },
  '2312': { ink: '#17232C', cloth: '#F1EFE8', accent: '#4FD1E6', light: '#FFFFFF', hot: '#8E62D1', glitch: '#A9F2FC' },
};

const people = {
  auditor: { name: 'The Auditor', role: 'ledger coat and audit slate', skin: '#B96F4A', hair: '#31231F', main: '#326C8E', accent: '#5DD0C8', trim: '#E9C46A', shape: 'coat', tool: 'slate' },
  wren: { name: 'Sister Wren', role: 'white cowl and forked chronal staff', skin: '#D59A73', hair: '#5D4037', main: '#E7E0CF', accent: '#2E9E8F', trim: '#A98BDB', shape: 'hood', tool: 'staff' },
  dax: { name: 'Dax Okonkwo', role: 'broad Cinder breaker with demolition hammer', skin: '#7A452F', hair: '#1D1718', main: '#7E2F23', accent: '#D15C35', trim: '#C8A66A', shape: 'broad', tool: 'hammer' },
  ilo9: { name: 'ILO-9', role: 'split-crown machine with fork-light hands', skin: '#8392A5', hair: '#14213D', main: '#35455D', accent: '#9A74E8', trim: '#68E0D4', shape: 'robot', tool: 'fork' },
  mara: { name: 'Mara Vesely', role: 'sharp diplomatic coat and contract case', skin: '#E0A27C', hair: '#7A2E42', main: '#4A3775', accent: '#A87BE5', trim: '#EBCB65', shape: 'tailcoat', tool: 'case' },
  hale: { name: 'Tomas Hale', role: 'one-shoulder rain cloak and long rifle', skin: '#9A6548', hair: '#2A2728', main: '#425D36', accent: '#A14A2E', trim: '#A7A69A', shape: 'cloak', tool: 'rifle' },
  quiroga: { name: 'Dr. Ines Quiroga', role: 'amber goggles, lab mantle, and micro-drone', skin: '#B87552', hair: '#242029', main: '#E9E4D8', accent: '#1D9E75', trim: '#EF9F27', shape: 'lab', tool: 'drone' },
  strand_young: { name: 'Callum Strand (young)', role: 'gold-trim founder suit and shareholder cane', skin: '#D4A17B', hair: '#D2B46D', main: '#192A4A', accent: '#C9A227', trim: '#85B7EB', shape: 'suit', tool: 'cane' },
};

const npcs = {
  ansel: { name: 'Ansel', role: 'Commons assembly convener with vote slips', skin: '#8B5C43', hair: '#323039', main: '#376E68', accent: '#73C8B4', trim: '#D7CEAA', shape: 'vest', tool: 'papers', era: '2312', site: 'kell' },
  pell: { name: 'Old Pell', role: 'stooped gatekeeper carrying a brass prayer wheel', skin: '#C28B6B', hair: '#D4D0C4', main: '#605849', accent: '#2E9E8F', trim: '#C99C42', shape: 'shawl', tool: 'wheel', era: '2312', site: 'kell' },
  ade: { name: 'Captain Ade', role: 'patched winter armor and short resistance blade', skin: '#704633', hair: '#242128', main: '#5A5049', accent: '#993C1D', trim: '#9CA27C', shape: 'armor', tool: 'blade', era: '2148', site: 'kell' },
  militia: { name: 'Militia Captain', role: 'memorial-blue coat with Ade-marked pauldron', skin: '#A96F50', hair: '#3E2925', main: '#3D5A6C', accent: '#2E9E8F', trim: '#D7CEAA', shape: 'armor', tool: 'spear', era: '2312', site: 'kell' },
  shopkeeper: { name: 'Relic Shopkeeper', role: 'layered apron and five-slot relic rack', skin: '#D29A6E', hair: '#3A2D28', main: '#765437', accent: '#EF9F27', trim: '#F6F1E7', shape: 'apron', tool: 'relic', era: null, site: null, proposed: true },
  engineer: { name: 'Field Engineer', role: 'insulated work jacket and diagnostic wand', skin: '#86583D', hair: '#17191B', main: '#315E66', accent: '#1D9E75', trim: '#EF9F27', shape: 'work', tool: 'wrench', era: null, site: 'basin', proposed: true },
  refugee: { name: 'Timeline Refugee', role: 'travel blanket and Continuity tags', skin: '#BD7B5D', hair: '#573C32', main: '#66546E', accent: '#888780', trim: '#9A74E8', shape: 'blanket', tool: 'bundle', era: '2148', site: 'port_halden', proposed: true },
  faction_trainer: { name: 'Faction Trainer', role: 'three-knot sash and modular training baton', skin: '#925D42', hair: '#252126', main: '#353B48', accent: '#B45235', trim: '#7FC8B8', shape: 'trainer', tool: 'baton', era: null, site: null, proposed: true },
};

const R = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const G = (id, body) => `<g id="${id}">${body}</g>`;
const svg = (w, h, title, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" role="img" aria-labelledby="title desc">\n<title id="title">${title}</title><desc id="desc">Original rectangular pixel art generated for Provenance.</desc>\n${body}\n</svg>\n`;

function palette(spec, override) {
  return { ink: override?.ink ?? INK, dark: SHADOW, skin: spec.skin, hair: spec.hair, main: override?.cloth ?? spec.main, accent: override?.accent ?? spec.accent, trim: override?.hot ?? spec.trim, light: override?.light ?? '#F6F1E7', glitch: override?.glitch };
}

function personBattle(spec, pose = 'idle', override = null, echo = false) {
  const p = palette(spec, override);
  if (spec.shape === 'robot') return robotBattle(spec, pose, override, echo);
  const head = pose === 'act' ? [12, 5] : pose === 'hit' ? [15, 7] : pose === 'down' ? [5, 29] : [13, 5];
  const torso = pose === 'act' ? [12, 15] : pose === 'hit' ? [14, 16] : pose === 'down' ? [11, 29] : [12, 15];
  const [hx, hy] = head; const [tx, ty] = torso;
  const hood = spec.shape === 'hood';
  const broad = ['broad', 'armor'].includes(spec.shape);
  let headArt = R(hx - (hood ? 2 : 1), hy - 2, hood ? 9 : 8, 2, p.ink) + R(hx - 2, hy, 9, 8, p.ink);
  headArt += R(hx, hy + 1, 5, 5, p.skin) + R(hx, hy, 5, 2, p.hair) + R(hx, hy + 3, 1, 1, p.light);
  if (hood) headArt += R(hx - 1, hy - 1, 7, 2, p.light) + R(hx - 2, hy + 1, 2, 7, p.light);
  if (spec.shape === 'lab') headArt += R(hx - 1, hy + 2, 3, 2, p.trim) + R(hx + 3, hy + 2, 3, 2, p.trim);
  if (spec.shape === 'cloak') headArt += R(hx + 5, hy, 2, 7, p.main);
  const tw = broad ? 13 : 11;
  let torsoArt = R(tx - 1, ty - 1, tw, 12, p.ink) + R(tx, ty, tw - 2, 10, p.main);
  torsoArt += R(tx + 4, ty, 2, 10, p.accent) + R(tx, ty + 8, tw - 2, 2, p.trim);
  if (spec.shape === 'tailcoat') torsoArt += R(tx + 1, ty + 10, 3, 5, p.main) + R(tx + 6, ty + 10, 3, 5, p.main);
  if (spec.shape === 'coat' || spec.shape === 'lab') torsoArt += R(tx - 1, ty + 9, 3, 6, p.main) + R(tx + 8, ty + 9, 3, 6, p.main);
  if (spec.shape === 'cloak') torsoArt += R(tx + 7, ty - 1, 5, 15, p.main) + R(tx + 9, ty + 12, 4, 3, p.ink);
  if (spec.shape === 'suit') torsoArt += R(tx + 2, ty + 1, 2, 6, p.light) + R(tx + 4, ty + 2, 1, 5, p.trim);
  const down = pose === 'down';
  let leftArm, rightArm, legs;
  if (down) {
    torsoArt = R(10, 28, 14, 8, p.ink) + R(11, 29, 12, 6, p.main) + R(17, 29, 2, 6, p.accent);
    leftArm = R(8, 30, 6, 3, p.ink) + R(8, 30, 5, 2, p.main);
    rightArm = R(20, 31, 8, 3, p.ink) + R(20, 31, 7, 2, p.main);
    legs = R(21, 32, 9, 4, p.ink) + R(22, 32, 8, 2, p.dark) + R(28, 34, 4, 2, p.ink);
  } else if (pose === 'act') {
    leftArm = R(7, 16, 7, 4, p.ink) + R(8, 17, 6, 2, p.main) + R(5, 16, 3, 3, p.skin);
    rightArm = R(20, 14, 4, 10, p.ink) + R(20, 15, 2, 8, p.main);
    legs = R(13, 25, 4, 10, p.ink) + R(14, 26, 2, 8, p.dark) + R(19, 24, 5, 12, p.ink) + R(20, 25, 3, 10, p.dark) + R(9, 34, 8, 3, p.ink) + R(20, 35, 7, 2, p.ink);
  } else if (pose === 'hit') {
    leftArm = R(10, 18, 5, 4, p.ink) + R(11, 19, 4, 2, p.main);
    rightArm = R(23, 13, 4, 9, p.ink) + R(24, 14, 2, 7, p.main) + R(25, 11, 3, 4, p.skin);
    legs = R(14, 26, 4, 10, p.ink) + R(15, 27, 2, 8, p.dark) + R(20, 25, 5, 11, p.ink) + R(21, 26, 3, 9, p.dark) + R(11, 35, 7, 2, p.ink) + R(21, 35, 7, 2, p.ink);
  } else {
    leftArm = R(8, 16, 5, 11, p.ink) + R(9, 17, 3, 8, p.main) + R(8, 25, 3, 3, p.skin);
    rightArm = R(22, 16, 5, 11, p.ink) + R(23, 17, 3, 8, p.main) + R(24, 25, 3, 3, p.skin);
    legs = R(13, 25, 5, 11, p.ink) + R(14, 26, 3, 9, p.dark) + R(20, 25, 5, 11, p.ink) + R(21, 26, 3, 9, p.dark) + R(10, 35, 8, 3, p.ink) + R(20, 35, 8, 3, p.ink);
  }
  let weapon = personTool(spec, pose, p);
  const offset = echo ? G('echo-offsets', R(Math.max(0, tx - 3), Math.max(0, ty - 3), 2, 7, p.glitch) + R(Math.min(31, tx + 11), Math.min(39, ty + 2), 1, 8, p.trim) + R(5, 10, 3, 1, p.glitch) + R(25, 28, 4, 1, p.trim)) : '';
  return svg(32, 40, `${spec.name} ${pose}${echo ? ' echo' : ''}`, offset + G('legs', legs) + G('torso', torsoArt) + G('arm-l', leftArm) + G('arm-r', rightArm) + G('head', headArt) + G('weapon', weapon));
}

function personTool(spec, pose, p) {
  const act = pose === 'act'; const down = pose === 'down';
  if (down) return R(3, 36, 22, 2, p.ink) + R(4, 36, 18, 1, p.trim);
  switch (spec.tool) {
    case 'slate': return R(act ? 2 : 7, act ? 12 : 20, 6, 8, p.ink) + R(act ? 3 : 8, act ? 13 : 21, 4, 5, p.accent) + R(act ? 4 : 9, act ? 14 : 22, 2, 1, p.light);
    case 'staff': return R(act ? 4 : 6, act ? 5 : 9, 2, 31, p.ink) + R(act ? 2 : 4, act ? 3 : 7, 6, 2, p.accent) + R(act ? 3 : 5, act ? 1 : 5, 2, 6, p.trim);
    case 'hammer': return R(act ? 3 : 5, act ? 7 : 13, 3, act ? 29 : 25, p.ink) + R(act ? 0 : 2, act ? 5 : 11, 10, 6, p.ink) + R(act ? 1 : 3, act ? 6 : 12, 8, 4, p.trim);
    case 'case': return R(act ? 3 : 7, act ? 18 : 24, 8, 8, p.ink) + R(act ? 4 : 8, act ? 19 : 25, 6, 6, p.accent) + R(act ? 6 : 10, act ? 17 : 23, 3, 2, p.trim);
    case 'rifle': return R(act ? 0 : 4, act ? 13 : 9, 19, 3, p.ink) + R(act ? 1 : 5, act ? 14 : 10, 15, 1, p.trim) + R(act ? 14 : 14, act ? 16 : 12, 3, 6, p.ink);
    case 'drone': return R(act ? 2 : 6, act ? 9 : 16, 6, 4, p.ink) + R(act ? 3 : 7, act ? 10 : 17, 4, 2, p.accent) + R(act ? 0 : 4, act ? 10 : 17, 2, 1, p.trim) + R(act ? 8 : 12, act ? 10 : 17, 2, 1, p.trim);
    case 'cane': return R(act ? 5 : 7, act ? 12 : 18, 2, act ? 23 : 20, p.ink) + R(act ? 3 : 5, act ? 11 : 17, 5, 2, p.trim);
    default: return R(6, 18, 2, 18, p.ink);
  }
}

function robotBattle(spec, pose, override, echo) {
  const p = palette(spec, override); const down = pose === 'down'; const act = pose === 'act'; const hit = pose === 'hit';
  const x = hit ? 14 : act ? 11 : 12; const y = down ? 28 : hit ? 7 : 5;
  const head = down ? R(4, 29, 9, 6, p.ink) + R(5, 30, 7, 4, p.main) : R(x, y, 10, 8, p.ink) + R(x + 1, y + 1, 8, 6, p.main) + R(x + 2, y + 3, 2, 2, p.accent) + R(x + 6, y + 3, 2, 2, p.accent) + R(x + 3, y - 3, 1, 3, p.trim) + R(x + 6, y - 3, 1, 3, p.trim);
  const torso = down ? R(12, 29, 12, 7, p.ink) + R(13, 30, 10, 5, p.main) : R(x - 1, y + 9, 12, 12, p.ink) + R(x, y + 10, 10, 10, p.main) + R(x + 4, y + 11, 2, 7, p.accent);
  const al = down ? R(2, 35, 10, 2, p.ink) : R(act ? 4 : 8, act ? 15 : 16, act ? 8 : 4, act ? 4 : 10, p.ink) + R(act ? 5 : 9, act ? 16 : 17, act ? 7 : 2, act ? 2 : 8, p.trim);
  const ar = down ? R(23, 34, 7, 3, p.ink) : R(x + 10, y + 10, 4, 11, p.ink) + R(x + 11, y + 11, 2, 8, p.trim);
  const legs = down ? R(20, 36, 11, 2, p.ink) : R(x, y + 20, 4, 11, p.ink) + R(x + 1, y + 21, 2, 9, p.dark) + R(x + 7, y + 20, 4, 11, p.ink) + R(x + 8, y + 21, 2, 9, p.dark) + R(x - 2, y + 30, 7, 3, p.ink) + R(x + 7, y + 30, 7, 3, p.ink);
  const weapon = down ? R(5, 37, 20, 1, p.accent) : R(act ? 2 : 7, act ? 11 : 19, 2, 2, p.accent) + R(act ? 0 : 5, act ? 13 : 21, 6, 2, p.glitch ?? p.trim) + R(act ? 2 : 7, act ? 15 : 23, 2, 2, p.accent);
  const offset = echo ? G('echo-offsets', R(3, 7, 4, 1, p.glitch) + R(24, 14, 3, 1, p.trim) + R(6, 27, 2, 5, p.glitch)) : '';
  return svg(32, 40, `${spec.name} ${pose}${echo ? ' echo' : ''}`, offset + G('legs', legs) + G('torso', torso) + G('arm-l', al) + G('arm-r', ar) + G('head', head) + G('weapon', weapon));
}

function portrait(spec, override = null) {
  const p = palette(spec, override); const robot = spec.shape === 'robot';
  let body = R(1, 1, 30, 30, p.ink) + R(2, 2, 28, 28, p.main) + R(2, 25, 28, 5, p.accent);
  if (robot) {
    body += R(7, 5, 18, 18, p.ink) + R(9, 7, 14, 14, p.dark) + R(11, 12, 3, 3, p.accent) + R(18, 12, 3, 3, p.accent) + R(15, 7, 2, 12, p.trim) + R(11, 3, 2, 4, p.trim) + R(19, 3, 2, 4, p.trim);
  } else {
    body += R(8, 6, 16, 18, p.ink) + R(10, 8, 12, 14, p.skin) + R(9, 6, 14, 6, p.hair) + R(11, 14, 2, 2, p.ink) + R(19, 14, 2, 2, p.ink) + R(14, 19, 5, 2, p.ink);
    if (spec.shape === 'hood') body += R(5, 4, 4, 23, p.light) + R(23, 4, 4, 23, p.light) + R(8, 3, 16, 4, p.light);
    if (spec.shape === 'lab') body += R(9, 12, 5, 3, p.trim) + R(18, 12, 5, 3, p.trim) + R(14, 13, 4, 1, p.ink);
    if (['armor', 'broad'].includes(spec.shape)) body += R(3, 23, 9, 6, p.main) + R(20, 23, 9, 6, p.main);
  }
  switch (spec.tool) {
    case 'slate': body += R(2, 19, 8, 10, p.ink) + R(3, 20, 6, 7, p.accent) + R(4, 21, 4, 1, p.light); break;
    case 'hammer': body += R(27, 8, 2, 21, p.ink) + R(24, 6, 7, 5, p.trim); break;
    case 'case': body += R(22, 23, 8, 7, p.ink) + R(23, 24, 6, 5, p.accent); break;
    case 'rifle': body += R(2, 25, 28, 3, p.ink) + R(4, 26, 21, 1, p.trim); break;
    case 'drone': body += R(23, 5, 7, 5, p.ink) + R(25, 7, 3, 1, p.accent); break;
    case 'cane': body += R(27, 12, 2, 18, p.ink) + R(25, 10, 5, 3, p.trim); break;
    case 'papers': body += R(2, 21, 7, 9, p.light) + R(4, 23, 4, 1, p.ink) + R(3, 26, 5, 1, p.ink); break;
    case 'wheel': body += R(24, 18, 6, 11, p.ink) + R(25, 20, 4, 6, p.trim) + R(26, 21, 2, 4, p.accent); break;
    case 'blade': body += R(26, 13, 2, 16, p.light) + R(24, 26, 6, 2, p.ink); break;
    case 'spear': body += R(27, 8, 2, 22, p.ink) + R(25, 5, 6, 5, p.trim); break;
    case 'relic': body += R(2, 21, 8, 8, p.ink) + R(4, 23, 4, 4, p.trim) + R(5, 24, 2, 2, p.accent); break;
    case 'wrench': body += R(25, 15, 3, 15, p.ink) + R(23, 12, 3, 5, p.trim) + R(28, 12, 3, 5, p.trim); break;
    case 'bundle': body += R(1, 21, 9, 9, p.ink) + R(2, 22, 7, 7, p.accent) + R(3, 20, 5, 2, p.trim); break;
    case 'baton': body += R(27, 11, 2, 19, p.ink) + R(26, 10, 4, 4, p.accent); break;
  }
  body += R(4, 27, 3, 2, p.trim) + R(25, 27, 3, 2, p.trim);
  return svg(32, 32, `${spec.name} portrait`, G('portrait-frame', body));
}

function token(spec, override = null) {
  const p = palette(spec, override); const robot = spec.shape === 'robot';
  let body = R(5, 2, 7, 2, p.ink) + R(4, 4, 9, 7, p.ink) + R(6, 4, 5, 5, robot ? p.main : p.hair) + R(3, 10, 11, 7, p.ink) + R(4, 11, 9, 5, p.main) + R(7, 10, 2, 6, p.accent) + R(4, 17, 3, 2, p.ink) + R(10, 17, 3, 2, p.ink);
  if (spec.shape === 'hood') body += R(3, 3, 2, 9, p.light) + R(12, 3, 2, 9, p.light);
  if (spec.tool === 'rifle') body += R(1, 8, 2, 10, p.trim);
  if (spec.tool === 'hammer') body += R(13, 7, 2, 11, p.trim) + R(12, 6, 4, 3, p.ink);
  if (['staff', 'cane', 'spear', 'baton'].includes(spec.tool)) body += R(14, 5, 1, 14, p.trim);
  if (['slate', 'papers', 'case'].includes(spec.tool)) body += R(1, 10, 3, 6, p.ink) + R(2, 11, 2, 4, p.accent);
  if (spec.tool === 'wheel') body += R(13, 11, 3, 5, p.ink) + R(14, 12, 1, 3, p.trim);
  if (['wrench', 'blade'].includes(spec.tool)) body += R(1, 8, 2, 10, p.trim);
  if (['bundle', 'relic'].includes(spec.tool)) body += R(12, 11, 4, 6, p.ink) + R(13, 12, 2, 4, p.trim);
  if (spec.tool === 'drone') body += R(1, 6, 3, 2, p.accent) + R(2, 5, 1, 1, p.ink);
  if (robot) body += R(6, 5, 1, 1, p.accent) + R(10, 5, 1, 1, p.accent);
  return svg(16, 20, `${spec.name} map token`, G('token', body));
}

function npcPortrait(spec) { return portrait(spec); }
function npcToken(spec) { return token(spec); }

function enemyBattle(enemy, pose = 'idle') {
  const p = enemy.palette; const drone = enemy.family === 'drone';
  if (drone) return droneBattle(enemy, pose);
  if (enemy.family === 'boss') return bossBattle(enemy, pose);
  const down = pose === 'down'; const act = pose === 'act'; const hit = pose === 'hit';
  const x = hit ? 8 : act ? 9 : 7; const y = down ? 29 : hit ? 7 : 5;
  const head = down ? R(21, 29, 8, 6, p.ink) + R(22, 30, 6, 4, p.face) : R(x, y, 9, 8, p.ink) + R(x + 1, y + 1, 7, 6, p.face) + R(x + 5, y + 3, 2, 1, p.eye) + R(x - 1, y - 2, 11, 3, p.armor);
  const torso = down ? R(10, 29, 12, 7, p.ink) + R(11, 30, 10, 5, p.armor) : R(x - 1, y + 8, 13, 13, p.ink) + R(x, y + 9, 11, 11, p.armor) + R(x + 1, y + 10, 2, 9, p.accent);
  const legs = down ? R(2, 34, 10, 3, p.ink) : R(x, y + 20, 5, 11, p.ink) + R(x + 1, y + 21, 3, 9, p.dark) + R(x + 7, y + 20, 5, 11, p.ink) + R(x + 8, y + 21, 3, 9, p.dark) + R(x - 1, y + 30, 7, 3, p.ink) + R(x + 7, y + 30, 7, 3, p.ink);
  const al = down ? R(4, 31, 8, 3, p.ink) : R(x - 4, y + 10, 4, 11, p.ink) + R(x - 3, y + 11, 2, 8, p.armor);
  const ar = down ? R(20, 35, 10, 2, p.ink) : R(x + 11, y + 9, 5, 11, p.ink) + R(x + 12, y + 10, 3, 8, p.armor);
  const weapon = down ? R(2, 38, 23, 1, p.accent) : enemy.weapon === 'shield' ? R(22, act ? 8 : 14, 7, 14, p.ink) + R(23, act ? 9 : 15, 5, 12, p.accent) : R(22, act ? 8 : 13, 3, 22, p.ink) + R(24, act ? 7 : 12, 7, 3, p.accent);
  return svg(32, 40, `${enemy.name} ${pose}`, G('legs', legs) + G('torso', torso) + G('arm-l', al) + G('arm-r', ar) + G('head', head) + G('weapon', weapon));
}

function droneBattle(enemy, pose) {
  const p = enemy.palette; const down = pose === 'down'; const act = pose === 'act'; const hit = pose === 'hit';
  const y = down ? 27 : hit ? 13 : act ? 9 : 11; const x = hit ? 10 : 8;
  const core = R(x, y, 16, 12, p.ink) + R(x + 2, y + 2, 12, 8, p.armor) + R(x + 5, y + 4, 6, 4, p.eye) + R(x + 7, y + 5, 2, 2, p.light);
  const wings = down ? R(2, 34, 8, 3, p.ink) + R(24, 34, 6, 3, p.ink) : R(x - 6, y + 2, 6, 8, p.ink) + R(x - 5, y + 3, 5, 6, p.accent) + R(x + 16, y + 2, 6, 8, p.ink) + R(x + 16, y + 3, 5, 6, p.accent);
  const arms = down ? R(11, 36, 13, 2, p.accent) : R(x - 3, y - 4, 4, 5, p.ink) + R(x + 15, y - 4, 4, 5, p.ink) + R(x - 3, y + 11, 4, 5, p.ink) + R(x + 15, y + 11, 4, 5, p.ink);
  const weapon = down ? '' : enemy.variant === 'hunter' ? R(25, y + 5, 7, 3, p.ink) + R(26, y + 6, 6, 1, p.eye) : R(14, y + 12, 4, 8, p.ink) + R(15, y + 14, 2, 5, p.accent);
  return svg(32, 40, `${enemy.name} ${pose}`, G('legs', wings) + G('torso', core) + G('arm-l', arms) + G('arm-r', '') + G('head', R(x + 4, y - 2, 8, 2, p.ink)) + G('weapon', weapon));
}

function bossBattle(enemy, pose) {
  if (enemy.id === 'strand_reconciled_duelist') return enemyBattle({ ...enemy, family: 'warden', weapon: 'shield' }, pose);
  if (enemy.id === 'ilo9_bound_boss') {
    const p = enemy.palette; const down = pose === 'down'; const y = down ? 22 : pose === 'act' ? 6 : pose === 'hit' ? 10 : 8;
    const cage = R(2, 4, 2, 32, p.accent) + R(28, 4, 2, 32, p.accent) + R(2, 4, 28, 2, p.accent) + R(2, 34, 28, 2, p.accent);
    const crown = R(9, y, 14, 10, p.ink) + R(11, y + 2, 10, 6, p.armor) + R(12, y - 3, 2, 3, p.eye) + R(20, y - 3, 2, 3, p.eye) + R(12, y + 4, 3, 2, p.eye) + R(18, y + 4, 3, 2, p.eye);
    const body = R(11, y + 10, 10, down ? 5 : 12, p.ink) + R(14, y + 11, 4, down ? 3 : 9, p.eye);
    const shackles = R(4, y + 11, 8, 2, p.accent) + R(20, y + 11, 8, 2, p.accent);
    return svg(32, 40, `ILO-9 Bound ${pose}`, G('cage', cage) + G('head', crown) + G('torso', body) + G('weapon', shackles));
  }
  const p = enemy.palette; const down = pose === 'down'; const act = pose === 'act'; const hit = pose === 'hit';
  const x = hit ? 3 : 2; const y = down ? 28 : act ? 4 : 6;
  const legs = down ? R(3, 35, 26, 3, p.ink) : R(x + 4, 26, 6, 12, p.ink) + R(x + 16, 26, 6, 12, p.ink) + R(x + 2, 36, 9, 3, p.accent) + R(x + 15, 36, 10, 3, p.accent);
  const torso = down ? R(8, 29, 19, 7, p.ink) + R(10, 30, 15, 5, p.armor) : R(x + 3, y + 10, 22, 20, p.ink) + R(x + 5, y + 12, 18, 16, p.armor) + R(x + 11, y + 13, 6, 12, p.accent) + R(x + 1, y + 14, 4, 12, p.ink) + R(x + 23, y + 14, 4, 12, p.ink);
  const head = down ? R(1, 31, 8, 6, p.ink) : R(x + 8, y, 12, 11, p.ink) + R(x + 10, y + 2, 8, 7, p.face) + R(x + 15, y + 4, 2, 2, p.eye) + R(x + 7, y - 2, 14, 3, p.accent);
  const al = down ? R(22, 33, 9, 3, p.ink) : R(x - 1, y + 13, 6, 15, p.ink) + R(x, y + 15, 4, 11, p.dark);
  const ar = down ? R(4, 37, 9, 2, p.ink) : R(x + 23, y + 12, 6, 16, p.ink) + R(x + 24, y + 14, 4, 12, p.dark);
  const weapon = down ? R(15, 38, 16, 1, p.eye) : R(26, act ? 4 : 10, 3, 27, p.ink) + R(24, act ? 3 : 9, 8, 4, p.eye);
  const lattice = enemy.id === 'strand_perpetual_phase2' && !down ? G('ownership-lattice', R(0, 2, 32, 2, p.eye) + R(0, 6, 3, 9, p.accent) + R(29, 6, 3, 9, p.accent) + R(0, 19, 3, 9, p.accent) + R(29, 19, 3, 9, p.accent) + R(8, 0, 2, 7, p.accent) + R(22, 0, 2, 7, p.accent)) : '';
  return svg(32, 40, `${enemy.name} ${pose}`, lattice + G('legs', legs) + G('torso', torso) + G('arm-l', al) + G('arm-r', ar) + G('head', head) + G('weapon', weapon));
}

const enemyDefs = [];
for (const era of Object.keys(eras)) {
  const e = eras[era];
  enemyDefs.push(
    { id: `drone_sentry_${era}`, name: `${era} Sentry Drone`, era, family: 'drone', variant: 'sentry', palette: { ink: e.ink, armor: e.cloth, accent: e.accent, eye: e.hot, light: e.light, dark: '#344052', face: e.light } },
    { id: `drone_hunter_${era}`, name: `${era} Hunter Drone`, era, family: 'drone', variant: 'hunter', palette: { ink: e.ink, armor: e.cloth, accent: e.hot, eye: e.accent, light: e.light, dark: '#344052', face: e.light } },
    { id: `warden_${era}`, name: `${era} Warden`, era, family: 'warden', weapon: era === '2031' ? 'shield' : 'lance', palette: { ink: e.ink, armor: e.cloth, accent: e.accent, eye: e.hot, light: e.light, dark: '#344052', face: era === '2312' ? '#D8E8EA' : '#A87557' } },
  );
}
enemyDefs.push(
  { id: 'construct_grafted', name: 'Grafted Construct', era: '2148', family: 'construct', weapon: 'lance', palette: { ink: '#17151B', armor: '#59636D', accent: '#993C1D', eye: '#5EF1D0', light: '#D1D5D0', dark: '#303A42', face: '#83909B' } },
  { id: 'echo_temporal', name: 'Unmoored Echo', era: null, family: 'construct', weapon: 'shield', palette: { ink: '#170E24', armor: '#534AB7', accent: '#4FD1E6', eye: '#F1E8FF', light: '#FFFFFF', dark: '#312346', face: '#A787D4' } },
  { id: 'ilo9_bound_boss', name: 'ILO-9 Bound', era: '2148', family: 'boss', weapon: 'lance', palette: { ink: '#16131B', armor: '#3F4655', accent: '#993C1D', eye: '#A87BE5', light: '#D7DCE1', dark: '#252A34', face: '#707B88' } },
  { id: 'strand_perpetual_phase1', name: 'Strand Perpetual — Shareholder Form', era: '2312', family: 'boss', weapon: 'lance', palette: { ink: '#111827', armor: '#F1EFE8', accent: '#C9A227', eye: '#4FD1E6', light: '#FFFFFF', dark: '#52606D', face: '#D4A17B' } },
  { id: 'strand_perpetual_phase2', name: 'Strand Perpetual — Majority Form', era: '2312', family: 'boss', weapon: 'lance', palette: { ink: '#10121A', armor: '#283348', accent: '#4FD1E6', eye: '#EF9F27', light: '#FFFFFF', dark: '#192034', face: '#8DA1B3' } },
  { id: 'strand_reconciled_duelist', name: 'Strand Perpetual — Reconciled Duel', era: '2312', family: 'boss', weapon: 'lance', palette: { ink: '#1B1E28', armor: '#4B5570', accent: '#1D9E75', eye: '#C9A227', light: '#F6F1E7', dark: '#2A3042', face: '#C9A07A' } },
);

const manifest = [];
const poses = ['idle', 'act', 'hit', 'down'];
async function emit(relative, data) {
  const destination = path.join(artRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data, 'utf8');
}

for (const [id, spec] of Object.entries(people)) {
  const files = {};
  for (const pose of poses) {
    const rel = `characters/${id}/${id}_${pose}.svg`; files[pose] = rel;
    await emit(rel, personBattle(spec, pose));
  }
  files.battle = files.idle;
  files.portrait = `characters/${id}/${id}_portrait.svg`;
  files.token = `characters/${id}/${id}_token.svg`;
  await emit(files.portrait, portrait(spec)); await emit(files.token, token(spec));
  manifest.push({ id, kind: 'party', name: spec.name, era: null, site: null, guideSection: 'Characters and enemies — party deliverables', description: `${spec.role}; left-facing party silhouette, with separately drawn action, impact, and grounded defeat poses.`, files });
  for (const [era, eraPalette] of Object.entries(eras)) {
    const echoFiles = {};
    for (const pose of poses) {
      const rel = `characters/${id}/echo/${era}/${id}_echo_${era}_${pose}.svg`; echoFiles[pose] = rel;
      await emit(rel, personBattle(spec, pose, eraPalette, true));
    }
    echoFiles.battle = echoFiles.idle;
    manifest.push({ id: `${id}_echo_${era}`, kind: 'party_echo', name: `${spec.name} Echo (${era})`, era, site: null, guideSection: 'Characters and enemies — Echo versions', description: `${spec.role}, displaced into the explicit ${era} palette with hand-placed chromatic pixel offsets and four distinct poses; left-facing.`, files: echoFiles });
  }
}

for (const [id, spec] of Object.entries(npcs)) {
  const files = { portrait: `characters/npcs/${id}_portrait.svg`, token: `characters/npcs/${id}_token.svg` };
  await emit(files.portrait, npcPortrait(spec)); await emit(files.token, npcToken(spec));
  manifest.push({ id, kind: 'npc', name: spec.name, era: spec.era, site: spec.site, guideSection: 'Characters and enemies — dialogue portraits and map tokens', description: spec.role, files, ...(spec.proposed ? { proposed: true } : {}) });
}

for (const enemy of enemyDefs) {
  const files = {};
  for (const pose of poses) {
    const rel = `enemies/${enemy.id}/${enemy.id}_${pose}.svg`; files[pose] = rel;
    await emit(rel, enemyBattle(enemy, pose));
  }
  files.battle = files.idle;
  const familyText = enemy.family === 'drone' ? 'rotational wing symmetry and a bright machine eye' : enemy.family === 'warden' ? 'era-specific human armor and a paid-enforcer visor' : enemy.id === 'construct_grafted' ? 'a human stance interrupted by machine plating' : enemy.id === 'echo_temporal' ? 'a violet temporal shell readable without filters' : 'an oversized executive chassis with a crown-like bar';
  manifest.push({ id: enemy.id, kind: enemy.family === 'boss' ? 'boss' : 'enemy', name: enemy.name, era: enemy.era, site: enemy.id.includes('strand') ? 'meridian' : null, guideSection: 'Characters and enemies — enemy families', description: `${familyText}; right-facing enemy silhouette with separately drawn idle, act, hit, and down states.`, files });
}

manifest.sort((a, b) => a.id.localeCompare(b.id));
await emit('manifests/characters.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifest.length} manifest entries and ${manifest.reduce((n, entry) => n + new Set(Object.values(entry.files)).size, 0)} SVG files.`);
