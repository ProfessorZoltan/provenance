import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(repo, 'public', 'art', 'locations', 'waypoints');
const manifestFile = join(repo, 'public', 'art', 'manifests', 'waypoints.json');

const palettes = {
  2031: { sky: '#F6F1E7', far: '#B8DCCF', light: '#FFF9E9', main: '#1D9E75', accent: '#EF9F27', dark: '#2C2C2A', ground: '#D9C9A8', shade: '#8EAD98' },
  2064: { sky: '#0C1F3A', far: '#173B60', light: '#85B7EB', main: '#356C9F', accent: '#C9A227', dark: '#050A12', ground: '#172A43', shade: '#25496E' },
  2148: { sky: '#2C294E', far: '#534AB7', light: '#AAA5B8', main: '#3B6D11', accent: '#C65D2E', dark: '#1C2119', ground: '#4B443F', shade: '#888780' },
  2312: { sky: '#DDF8FC', far: '#B8E9F0', light: '#FFFFFF', main: '#4FD1E6', accent: '#176779', dark: '#162C33', ground: '#F1EFE8', shade: '#A9C9CE' },
};

const waypointRows = [
  [2031, 'Halden Market', 'settlement', 'Canvas stalls, port produce, and cheap machine parts at the hopeful waterfront.'],
  [2031, 'Founders Bar', 'faction-hub', 'A converted machine shop where Choir engineers gather beneath a hand-built signal halo.'],
  [2031, 'Basin Work Camp', 'settlement', 'Survey trailers and a half-raised datacenter frame shelter the Basin construction crews.'],
  [2031, 'Coastal Highway', 'wilds', 'A sunlit cliff road scattered with salvage and grounded drone prototypes.'],
  [2031, 'Tolliver Bakery', 'ripple-site', 'A brick corner bakery whose ovens and family sign become a fixed point in the timeline.'],
  [2064, 'Undercity Bazaar', 'settlement', 'A dense market threaded under transit rails with illicit Signal gear in gold-lit booths.'],
  [2064, 'Senate Annex', 'faction-hub', 'A severe mirrored annex where Commons reform staffers work behind security glass.'],
  [2064, 'Meridian Distribution Hub', 'ruin', 'A shuttered corporate warehouse of conveyors, cargo stacks, and armed loading drones.'],
  [2064, 'Migrant Causeway', 'wilds', 'An elevated pedestrian causeway of temporary shelters, patrol gates, and recruitment marks.'],
  [2064, 'Glass Quarter', 'settlement', 'A polished canyon of mirrored towers and a quiet civic plaza.'],
  [2148, 'The Stacks', 'settlement', 'A rooftop trading post stitched across drowned buildings with ladders and sailcloth.'],
  [2148, 'Ash Camp', 'faction-hub', 'Cinder barricades, a stripped armored carrier, and Dax’s old forge fires.'],
  [2148, 'Server Graveyard', 'ruin', 'Sand-buried racks lean like headstones around a fractured ILO-9 relay.'],
  [2148, 'The Fens', 'wilds', 'Fog, black water, reeds, and half-submerged salvage platforms conceal frequent ambushes.'],
  [2148, 'Tolliver Safehouse', 'ripple-site', 'A hidden refuge built into the bakery shell if the family business survived 2031.'],
  [2312, 'Enclave 7 Commissary', 'settlement', 'A perfectly ordered ration hall of allocation gates and sealed goods lockers.'],
  [2312, 'Kell Village', 'faction-hub', 'The last free village climbs a snowy slope in handmade terraces below Kell.'],
  [2312, 'Allocation Office', 'ruin', 'The Auditor’s abandoned workplace: symmetric service desks, audit terminals, and Warden gates.'],
  [2312, 'Cooling Perimeter', 'wilds', 'Sterile cooling towers and cyan service pipes cross a patrolled white plain.'],
  [2312, 'Strand Memorial', 'ripple-site', 'A controlled civic memorial whose final form reflects the timeline’s Sync.'],
];

const slug = (value) => value.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const bases = waypointRows.map(([era, name, type, description]) => ({
  id: `${era}_${slug(name)}`, era, name, type, description, variant: null,
}));

const variants = [
  { base: '2031_tolliver_bakery', suffix: 'saved', name: 'Tolliver Bakery — Saved', condition: 'Bakery saved in 2031', description: 'Inferred ripple visual: the bakery is protected, busy, and marked by a green family pennant.', variant: 'saved' },
  { base: '2031_tolliver_bakery', suffix: 'burned', name: 'Tolliver Bakery — Burned', condition: 'Bakery not saved in 2031', description: 'Inferred ripple visual: the roof and oven are fire-damaged, closing the later safehouse branch.', variant: 'burned' },
  { base: '2148_tolliver_safehouse', suffix: 'present', name: 'Tolliver Safehouse — Present', condition: 'Tolliver Bakery was saved in 2031', description: 'Inferred ripple visual: lamps, barricades, and an open cellar reveal the active refuge.', variant: 'present' },
  { base: '2148_tolliver_safehouse', suffix: 'absent', name: 'Tolliver Safehouse — Absent', condition: 'Tolliver Bakery was not saved in 2031', description: 'Inferred ripple visual: only a collapsed, vine-choked bakery shell remains.', variant: 'absent' },
  { base: '2312_kell_village', suffix: 'armed_resistance', name: 'Kell Village — Armed Resistance', condition: 'Arm the resistance in 2148', description: 'Inferred ripple visual: watchtowers, signal flags, and reinforced Commons barricades defend the terraces.', variant: 'armedResistance' },
  { base: '2312_kell_village', suffix: 'let_it_fall', name: 'Kell Village — Let It Fall', condition: 'Let the resistance fall in 2148', description: 'Inferred ripple visual: empty terraces and a dismantled watch post show the resistance’s absence.', variant: 'letItFall' },
  { base: '2312_enclave_7_commissary', suffix: 'open', name: 'Enclave 7 Commissary — Open', condition: 'High open Ownership in 2312', description: 'Inferred ripple visual: allocation gates retract and stocked shelves open onto a shared plaza.', variant: 'open' },
  { base: '2312_enclave_7_commissary', suffix: 'allocated', name: 'Enclave 7 Commissary — Allocated', condition: 'Private Ownership remains dominant in 2312', description: 'Inferred ripple visual: sealed lockers and single-file allocation lanes preserve strict rationing.', variant: 'allocated' },
  { base: '2312_strand_memorial', suffix: 'museum', name: 'Strand Memorial — Museum', condition: 'High pro-AI Sync in 2312', description: 'Inferred mapping of the guide’s museum state: polished exhibits preserve Strand’s official history.', variant: 'museum' },
  { base: '2312_strand_memorial', suffix: 'ruin', name: 'Strand Memorial — Ruin', condition: 'Low anti-AI Sync in 2312', description: 'Inferred mapping of the guide’s ruin state: the monument is shattered and its archive dark.', variant: 'ruin' },
  { base: '2312_strand_memorial', suffix: 'shrine', name: 'Strand Memorial — Shrine', condition: 'Mid-range Sync in 2312', description: 'Inferred mapping of the guide’s shrine state: citizens surround the old monument with handmade lights.', variant: 'shrine' },
].map((v) => {
  const parent = bases.find((b) => b.id === v.base);
  return { ...parent, ...v, id: `${v.base}_${v.suffix}`, proposed: true };
});

const scenes = [...bases, ...variants];
const battleTypes = new Set(['ruin', 'wilds']);

const R = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const P = (points, fill, extra = '') => `<polygon points="${points}" fill="${fill}"${extra}/>`;
const L = (x1, y1, x2, y2, stroke, width = 2, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${extra}/>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;

function rootSvg(body, viewBox = '0 0 320 180', label = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges" role="img" aria-label="${label}">${body}</svg>\n`;
}

function sky(scene, p) {
  const dusk = scene.era === 2148;
  const night = scene.era === 2064;
  let s = R(0, 0, 320, 180, p.sky) + R(0, 48, 320, 46, p.far, ' opacity="0.28"');
  if (scene.era === 2031) s += C(264, 31, 13, p.accent) + R(25, 29, 32, 4, p.light) + R(35, 25, 14, 4, p.light) + R(118, 47, 42, 3, p.light);
  if (night) s += C(272, 25, 9, p.accent) + R(22, 24, 2, 2, p.light) + R(69, 42, 2, 2, p.light) + R(157, 18, 2, 2, p.light) + R(206, 50, 3, 2, p.light);
  if (dusk) s += C(260, 38, 12, p.accent, ' opacity="0.8"') + R(0, 71, 320, 15, p.accent, ' opacity="0.16"') + R(56, 25, 2, 11, p.shade);
  if (scene.era === 2312) s += C(267, 29, 10, p.light) + R(30, 22, 46, 2, p.main, ' opacity="0.35"') + R(111, 39, 68, 2, p.main, ' opacity="0.25"');
  return s;
}

function commonDistant(scene, p) {
  const id = scene.base ?? scene.id;
  if (id.includes('coastal_highway') || id.includes('fens')) return P('0,83 58,70 106,79 160,61 223,80 320,66 320,112 0,112', p.dark, ' opacity="0.58"');
  if (id.includes('kell_village')) return P('0,91 52,44 86,72 130,29 183,77 226,42 320,88 320,115 0,115', p.shade) + P('98,54 130,29 156,62 137,54 124,57', p.light);
  if (id.includes('cooling_perimeter')) return R(27, 42, 22, 66, p.light) + P('27,42 49,42 54,30 22,30', p.shade) + R(244, 36, 28, 72, p.light) + P('244,36 272,36 278,22 238,22', p.shade);
  const heights = [30, 52, 38, 66, 44, 58, 34, 48, 62, 40];
  return heights.map((h, i) => R(i * 34 - 8, 108 - h, 25, h, i % 2 ? p.far : p.shade, ' opacity="0.72"')).join('');
}

function windows(x, y, cols, rows, p, gapX = 11, gapY = 10) {
  let s = '';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) s += R(x + i * gapX, y + j * gapY, 5, 4, (i + j) % 3 === 0 ? p.accent : p.light);
  return s;
}

function sceneArt(scene, p) {
  const id = scene.base ?? scene.id;
  const v = scene.variant;
  let mid = '', fore = '';

  if (id.includes('halden_market')) {
    mid = R(18, 84, 284, 12, p.dark) + [24, 86, 148, 210].map((x, i) => R(x, 96, 54, 31, i % 2 ? p.light : p.main) + P(`${x},96 ${x+54},96 ${x+46},84 ${x+8},84`, i % 2 ? p.accent : p.light)).join('') + R(246, 53, 8, 31, p.dark) + R(254, 57, 35, 7, p.accent);
    fore = R(0, 128, 320, 52, p.ground) + R(0, 149, 320, 5, p.main) + [35, 102, 166, 235].map(x => R(x, 119, 22, 10, p.dark) + R(x+3, 116, 16, 4, p.accent)).join('');
  } else if (id.includes('founders_bar')) {
    mid = R(57, 58, 208, 71, p.dark) + R(64, 64, 194, 57, p.ground) + R(78, 76, 55, 45, p.main) + R(150, 74, 88, 8, p.accent) + C(194, 98, 17, p.main) + C(194, 98, 9, p.light) + C(194, 98, 4, p.accent);
    fore = R(0, 129, 320, 51, p.ground) + R(36, 133, 248, 6, p.dark) + R(75, 145, 12, 22, p.dark) + R(233, 145, 12, 22, p.dark) + L(87, 157, 233, 157, p.dark, 3);
  } else if (id.includes('basin_work_camp')) {
    mid = R(25, 90, 95, 38, p.light) + R(34, 98, 25, 18, p.main) + R(66, 97, 39, 8, p.accent) + R(147, 51, 6, 77, p.dark) + L(150, 54, 241, 72, p.dark, 5) + L(221, 67, 221, 116, p.dark, 2) + R(182, 89, 88, 39, p.shade) + windows(191, 97, 6, 2, p, 12, 10);
    fore = R(0, 128, 320, 52, p.ground) + [18, 136, 278].map(x => R(x, 137, 24, 8, p.accent) + R(x+8, 145, 8, 10, p.dark)).join('') + L(0, 164, 320, 153, p.dark, 2);
  } else if (id.includes('coastal_highway')) {
    mid = P('0,91 82,78 147,91 205,70 320,86 320,118 0,118', p.main) + R(238, 62, 8, 40, p.dark) + R(228, 61, 28, 5, p.accent) + L(242, 66, 270, 77, p.dark, 2);
    fore = P('0,121 320,99 320,180 0,180', p.dark) + P('0,130 320,108 320,140 0,163', p.ground) + [20, 92, 164, 236].map(x => P(`${x},146 ${x+32},144 ${x+24},149 ${x-8},151`, p.light)).join('') + R(224, 131, 28, 7, p.main) + R(230, 125, 11, 6, p.accent) + C(231, 140, 5, p.dark) + C(249, 138, 5, p.dark);
  } else if (id.includes('tolliver_bakery')) {
    const burned = v === 'burned';
    mid = R(61, 64, 198, 65, burned ? p.dark : '#B96B45') + P('52,67 268,67 246,47 75,47', burned ? p.dark : p.accent) + R(78, 78, 47, 51, p.light) + R(169, 83, 61, 32, p.dark) + R(178, 89, 43, 17, burned ? p.dark : p.accent) + R(135, 73, 24, 56, p.dark) + R(139, 82, 16, 47, burned ? '#3A2925' : p.light) + R(220, 28, 15, 38, p.dark);
    if (v === 'saved') mid += R(67, 52, 13, 15, p.main) + P('80,52 98,59 80,63', p.main) + R(177, 108, 45, 4, p.main);
    if (burned) mid += P('52,67 87,43 114,64 150,38 188,64 216,44 268,67', p.dark) + R(91, 75, 8, 27, p.accent) + R(234, 21, 8, 18, p.shade);
    fore = R(0, 129, 320, 51, p.ground) + R(39, 142, 242, 5, p.dark) + [25, 289].map(x => R(x, 117, 4, 28, p.main)).join('');
  } else if (id.includes('undercity_bazaar')) {
    mid = R(0, 40, 320, 16, p.dark) + R(0, 56, 320, 7, p.accent) + [12, 72, 133, 196, 257].map((x,i) => R(x, 80, 50, 49, i%2?p.main:p.shade) + P(`${x},80 ${x+50},80 ${x+43},68 ${x+7},68`, p.accent) + windows(x+8, 91, 3, 2, p, 13, 12)).join('');
    fore = R(0, 129, 320, 51, p.ground) + R(0, 151, 320, 3, p.accent) + [44, 112, 184, 267].map(x => C(x, 140, 4, p.light) + R(x-2, 144, 4, 12, p.dark)).join('');
  } else if (id.includes('senate_annex')) {
    mid = P('52,65 160,37 268,65 250,74 70,74', p.accent) + R(67, 72, 186, 57, p.light) + [78,110,142,174,206,238].map(x => R(x, 78, 9, 51, p.dark)).join('') + R(93, 87, 134, 29, p.main) + windows(101, 93, 9, 2, p, 14, 10);
    fore = R(0, 129, 320, 51, p.ground) + P('38,180 282,180 236,130 84,130', p.shade) + [84,236].map(x => R(x, 128, 8, 36, p.accent)).join('');
  } else if (id.includes('meridian_distribution_hub')) {
    mid = R(24, 55, 272, 74, p.dark) + R(33, 64, 254, 55, p.main) + [42,106,170,234].map((x,i) => R(x, 76, 47, 43, i===2?p.dark:p.shade) + R(x+5, 82, 37, 5, p.accent)).join('') + R(18, 47, 284, 8, p.accent) + R(197, 83, 8, 27, p.light);
    fore = R(0, 129, 320, 51, p.ground) + [11,56,245,287].map((x,i) => R(x, 142-i%2*7, 32, 22, i%2?p.accent:p.main) + L(x, 147, x+32, 147, p.dark, 2)).join('') + R(93, 148, 139, 4, p.accent);
  } else if (id.includes('migrant_causeway')) {
    mid = R(0, 85, 320, 12, p.dark) + [25,92,159,226,293].map(x => R(x, 97, 7, 32, p.shade)).join('') + [38, 117, 196, 260].map((x,i)=> P(`${x},84 ${x+45},84 ${x+38},66 ${x+8},66`, i%2?p.accent:p.main) + R(x+7,72,31,12,p.dark)).join('') + R(0, 48, 320, 7, p.accent);
    fore = R(0, 129, 320, 51, p.ground) + R(0, 136, 320, 12, p.shade) + [16,304].map(x => R(x, 112, 5, 43, p.accent)).join('') + [65,151,244].map(x=>R(x,150,35,5,p.light)).join('');
  } else if (id.includes('glass_quarter')) {
    mid = P('28,129 55,30 103,30 116,129', p.main) + P('116,129 144,51 193,51 206,129', p.light) + P('205,129 230,24 286,24 300,129', p.shade) + [49,65,81,149,165,181,231,249,267].map(x => L(x, 40, x+15, 120, p.accent, 2)).join('');
    fore = R(0, 129, 320, 51, p.ground) + C(160, 146, 14, p.main) + C(160, 146, 7, p.light) + R(158, 147, 4, 25, p.accent) + L(0, 165, 320, 165, p.light, 2);
  } else if (id.includes('the_stacks')) {
    mid = [2,63,126,190,253].map((x,i)=>R(x,74-i%2*13,58,68+i%2*13,i%2?p.dark:p.shade)+windows(x+8,84-i%2*13,3,4,p,15,11)).join('') + L(15,69,286,43,p.accent,3) + [35,112,190,266].map(x=>R(x,48,4,39,p.dark)).join('') + P('48,65 101,65 93,50 56,50',p.main)+P('160,54 225,54 214,37 172,37',p.accent);
    fore = R(0, 137, 320, 43, p.ground) + R(0, 142, 320, 6, p.dark) + [22,74,129,214,276].map(x=>R(x,126,31,12,p.main)).join('');
  } else if (id.includes('ash_camp')) {
    mid = R(42, 83, 218, 47, p.dark) + P('58,83 83,61 226,61 248,83', p.shade) + R(72,70,52,26,p.accent) + R(132,69,78,12,p.dark) + [64,112,220].map(x=>C(x,130,15,p.dark)+C(x,130,7,p.shade)).join('') + R(270,52,6,78,p.dark) + P('276,55 301,65 276,74',p.accent);
    fore = R(0, 130, 320, 50, p.ground) + [24,288].map(x=>C(x,151,9,p.accent)+P(`${x-5},153 ${x},133 ${x+5},153`,p.light)).join('') + P('0,174 76,154 158,173 239,151 320,170 320,180 0,180',p.dark);
  } else if (id.includes('server_graveyard')) {
    mid = [28,77,127,177,227,277].map((x,i)=>`<g transform="rotate(${i%2?7:-8} ${x} 100)">${R(x-13,55+i%3*8,27,75-i%3*8,p.dark)}${[0,1,2,3].map(j=>R(x-8,65+j*13,17,5,j===2?p.accent:p.main)).join('')}</g>`).join('') + C(160,86,16,p.accent)+C(160,86,9,p.dark)+R(157,66,6,40,p.light);
    fore = P('0,126 65,116 125,132 191,119 248,130 320,115 320,180 0,180',p.ground) + [19,98,210,289].map(x=>L(x,130,x+15,165,p.shade,3)).join('');
  } else if (id.includes('the_fens')) {
    mid = R(0,99,320,31,p.main) + [12,42,68,104,145,188,231,271,303].map((x,i)=>L(x,104,x+(i%2?7:-5),70+i%3*8,p.dark,3)+L(x,91,x+10,82,p.main,2)).join('') + [72,205].map(x=>R(x,86,45,8,p.shade)+R(x+7,73,5,13,p.dark)).join('');
    fore = R(0,130,320,50,p.dark) + [0,65,140,220].map((x,i)=>P(`${x},151 ${x+54},143 ${x+76},160 ${x+28},169`,i%2?p.shade:p.ground)).join('') + [32,116,188,282].map(x=>R(x,124,3,35,p.main)).join('');
  } else if (id.includes('tolliver_safehouse')) {
    const absent = v === 'absent';
    mid = absent
      ? R(69,88,45,41,p.dark)+R(206,78,43,51,p.dark)+P('54,88 101,55 137,84 165,49 263,78 246,91 201,68 168,93 119,71',p.shade)+[91,143,191,235].map(x=>L(x,74,x-18,126,p.main,5)).join('')
      : R(58,65,204,64,p.dark)+P('47,69 273,69 239,45 78,45',p.shade)+R(77,78,54,51,p.main)+R(143,82,30,47,p.dark)+R(149,91,18,38,p.accent)+R(191,80,53,23,p.main)+R(198,86,39,5,p.light)+R(80,53,10,12,p.accent);
    if (v === 'present') mid += [42,276].map(x=>R(x,92,7,37,p.accent)).join('') + R(104,105,105,5,p.light);
    fore = R(0,129,320,51,p.ground) + P('0,170 58,150 108,166 188,148 255,164 320,145 320,180 0,180',p.dark) + [19,293].map(x=>R(x,117,3,36,p.main)).join('');
  } else if (id.includes('enclave_7_commissary')) {
    const open = v === 'open';
    mid = R(42,55,236,74,p.light)+R(52,65,216,12,p.main)+[62,111,160,209].map((x,i)=>R(x,85,39,44,open&&i%2===0?p.light:p.dark)+R(x+7,91,25,5,p.main)+R(x+7,103,25,4,p.accent)).join('')+R(149,36,22,19,p.main)+C(160,45,6,p.light);
    if (v === 'allocated') mid += [104,153,202].map(x=>R(x,79,4,50,p.accent)).join('');
    if (open) mid += R(55,119,210,10,p.main)+[83,133,183,233].map(x=>R(x,111,16,8,p.accent)).join('');
    fore = R(0,129,320,51,p.ground)+[42,98,154,210,266].map(x=>L(x,134,x,180,p.shade,2)).join('')+R(18,151,284,3,p.main);
  } else if (id.includes('kell_village')) {
    const fallen = v === 'letItFall';
    mid = [30,92,157,224].map((x,i)=>R(x,87-i%2*16,52,42+i%2*16,fallen&&i===2?p.shade:p.light)+P(`${x-7},${88-i%2*16} ${x+26},${61-i%2*16} ${x+59},${88-i%2*16}`,fallen&&i===2?p.dark:p.main)+R(x+21,106-i%2*16,11,23,p.dark)).join('');
    if (v === 'armedResistance') mid += R(278,51,6,78,p.dark)+P('284,51 308,61 284,71',p.accent)+R(8,87,12,42,p.dark)+R(300,91,12,38,p.dark);
    if (fallen) mid += L(230,84,283,119,p.dark,6)+P('247,97 277,96 268,85',p.accent);
    fore = P('0,132 63,121 119,139 176,123 238,139 320,119 320,180 0,180',p.ground)+[14,84,147,217,286].map(x=>R(x,143,25,7,p.shade)).join('');
  } else if (id.includes('allocation_office')) {
    mid = R(29,52,262,77,p.light)+R(39,61,242,12,p.main)+[51,98,145,192,239].map((x,i)=>R(x,79,34,50,i===2?p.dark:p.shade)+R(x+5,87,24,6,p.main)+R(x+7,103,20,3,p.accent)).join('')+R(145,31,30,21,p.main)+R(155,36,10,11,p.light);
    fore = R(0,129,320,51,p.ground)+[32,90,148,206,264].map(x=>R(x,143,24,15,p.light)+R(x+9,158,6,17,p.dark)).join('')+R(0,173,320,7,p.main);
  } else if (id.includes('cooling_perimeter')) {
    mid = [66,139,215].map((x,i)=>R(x,68-i%2*12,39,61+i%2*12,p.light)+P(`${x-4},68 ${x+43},68 ${x+36},52 ${x+3},52`,p.shade)+R(x+8,83-i%2*8,23,36,p.main)).join('') + L(0,107,320,107,p.main,7)+[38,115,192,270].map(x=>R(x,93,6,36,p.dark)).join('');
    fore = R(0,129,320,51,p.ground)+R(0,153,320,5,p.main)+[24,296].map(x=>R(x,117,5,42,p.accent)).join('')+R(118,137,84,8,p.dark)+R(142,132,36,5,p.main);
  } else if (id.includes('strand_memorial')) {
    if (v === 'ruin') {
      mid = R(79,86,37,43,p.shade)+R(207,79,34,50,p.shade)+P('67,86 103,45 133,80 158,42 251,80 234,92 202,68 173,93 130,67',p.dark)+C(160,65,18,p.shade)+P('148,58 175,50 166,82 142,77',p.dark);
    } else {
      mid = R(62,68,196,61,p.light)+[72,108,200,236].map(x=>R(x,75,9,54,p.shade)).join('')+R(136,84,48,45,p.main)+C(160,67,17,p.accent)+R(153,58,14,39,p.dark)+R(145,92,30,37,p.dark);
      if (v === 'museum') mid += R(84,89,31,22,p.main)+R(205,89,31,22,p.main)+R(89,94,21,3,p.light)+R(210,94,21,3,p.light);
      if (v === 'shrine') mid += [87,105,124,196,215,233].map((x,i)=>C(x,116-i%2*4,4,p.accent)+R(x-2,120-i%2*4,4,9,p.dark)).join('');
    }
    fore = R(0,129,320,51,p.ground)+C(160,144,9,p.main)+[34,286].map(x=>R(x,115,4,42,p.accent)).join('')+L(18,163,302,163,p.shade,2);
  }
  return { mid, fore };
}

function battleArt(scene, p, art) {
  const id = scene.id;
  let hazards = '';
  if (id.includes('coastal_highway')) hazards = R(247,119,35,8,p.main)+C(255,132,6,p.dark)+C(275,132,6,p.dark);
  if (id.includes('distribution_hub')) hazards = [20,266].map(x=>R(x,109,34,23,p.accent)+L(x,117,x+34,117,p.dark,2)).join('');
  if (id.includes('migrant_causeway')) hazards = R(18,105,6,32,p.accent)+R(296,105,6,32,p.accent);
  if (id.includes('server_graveyard')) hazards = R(16,100,18,33,p.dark)+R(286,96,18,37,p.dark);
  if (id.includes('the_fens')) hazards = [22,294].map(x=>L(x,135,x-7,105,p.main,4)).join('');
  if (id.includes('allocation_office')) hazards = R(12,105,30,28,p.light)+R(278,105,30,28,p.light);
  if (id.includes('cooling_perimeter')) hazards = R(0,102,320,6,p.main)+R(25,108,6,30,p.dark)+R(289,108,6,30,p.dark);
  return art.mid + R(0, 103, 320, 77, p.ground) + R(0, 127, 320, 4, p.shade) + R(58, 144, 204, 3, p.dark, ' opacity="0.45"') + hazards;
}

function iconArt(scene, p) {
  const id = scene.base ?? scene.id;
  let body;
  if (id.includes('market') || id.includes('bazaar')) body = P('1,7 15,7 13,3 3,3',p.accent)+R(3,7,10,7,p.main)+R(7,9,2,5,p.light);
  else if (id.includes('bar')) body = R(2,4,12,10,p.dark)+C(8,8,4,p.main)+C(8,8,2,p.light);
  else if (id.includes('camp')) body = P('1,13 8,3 15,13',p.accent)+R(7,8,2,5,p.dark);
  else if (id.includes('highway') || id.includes('causeway')) body = P('5,15 7,1 9,1 11,15',p.dark)+R(7,4,2,3,p.light)+R(8,10,2,3,p.light);
  else if (id.includes('bakery') || id.includes('safehouse')) body = R(3,6,10,8,p.light)+P('2,6 8,1 14,6',p.accent)+R(7,9,3,5,p.dark);
  else if (id.includes('senate')) body = P('1,6 8,1 15,6',p.accent)+R(2,7,12,2,p.light)+[3,7,11].map(x=>R(x,9,2,5,p.dark)).join('');
  else if (id.includes('distribution')) body = R(1,4,14,10,p.dark)+[3,8,13].map(x=>R(x,7,2,4,p.accent)).join('');
  else if (id.includes('glass')) body = P('2,14 5,2 9,2 10,14',p.main)+P('9,14 11,5 14,5 15,14',p.light);
  else if (id.includes('stacks')) body = [1,6,11].map((x,i)=>R(x,5-i%2*3,4,10+i%2*3,i%2?p.accent:p.dark)).join('');
  else if (id.includes('graveyard')) body = [2,7,12].map((x,i)=>`<g transform="rotate(${i%2?8:-8} ${x} 8)">${R(x,2+i,3,13-i,p.dark)}${R(x+1,4+i,1,2,p.accent)}</g>`).join('');
  else if (id.includes('fens')) body = R(0,10,16,6,p.dark)+[2,6,10,14].map(x=>L(x,12,x-1,3,p.main,2)).join('');
  else if (id.includes('commissary')) body = R(2,2,12,12,p.light)+R(3,4,10,3,p.main)+[4,8,12].map(x=>R(x,8,2,5,p.dark)).join('');
  else if (id.includes('kell')) body = P('0,11 5,4 8,8 12,1 16,11',p.shade)+R(4,10,8,5,p.light)+P('3,10 8,6 13,10',p.main);
  else if (id.includes('allocation')) body = R(2,2,12,12,p.light)+R(4,4,8,2,p.main)+R(4,8,5,1,p.dark)+R(4,11,7,1,p.dark);
  else if (id.includes('cooling')) body = [2,9].map(x=>R(x,5,5,10,p.light)+P(`${x},5 ${x+5},5 ${x+6},2 ${x-1},2`,p.shade)).join('');
  else body = R(3,7,10,7,p.light)+C(8,5,4,p.accent)+R(7,4,2,8,p.dark);
  return R(0,0,16,16,p.sky)+body;
}

function writeSvg(file, body, viewBox, label) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, rootSvg(body, viewBox, label));
}

// Regenerate owned filenames without deleting any user-added artwork.
mkdirSync(out, { recursive: true });

const manifest = scenes.map((scene) => {
  const p = palettes[scene.era];
  const dir = join(out, scene.id);
  const skyLayer = sky(scene, p);
  const distantLayer = commonDistant(scene, p);
  const art = sceneArt(scene, p);
  const layers = { sky: skyLayer, distant: distantLayer, midground: art.mid, foreground: art.fore };
  const files = {};
  for (const [key, body] of Object.entries(layers)) {
    const file = join(dir, `${key}.svg`);
    writeSvg(file, `<g data-layer="${key}">${body}</g>`, '0 0 320 180', `${scene.name}, ${key} layer`);
    files[key] = relative(join(repo, 'public', 'art'), file).replaceAll('\\', '/');
  }
  const hub = join(dir, 'hub.svg');
  writeSvg(hub, `<g data-layer="sky">${skyLayer}</g><g data-layer="distant">${distantLayer}</g><g data-layer="midground">${art.mid}</g><g data-layer="foreground">${art.fore}</g>`, '0 0 320 180', `${scene.name} waypoint`);
  files.hub = relative(join(repo, 'public', 'art'), hub).replaceAll('\\', '/');
  if (!scene.proposed && battleTypes.has(scene.type)) {
    const battle = join(dir, 'battle.svg');
    writeSvg(battle, `<g data-layer="sky">${skyLayer}</g><g data-layer="distant">${distantLayer}</g><g data-layer="battle-stage">${battleArt(scene, p, art)}</g>`, '0 0 320 180', `${scene.name} battle stage`);
    files.battle = relative(join(repo, 'public', 'art'), battle).replaceAll('\\', '/');
  }
  const icon = join(dir, 'icon.svg');
  writeSvg(icon, iconArt(scene, p), '0 0 16 16', `${scene.name} map icon`);
  files.icon = relative(join(repo, 'public', 'art'), icon).replaceAll('\\', '/');

  const record = {
    id: scene.id,
    kind: scene.proposed ? 'ripple-variant' : 'waypoint',
    name: scene.name,
    era: scene.era,
    site: null,
    guideSection: 'Waypoints / Waypoints by era',
    description: scene.description,
  };
  if (scene.condition) record.condition = scene.condition;
  record.files = {
    hub: files.hub,
    ...(files.battle ? { battle: files.battle } : {}),
    sky: files.sky,
    distant: files.distant,
    midground: files.midground,
    foreground: files.foreground,
    icon: files.icon,
  };
  if (scene.proposed) record.proposed = true;
  return record;
});

mkdirSync(dirname(manifestFile), { recursive: true });
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifest.length} waypoint records (${bases.length} canonical, ${variants.length} proposed variants).`);
console.log(`Generated ${manifest.reduce((sum, entry) => sum + Object.keys(entry.files).length, 0)} SVG files.`);
