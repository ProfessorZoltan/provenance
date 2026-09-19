import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'art', 'locations', 'deep-sites');
const MANIFEST = join(ROOT, 'public', 'art', 'manifests', 'deep-sites.json');

const eras = {
  2031: { sky:'#F6E8CC', pale:'#FFF8E9', ink:'#2C2C2A', main:'#1D9E75', accent:'#EF9F27', dark:'#17604F', soft:'#8DD7BA', ground:'#D8C89F' },
  2064: { sky:'#07152C', pale:'#85B7EB', ink:'#020713', main:'#0C1F3A', accent:'#C9A227', dark:'#071124', soft:'#315C86', ground:'#132D4D' },
  2148: { sky:'#2D2945', pale:'#888780', ink:'#211C28', main:'#993C1D', accent:'#B48445', dark:'#34281E', soft:'#3B6D11', ground:'#493D38' },
  2312: { sky:'#DCECF1', pale:'#FFFFFF', ink:'#263D47', main:'#F1EFE8', accent:'#4FD1E6', dark:'#718B94', soft:'#BDECF2', ground:'#CAD9DA' }
};

const sites = [
  ['meridian','Meridian Campus'], ['halden','Port Halden'], ['basin','The Basin'],
  ['capitol','Capitol Hill'], ['kell','Kell Monastery']
];

const labels = {
  meridian: {2031:'Startup lab',2064:'Corporate HQ',2148:'Sealed vault',2312:"Steward's core"},
  halden: {2031:'Shipping city',2064:'Migrant megacity',2148:'Drowned ruins',2312:'Enclave 7'},
  basin: {2031:'Desert datacenter',2064:'Hyperscale farm',2148:'Wasteland',2312:'Cooling fields'},
  capitol: {2031:'Legislature',2064:'Rubber-stamp senate',2148:'Museum',2312:'Continuity Board seat'},
  kell: {2031:'Mountain retreat',2064:'Off-grid commune',2148:'Resistance stronghold',2312:'Last free place'}
};

const rect = (x,y,w,h,fill,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const line = (x1,y1,x2,y2,stroke,w=1,extra='') => `<path d="M${x1} ${y1}H${x2}" stroke="${stroke}" stroke-width="${w}"${extra}/>`;
const poly = (pts,fill,extra='') => `<polygon points="${pts}" fill="${fill}"${extra}/>`;
const path = (d,fill,extra='') => `<path d="${d}" fill="${fill}"${extra}/>`;
const circle = (cx,cy,r,fill,extra='') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
const group = (name, body) => `<g id="${name}" shape-rendering="crispEdges">${body}</g>`;
const windowGrid = (x,y,cols,rows,dx,dy,c,on=true) => Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,q)=>rect(x+q*dx,y+r*dy,3,3,on?c:'#1B2430')).join('')).join('');
const rails = (y,c) => `${line(0,y,320,y,c,2)}${Array.from({length:17},(_,i)=>rect(i*20,y,2,9,c)).join('')}`;
const stars = c => [[18,20],[48,35],[79,16],[113,30],[148,12],[183,28],[220,18],[259,38],[296,15]].map(([x,y],i)=>rect(x,y,i%3===0?2:1,1,c)).join('');
const pixels = (pairs,c) => pairs.map(([x,y,w=2,h=2])=>rect(x,y,w,h,c)).join('');

function skyLayer(era, p, site) {
  if (era===2031) return group('sky', `${rect(0,0,320,180,p.sky)}${circle(site==='basin'?268:56,36,17,p.accent)}${poly('0,76 44,56 78,68 116,48 166,72 211,52 258,70 320,50 320,94 0,94',p.pale)}${pixels([[24,28,18,3],[41,31,12,3],[189,25,20,3],[205,22,12,3]],'#FFFFFF')}`);
  if (era===2064) return group('sky', `${rect(0,0,320,180,p.sky)}${stars(p.pale)}${rect(238,19,31,2,p.accent)}${rect(252,12,2,16,p.accent)}${pixels([[25,54,31,2],[88,43,24,2],[271,62,30,2]],p.soft)}`);
  if (era===2148) return group('sky', `${rect(0,0,320,180,p.sky)}${circle(260,34,12,'#8179A8')}${pixels([[11,30,54,3],[53,36,68,3],[174,24,64,3],[226,40,79,3]],'#6F6883')}${Array.from({length:18},(_,i)=>rect((i*19+7)%320,50+(i%5)*8,1,7,p.pale)).join('')}`);
  return group('sky', `${rect(0,0,320,180,p.sky)}${circle(160,34,22,p.pale)}${rect(153,8,14,52,p.soft)}${pixels([[30,24,32,1],[258,31,27,1],[92,15,16,1],[204,52,22,1]],p.dark)}${site==='meridian'?`${rect(157,20,6,6,p.accent)}${rect(159,14,2,18,p.pale)}`:''}`);
}

function meridian(era,p,battle=false) {
  const floorY = battle ? 129 : 142;
  if (era===2031) return {
    distant: group('distant', `${rect(20,76,81,55,p.pale)}${rect(219,70,78,61,p.pale)}${windowGrid(28,84,6,3,11,11,p.soft)}${windowGrid(228,78,5,3,12,12,p.main)}${poly('104,131 160,58 216,131',p.soft)}${poly('117,131 160,72 203,131',p.pale)}`),
    midground: group('midground', `${rect(111,92,98,42,p.pale)}${rect(117,98,86,30,'#CDEBDC')}${rect(151,98,18,36,p.main)}${rect(156,102,8,12,p.pale)}${rect(38,124,244,5,p.ink)}${rect(147,52,26,7,p.accent)}${rect(152,59,16,7,p.main)}${battle?'':`${rect(63,106,24,18,p.main)}${rect(66,109,18,12,p.pale)}${rect(233,102,26,22,p.accent)}${rect(237,106,18,14,p.pale)}`}`),
    foreground: group('foreground', `${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:9},(_,i)=>rect(i*40,floorY+12+(i%2)*14,22,2,p.pale)).join('')}${battle?'':`${rect(12,137,5,38,p.dark)}${circle(15,134,13,p.main)}${rect(294,136,5,39,p.dark)}${circle(296,131,15,p.main)}${pixels([[55,151,5,5],[91,160,4,4],[217,153,5,5],[265,166,4,4]],p.accent)}`}`)
  };
  if (era===2064) return {
    distant: group('distant', `${poly('0,129 0,68 45,42 87,68 87,129',p.main)}${poly('233,129 233,62 273,29 320,61 320,129',p.main)}${windowGrid(11,75,6,4,11,10,p.pale)}${windowGrid(246,67,6,5,11,10,p.accent)}${rect(95,41,130,88,'#153C63')}${poly('102,124 160,51 218,124',p.soft)}${poly('118,124 160,66 202,124',p.main)}`),
    midground: group('midground', `${rect(106,78,108,51,'#0A1830')}${rect(112,84,96,38,p.soft)}${rect(151,84,18,45,p.accent)}${rect(156,88,8,27,p.ink)}${rect(0,116,320,11,p.ink)}${Array.from({length:16},(_,i)=>rect(i*21,119,12,3,i%3===0?p.accent:p.pale)).join('')}${battle?'':`${rect(29,96,32,28,p.ink)}${rect(35,101,20,18,p.soft)}${rect(257,89,34,35,p.ink)}${rect(263,95,22,23,p.pale)}`}`),
    foreground: group('foreground', `${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:10},(_,i)=>poly(`${i*36},${floorY} ${i*36+28},${floorY} ${i*36+42},180 ${i*36+12},180`,i%2?p.main:'#17253A')).join('')}${battle?'':`${rect(6,71,9,109,p.ink)}${rect(305,71,9,109,p.ink)}${rect(2,70,17,5,p.accent)}${rect(301,70,17,5,p.accent)}`}`)
  };
  if (era===2148) return {
    distant: group('distant', `${rect(26,58,268,76,p.dark)}${rect(32,64,256,64,'#5D5451')}${rect(42,74,55,45,p.ink)}${rect(224,69,52,50,p.ink)}${rect(105,55,110,65,'#494148')}${poly('121,119 160,67 199,119',p.pale)}${poly('132,119 160,82 188,119',p.ink)}${path('M36 70h35v5H55v8H43v9H32V78h4z',p.soft)}`),
    midground: group('midground', `${rect(113,88,94,38,p.ink)}${rect(120,94,80,27,'#4F4743')}${rect(151,94,18,34,p.main)}${rect(156,98,8,21,p.accent)}${rect(0,121,320,8,'#1E2730')}${pixels([[31,116,44,3],[77,112,23,3],[211,117,62,3],[254,108,42,3]],p.soft)}${battle?'':`${path('M12 94h7v17h8v29h-9v-18H7v-9h5z',p.main)}${path('M292 85h8v24h12v10h-7v31h-9v-23h-12v-9h8z',p.soft)}`}`),
    foreground: group('foreground', `${rect(0,floorY,320,180-floorY,'#27333B')}${rect(0,floorY+18,320,3,p.pale,' opacity=".35"')}${pixels([[8,150,34,2],[48,164,53,2],[226,151,61,2],[136,171,51,2]],p.accent)}${battle?'':`${path('M0 143h37v8H22v8H10v21H0z',p.soft)}${path('M320 139h-42v8h17v12h11v21h14z',p.soft)}${Array.from({length:9},(_,i)=>rect(18+i*35,128+i%3*7,2,17,p.main)).join('')}`}`)
  };
  return {
    distant: group('distant', `${rect(44,45,232,85,p.pale)}${rect(54,55,212,66,p.main)}${Array.from({length:11},(_,i)=>`${rect(60+i*19,62,9,52,i%2?p.soft:p.pale)}${rect(63+i*19,69,3,38,p.accent)}`).join('')}${poly('108,121 160,47 212,121',p.dark)}${poly('124,121 160,63 196,121',p.sky)}`),
    midground: group('midground', `${rect(119,85,82,42,p.pale)}${rect(126,91,68,29,p.soft)}${rect(154,91,12,36,p.accent)}${rect(158,94,4,25,p.pale)}${circle(160,75,9,p.accent)}${rect(158,55,4,21,p.accent)}${battle?'':Array.from({length:7},(_,i)=>`${rect(20+i*47,103,22,18,p.pale)}${rect(26+i*47,108,10,8,p.accent)}`).join('')}`),
    foreground: group('foreground', `${rect(0,floorY,320,180-floorY,p.ground)}${line(0,floorY,320,floorY,p.dark,1)}${Array.from({length:8},(_,i)=>rect(14+i*43,floorY+13,25,1,p.dark)).join('')}${battle?'':`${rect(0,151,52,29,p.pale)}${rect(268,151,52,29,p.pale)}${rect(17,145,16,6,p.accent)}${rect(285,145,16,6,p.accent)}`}`)
  };
}

function halden(era,p,battle=false) {
  const floorY=battle?130:146;
  if(era===2031)return{
    distant:group('distant',`${rect(0,93,320,43,'#7DC3C4')}${poly('18,92 49,52 55,52 55,92',p.ink)}${line(52,55,105,81,p.ink,2)}${line(52,55,20,81,p.ink,2)}${poly('234,92 267,43 273,43 273,92',p.ink)}${line(270,46,314,78,p.ink,2)}${rect(4,82,42,12,p.main)}${rect(279,77,37,15,p.accent)}`),
    midground:group('midground',`${rect(28,101,73,25,p.accent)}${rect(35,94,59,7,p.pale)}${rect(42,108,14,9,p.main)}${rect(62,108,30,9,p.ink)}${rect(212,98,80,28,p.main)}${rect(220,91,64,7,p.pale)}${rect(221,106,26,10,p.accent)}${rect(254,106,29,10,p.pale)}${battle?'':`${rect(122,83,74,43,p.ink)}${poly('117,83 201,83 185,72 133,72',p.pale)}${windowGrid(133,91,5,2,12,11,p.soft)}`}`),
    foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${line(0,floorY,320,floorY,p.ink,3)}${battle?'':`${rect(0,134,36,13,p.dark)}${rect(284,136,36,11,p.dark)}${circle(25,165,8,p.ink)}${circle(296,165,8,p.ink)}${rails(151,p.pale)}`}`)
  };
  if(era===2064)return{
    distant:group('distant',`${Array.from({length:9},(_,i)=>{const h=40+(i%4)*13;return `${rect(i*38,126-h,32,h,i%2?p.main:p.soft)}${windowGrid(i*38+5,132-h,3,Math.floor((h-12)/9),8,9,i%3?p.pale:p.accent)}`}).join('')}${line(0,71,320,71,p.accent,2)}${line(0,90,320,90,p.pale,2)}`),
    midground:group('midground',`${rect(0,109,320,9,p.ink)}${rails(105,p.accent)}${rect(23,78,75,27,p.main)}${rect(31,84,58,15,p.soft)}${rect(225,73,68,32,p.main)}${rect(233,80,52,17,p.pale)}${battle?'':`${rect(118,58,83,47,p.ink)}${rect(127,66,65,30,p.soft)}${rect(151,66,18,39,p.accent)}${Array.from({length:5},(_,i)=>rect(5+i*72,118,58,9,i%2?p.pale:p.main)).join('')}`}`),
    foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:16},(_,i)=>rect(i*21,floorY+5+(i%2)*15,14,2,p.soft)).join('')}${battle?'':`${rect(8,124,9,56,p.ink)}${rect(303,124,9,56,p.ink)}${line(12,135,308,135,p.accent,2)}`}`)
  };
  if(era===2148)return{
    distant:group('distant',`${rect(0,92,320,38,'#414C58')}${Array.from({length:8},(_,i)=>{const h=26+(i%3)*13;return `${rect(i*43,130-h,36,h,p.ink)}${rect(i*43+6,136-h,4,4,p.pale)}${path(`M${i*43+20} ${130-h}v-${8+i%2*6}h3v${8+i%2*6}`,p.soft)}`}).join('')}${line(0,85,320,85,p.pale,2,' stroke-dasharray="11 7"')}`),
    midground:group('midground',`${rect(0,119,320,24,'#2B4653')}${rect(0,131,320,12,'#345A66')}${pixels([[17,116,53,3],[102,123,44,3],[191,112,67,3],[275,125,29,3]],p.soft)}${battle?'':`${poly('116,119 149,76 174,80 205,119',p.dark)}${rect(143,84,34,30,p.main)}${path('M42 91h8v19h12v8H36v-8h6z',p.soft)}${path('M273 84h8v29h11v7h-29v-7h10z',p.main)}`}`),
    foreground:group('foreground',`${rect(0,floorY,320,180-floorY,'#244653')}${line(0,floorY+17,320,floorY+17,p.pale,1,' opacity=".45"')}${battle?'':`${path('M0 139h57v5H39v8H22v28H0z',p.soft)}${path('M320 137h-51v6h17v11h16v26h18z',p.soft)}${Array.from({length:10},(_,i)=>rect(i*34+5,148+i%2*9,2,15,p.main)).join('')}`}`)
  };
  return{
    distant:group('distant',`${Array.from({length:7},(_,i)=>{const h=52+(i%3)*12;return `${rect(i*48,130-h,41,h,p.main)}${windowGrid(i*48+8,136-h,3,4,9,10,p.accent)}`}).join('')}${rect(0,70,320,3,p.dark)}${rect(16,64,288,3,p.dark)}`),
    midground:group('midground',`${rect(12,94,92,35,p.pale)}${rect(216,94,92,35,p.pale)}${windowGrid(23,103,7,2,11,10,p.soft)}${windowGrid(228,103,7,2,11,10,p.soft)}${poly('116,129 116,83 135,70 185,70 204,83 204,129',p.main)}${rect(141,83,38,36,p.accent)}${rect(148,90,24,23,p.pale)}${battle?'':`${rect(0,119,320,7,p.dark)}${Array.from({length:11},(_,i)=>circle(10+i*30,122,3,p.accent)).join('')}`}`),
    foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${line(0,floorY,320,floorY,p.dark,1)}${battle?'':`${rect(0,151,43,29,p.pale)}${rect(277,151,43,29,p.pale)}${rect(13,143,18,8,p.accent)}${rect(289,143,18,8,p.accent)}`}`)
  };
}

function basin(era,p,battle=false){
 const floorY=battle?130:145;
 if(era===2031)return{
  distant:group('distant',`${poly('0,111 58,78 105,102 155,72 211,104 272,79 320,107 320,128 0,128', '#C48958')}${poly('0,116 62,96 119,112 190,91 250,110 320,92 320,130 0,130',p.accent)}${rect(26,57,5,53,p.ink)}${line(28,58,76,89,p.ink,2)}${rect(284,49,5,60,p.ink)}${line(286,50,244,84,p.ink,2)}`),
  midground:group('midground',`${rect(77,88,166,40,p.pale)}${rect(84,95,152,26,p.main)}${Array.from({length:11},(_,i)=>rect(89+i*13,100,7,15,i%2?p.ink:p.soft)).join('')}${rect(153,80,14,48,p.accent)}${battle?'':`${rect(19,116,51,12,p.ink)}${rect(250,112,53,16,p.ink)}${rect(34,102,4,19,p.ink)}${line(36,103,60,116,p.ink,2)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${pixels([[14,159,25,3],[69,150,16,3],[118,169,31,3],[211,156,21,3],[269,171,33,3]],p.accent)}${battle?'':`${rect(0,138,29,7,p.dark)}${rect(291,137,29,8,p.dark)}${rect(9,128,4,18,p.ink)}${rect(305,126,4,20,p.ink)}`}`)
 };
 if(era===2064)return{
  distant:group('distant',`${rect(20,45,280,80,p.main)}${Array.from({length:10},(_,i)=>`${rect(29+i*28,52,17,64,p.ink)}${rect(33+i*28,58,9,50,i%2?p.pale:p.soft)}`).join('')}${line(20,69,300,69,p.accent,2)}${line(20,96,300,96,p.accent,2)}`),
  midground:group('midground',`${rect(35,74,250,50,'#06101F')}${Array.from({length:8},(_,i)=>`${rect(44+i*32,81,19,39,p.soft)}${windowGrid(48+i*32,86,2,4,7,7,i%2?p.accent:p.pale)}`).join('')}${rect(153,74,14,51,p.accent)}${battle?'':`${rect(4,104,25,22,p.main)}${rect(291,104,25,22,p.main)}${rect(11,110,11,9,p.pale)}${rect(298,110,11,9,p.pale)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:7},(_,i)=>line(0,floorY+i*8,320,floorY+i*8,i%2?p.soft:p.main,1)).join('')}${battle?'':`${rect(0,69,8,111,p.ink)}${rect(312,69,8,111,p.ink)}${rect(0,69,28,4,p.accent)}${rect(292,69,28,4,p.accent)}`}`)
 };
 if(era===2148)return{
  distant:group('distant',`${poly('0,115 54,88 101,110 158,80 210,109 271,86 320,106 320,132 0,132',p.main)}${poly('0,125 82,104 139,120 218,99 320,119 320,137 0,137',p.accent)}${path('M37 102h6V72h4v30h15v5H30v-5z',p.dark)}${path('M270 103h6V65h4v38h15v5h-32v-5z',p.dark)}`),
  midground:group('midground',`${Array.from({length:6},(_,i)=>{const x=54+i*40;return `${rect(x,94+(i%2)*8,27,31,p.ink)}${rect(x+5,99+(i%2)*8,17,17,p.pale)}${path(`M${x} ${108+i%2*8}h27v6H${x+16}v12H${x+10}v-12H${x}z`,p.soft)}`}).join('')}${battle?'':`${path('M6 125h61l-13-9H31l-9-8H6z',p.dark)}${path('M314 123h-58l12-10h22l8-9h16z',p.dark)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,'#69513D')}${pixels([[12,151,42,4],[84,163,33,3],[140,149,42,3],[226,166,51,4],[285,153,21,3]],p.accent)}${battle?'':`${poly('0,140 43,132 66,151 45,180 0,180',p.soft)}${poly('320,137 281,131 260,154 278,180 320,180',p.soft)}`}`)
 };
 return{
  distant:group('distant',`${poly('0,111 53,82 108,108 164,76 222,108 274,82 320,109 320,130 0,130',p.pale)}${Array.from({length:7},(_,i)=>`${rect(25+i*46,64+(i%2)*10,18,55,p.main)}${poly(`${19+i*46},${64+(i%2)*10} ${49+i*46},${64+(i%2)*10} ${42+i*46},${53+(i%2)*10} ${26+i*46},${53+(i%2)*10}`,p.soft)}${rect(31+i*46,72+(i%2)*10,6,30,p.accent)}`).join('')}`),
  midground:group('midground',`${rect(0,116,320,12,p.ground)}${Array.from({length:10},(_,i)=>`${rect(5+i*33,109,23,7,p.dark)}${rect(10+i*33,103,13,6,p.accent)}`).join('')}${battle?'':`${rect(145,86,30,29,p.pale)}${rect(151,92,18,18,p.accent)}${rect(158,73,4,13,p.dark)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:8},(_,i)=>rect(i*44,floorY+11+(i%2)*15,30,2,p.pale)).join('')}${battle?'':`${rect(0,132,31,48,p.pale)}${rect(289,132,31,48,p.pale)}${rect(10,124,11,8,p.accent)}${rect(299,124,11,8,p.accent)}`}`)
 };
}

function capitol(era,p,battle=false){
 const floorY=battle?130:145;
 const dome=(fill,accent)=>`${rect(92,78,136,49,fill)}${poly('108,78 125,58 195,58 212,78',fill)}${path('M126 58c5-26 63-26 68 0z',fill)}${rect(155,26,10,9,accent)}${rect(158,16,4,10,accent)}`;
 if(era===2031)return{
  distant:group('distant',`${poly('0,128 0,103 47,85 88,107 88,128',p.soft)}${poly('232,128 232,104 276,82 320,102 320,128',p.soft)}${dome(p.pale,p.accent)}`),
  midground:group('midground',`${Array.from({length:8},(_,i)=>`${rect(99+i*16,83,8,38,p.ink)}${rect(101+i*16,86,4,30,p.main)}`).join('')}${rect(87,121,146,7,p.ink)}${battle?'':`${rect(116,100,88,24,'#DCCEA9')}${Array.from({length:5},(_,i)=>rect(123+i*17,105,11,13,i===2?p.accent:p.main)).join('')}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:7},(_,i)=>rect(79+i*28,floorY+i*3,19,2,p.pale)).join('')}${battle?'':`${rect(15,133,5,47,p.dark)}${circle(17,127,15,p.main)}${rect(300,133,5,47,p.dark)}${circle(302,127,15,p.main)}`}`)
 };
 if(era===2064)return{
  distant:group('distant',`${rect(0,47,320,82,p.main)}${Array.from({length:9},(_,i)=>rect(10+i*38,57,27,64,i%2?p.soft:'#102B4A')).join('')}${dome('#122E51',p.accent)}${windowGrid(104,80,9,4,13,10,p.pale)}`),
  midground:group('midground',`${rect(72,110,176,16,p.ink)}${Array.from({length:9},(_,i)=>`${rect(79+i*19,96,13,12,i===4?p.accent:p.main)}${rect(82+i*19,99,7,5,p.pale)}`).join('')}${rect(0,119,320,8,p.accent)}${battle?'':`${rect(11,90,49,25,p.ink)}${rect(18,96,35,13,p.soft)}${rect(260,90,49,25,p.ink)}${rect(267,96,35,13,p.soft)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:9},(_,i)=>line(0,floorY+i*6,320,floorY+i*6,i%2?p.main:p.soft,1)).join('')}${battle?'':`${rect(0,57,7,123,p.ink)}${rect(313,57,7,123,p.ink)}${rect(0,57,25,4,p.accent)}${rect(295,57,25,4,p.accent)}`}`)
 };
 if(era===2148)return{
  distant:group('distant',`${path('M91 127V78h19l15-20h25l8-19h11l7 19h20l18 20h15v49z',p.dark)}${path('M126 59c3-21 62-22 68 0l-13 3-11-11-15 9-15-8z',p.pale)}${poly('0,128 0,108 56,84 89,110 89,128',p.soft)}${poly('231,128 231,104 280,82 320,106 320,128',p.soft)}`),
  midground:group('midground',`${Array.from({length:7},(_,i)=>{const y=i===2?98:83;return `${rect(103+i*18,y,9,125-y,p.pale)}${poly(`${100+i*18},${y} ${115+i*18},${y} ${112+i*18},${y-5} ${103+i*18},${y-5}`,p.accent)}`}).join('')}${rect(89,121,142,7,p.ink)}${battle?'':`${rect(119,103,82,18,'#443A38')}${pixels([[127,109,14,6],[149,107,17,8],[177,110,13,5]],p.main)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${pixels([[12,153,31,3],[69,168,43,3],[138,151,38,3],[222,166,42,3],[276,150,33,3]],p.pale)}${battle?'':`${poly('0,143 48,132 69,147 54,180 0,180',p.soft)}${poly('320,139 276,131 259,151 278,180 320,180',p.soft)}${path('M24 132h4V99h5v33h15v5H12v-5z',p.main)}`}`)
 };
 return{
  distant:group('distant',`${rect(49,48,222,80,p.pale)}${path('M104 80c7-47 105-47 112 0z',p.main)}${path('M119 78c8-31 74-31 82 0z',p.soft)}${rect(154,37,12,43,p.accent)}${rect(158,27,4,12,p.accent)}${rect(66,67,44,52,p.main)}${rect(210,67,44,52,p.main)}`),
  midground:group('midground',`${rect(81,90,158,36,p.main)}${Array.from({length:7},(_,i)=>`${rect(91+i*23,94,14,27,p.pale)}${rect(96+i*23,98,4,18,p.accent)}`).join('')}${rect(72,121,176,6,p.dark)}${battle?'':`${circle(160,99,15,p.accent)}${circle(160,99,8,p.pale)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${line(0,floorY,320,floorY,p.dark,1)}${battle?'':`${rect(0,146,52,34,p.pale)}${rect(268,146,52,34,p.pale)}${rect(16,137,19,9,p.accent)}${rect(285,137,19,9,p.accent)}`}`)
 };
}

function kell(era,p,battle=false){
 const floorY=battle?130:146;
 const peaks=`${poly('0,112 54,48 92,94 145,25 194,89 244,43 320,109 320,131 0,131',era===2312?p.pale:p.dark)}${poly('48,56 54,48 63,59 145,25 160,48 244,43 256,58',p.pale)}`;
 const monastery=(fill,accent)=>`${rect(106,82,108,45,fill)}${poly('96,82 224,82 208,69 112,69',accent)}${rect(145,52,30,30,fill)}${poly('138,52 182,52 172,43 148,43',accent)}${rect(154,95,12,32,accent)}`;
 if(era===2031)return{
  distant:group('distant',`${peaks}${monastery(p.pale,p.accent)}`),
  midground:group('midground',`${rect(35,114,250,14,p.main)}${Array.from({length:11},(_,i)=>`${rect(42+i*23,106+(i%2)*5,4,15,p.dark)}${poly(`${35+i*23},${107+(i%2)*5} ${53+i*23},${107+(i%2)*5} ${44+i*23},${96+(i%2)*5}`,i%3?p.main:p.accent)}`).join('')}${battle?'':`${Array.from({length:8},(_,i)=>`${line(30+i*37,73,30+i*37,101,p.ink,1)}${poly(`${30+i*37},${75} ${45+i*37},${80} ${30+i*37},${85}`,i%2?p.accent:p.main)}`).join('')}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${pixels([[15,159,23,3],[65,170,34,3],[123,154,21,3],[214,168,41,3],[275,155,27,3]],p.main)}${battle?'':`${circle(20,135,18,p.main)}${rect(17,139,6,41,p.dark)}${circle(301,135,18,p.main)}${rect(298,139,6,41,p.dark)}`}`)
 };
 if(era===2064)return{
  distant:group('distant',`${peaks}${monastery(p.main,p.accent)}${Array.from({length:5},(_,i)=>poly(`${15+i*71},108 ${43+i*71},79 ${66+i*71},108`,p.soft)).join('')}`),
  midground:group('midground',`${Array.from({length:6},(_,i)=>`${poly(`${19+i*54},116 ${33+i*54},91 ${47+i*54},116`,p.pale)}${rect(31+i*54,92,4,29,p.accent)}`).join('')}${rect(47,119,226,9,p.ink)}${battle?'':`${rect(116,92,88,31,p.soft)}${windowGrid(126,98,6,2,12,11,p.pale)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${Array.from({length:8},(_,i)=>rect(8+i*43,floorY+9+(i%2)*17,28,2,p.soft)).join('')}${battle?'':`${rect(0,132,37,48,p.ink)}${rect(283,132,37,48,p.ink)}${poly('4,132 33,132 19,107',p.pale)}${poly('287,132 316,132 302,107',p.pale)}`}`)
 };
 if(era===2148)return{
  distant:group('distant',`${peaks}${rect(91,72,138,56,p.dark)}${poly('79,72 241,72 219,58 101,58',p.main)}${rect(145,43,30,29,p.dark)}${poly('137,43 183,43 173,34 147,34',p.main)}${rect(113,80,5,42,p.pale)}${rect(202,80,5,42,p.pale)}`),
  midground:group('midground',`${rect(58,105,204,23,p.ink)}${Array.from({length:9},(_,i)=>`${rect(64+i*23,95,12,28,i%2?p.main:p.soft)}${poly(`${62+i*23},95 ${78+i*23},95 ${70+i*23},86`,p.accent)}`).join('')}${battle?'':`${circle(39,116,12,p.accent)}${rect(35,116,8,17,p.main)}${circle(282,114,12,p.accent)}${rect(278,114,8,19,p.main)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,p.ground)}${pixels([[8,154,31,3],[61,168,47,3],[130,153,42,3],[223,166,39,3],[278,151,35,3]],p.accent)}${battle?'':`${poly('0,144 50,134 69,151 52,180 0,180',p.dark)}${poly('320,141 274,133 256,152 275,180 320,180',p.dark)}${Array.from({length:7},(_,i)=>rect(17+i*48,128,3,18,p.main)).join('')}`}`)
 };
 return{
  distant:group('distant',`${peaks}${monastery(p.pale,p.accent)}${poly('0,119 60,101 112,118 171,99 228,117 286,98 320,112 320,133 0,133',p.soft)}`),
  midground:group('midground',`${rect(68,111,184,17,p.main)}${Array.from({length:8},(_,i)=>`${rect(75+i*23,102,14,21,p.pale)}${rect(80+i*23,106,4,11,p.accent)}`).join('')}${battle?'':`${rect(140,88,40,34,p.soft)}${rect(153,96,14,26,p.accent)}${pixels([[24,120,4,4],[44,113,3,3],[271,118,4,4],[291,110,3,3]],p.dark)}`}`),
  foreground:group('foreground',`${rect(0,floorY,320,180-floorY,'#D9E8E9')}${pixels([[8,153,33,2],[63,170,41,2],[128,153,32,2],[220,169,45,2],[281,151,31,2]],p.pale)}${battle?'':`${poly('0,145 45,136 62,151 48,180 0,180',p.pale)}${poly('320,143 277,134 259,153 278,180 320,180',p.pale)}${rect(18,130,3,19,p.dark)}${rect(298,128,3,21,p.dark)}`}`)
 };
}

const sceneFns={meridian,halden,basin,capitol,kell};

function marks(era,p){
  const label=`<g opacity=".62">${rect(7,7,40,2,p.accent)}${rect(7,12,24,2,p.accent)}${rect(274,7,39,2,p.dark)}${rect(290,12,23,2,p.dark)}</g>`;
  return era===2148?`${label}${path('M8 40h13v2H10v7H6V36h2z',p.main)}${path('M312 42h-12v2h10v8h4V38h-2z',p.soft)}`:label;
}

function battleScene(site,era,p){
 const layers=sceneFns[site](era,p,true);
 const floor=`${line(22,132,298,132,p.dark,1,' opacity=".65"')}${Array.from({length:6},(_,i)=>rect(28+i*52,159,29,2,p.pale,' opacity=".45"')).join('')}`;
 const anchors=`<g opacity=".62">${rect(12,121,18,3,p.accent)}${rect(290,121,18,3,p.accent)}${rect(15,125,2,12,p.accent)}${rect(303,125,2,12,p.accent)}</g>`;
 return `${layers.distant}${layers.midground}${layers.foreground}${floor}${anchors}`;
}

function icon(site,era,p){
 const bg=rect(0,0,16,16,p.sky);
 const base=rect(1,13,14,2,p.ground);
 const art={
  meridian:`${poly('3,12 8,3 13,12',p.soft)}${rect(6,8,4,5,p.main)}${rect(7,9,2,3,p.accent)}`,
  halden:`${rect(2,7,5,6,p.main)}${rect(8,5,6,8,p.soft)}${rect(9,7,4,2,p.accent)}${rect(3,4,1,4,p.ink)}${line(4,4,8,6,p.ink,1)}`,
  basin:`${rect(3,7,10,6,p.main)}${Array.from({length:3},(_,i)=>rect(4+i*3,8,2,3,p.accent)).join('')}${rect(7,4,2,3,p.ink)}${poly('1,13 4,10 6,13',p.ground)}`,
  capitol:`${rect(3,8,10,5,p.main)}${path('M4 8c1-5 7-5 8 0z',p.soft)}${rect(7,3,2,3,p.accent)}${Array.from({length:3},(_,i)=>rect(4+i*4,9,2,4,p.pale)).join('')}`,
  kell:`${poly('0,12 5,5 8,9 11,3 16,11 16,14 0,14',p.soft)}${rect(5,9,6,4,p.main)}${poly('4,9 12,9 10,7 6,7',p.accent)}`
 }[site];
 return `${bg}${base}${art}`;
}

function svg(body,{w=320,h=180,desc=''}={}){
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" role="img"><title>${desc}</title>${body}</svg>\n`;
}

async function save(file,body){await mkdir(dirname(file),{recursive:true});await writeFile(file,body,'utf8');}
const publicPath = file => relative(join(ROOT,'public','art'),file).replaceAll('\\','/');

const manifest=[];
for(const era of [2031,2064,2148,2312]){
 for(const [site,name] of sites){
  const p=eras[era];
  const layers=sceneFns[site](era,p,false);
  layers.sky=`${skyLayer(era,p,site)}${marks(era,p)}`;
  const dir=join(OUT,String(era),site);
  const files={
   hub:join(dir,'hub.svg'), battle:join(dir,'battle.svg'), sky:join(dir,'sky.svg'),
   distant:join(dir,'distant.svg'), midground:join(dir,'midground.svg'),
   foreground:join(dir,'foreground.svg'), icon:join(dir,'icon.svg')
  };
  const desc=`${name}, ${era}: ${labels[site][era]}. Original pixel-art environment.`;
  for(const key of ['sky','distant','midground','foreground']) await save(files[key],svg(layers[key],{desc:`${desc} ${key} transparent layer`}));
  await save(files.hub,svg(`${layers.sky}${layers.distant}${layers.midground}${layers.foreground}`,{desc}));
  await save(files.battle,svg(`${skyLayer(era,p,site)}${battleScene(site,era,p)}${marks(era,p)}`,{desc:`${desc} Horizontal battle stage; clear combat ground.`}));
  await save(files.icon,svg(icon(site,era,p),{w:16,h:16,desc:`${name} ${era} map icon`}));
  manifest.push({
   id:`${era}_${site}`,kind:'deep-site',name:`${name} — ${labels[site][era]}`,era,site,
   guideSection:'Premise and world / Travel rule',description:desc,
   files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,publicPath(v)]))
  });
 }
}

// Act 3 proposal: all Meridian eras visibly occupy a single impossible chamber.
{
 const dir=join(OUT,'act3','meridian-stack');
 const files={hub:join(dir,'hub.svg'),battle:join(dir,'battle.svg'),sky:join(dir,'sky.svg'),distant:join(dir,'distant.svg'),midground:join(dir,'midground.svg'),foreground:join(dir,'foreground.svg'),icon:join(dir,'icon.svg')};
 const sky=group('sky',`${rect(0,0,320,180,'#182330')}${rect(12,16,66,3,eras[2031].accent)}${rect(90,16,66,3,eras[2064].accent)}${rect(168,16,66,3,eras[2148].main)}${rect(246,16,62,3,eras[2312].accent)}${stars(eras[2312].dark)}`);
 const distant=group('distant',`${poly('0,126 0,65 80,45 80,126',eras[2031].pale)}${rect(80,42,80,84,eras[2064].main)}${path('M160 126V49h80v77h-18V76l-19-14-17 18-12-12v58z',eras[2148].dark)}${rect(240,35,80,91,eras[2312].pale)}${windowGrid(88,51,7,6,10,10,eras[2064].accent)}${Array.from({length:6},(_,i)=>rect(248+i*11,44,5,69,i%2?eras[2312].soft:eras[2312].accent)).join('')}`);
 const midground=group('midground',`${poly('120,128 160,64 200,128',eras[2031].soft)}${poly('133,128 160,80 187,128',eras[2064].ink)}${rect(151,83,18,45,eras[2312].accent)}${rect(156,89,8,28,eras[2312].pale)}${rect(0,121,320,8,eras[2064].ink)}${pixels([[23,110,29,4],[101,107,31,4],[189,113,25,4],[263,103,35,4]],eras[2148].soft)}`);
 const foreground=group('foreground',`${rect(0,145,80,35,eras[2031].ground)}${rect(80,145,80,35,eras[2064].ground)}${rect(160,145,80,35,eras[2148].ground)}${rect(240,145,80,35,eras[2312].ground)}${Array.from({length:4},(_,i)=>rect(78+i*80,26,4,154,[eras[2031].main,eras[2064].accent,eras[2148].main,eras[2312].accent][i])).join('')}`);
 await save(files.sky,svg(sky,{desc:'Act 3 Meridian stacked dungeon transparent sky layer'}));
 await save(files.distant,svg(distant,{desc:'Act 3 Meridian stacked dungeon transparent distant layer'}));
 await save(files.midground,svg(midground,{desc:'Act 3 Meridian stacked dungeon transparent midground layer'}));
 await save(files.foreground,svg(foreground,{desc:'Act 3 Meridian stacked dungeon transparent foreground layer'}));
 await save(files.hub,svg(`${sky}${distant}${midground}${foreground}`,{desc:'Proposed Act 3 Meridian final dungeon with all four eras stacked'}));
 await save(files.battle,svg(`${sky}${distant}${midground}${rect(0,130,80,50,eras[2031].ground)}${rect(80,130,80,50,eras[2064].ground)}${rect(160,130,80,50,eras[2148].ground)}${rect(240,130,80,50,eras[2312].ground)}${line(18,132,302,132,eras[2312].pale,1)}`,{desc:'Proposed Act 3 stacked-era Meridian battle stage'}));
 await save(files.icon,svg(`${rect(0,0,4,16,eras[2031].main)}${rect(4,0,4,16,eras[2064].main)}${rect(8,0,4,16,eras[2148].main)}${rect(12,0,4,16,eras[2312].pale)}${poly('3,13 8,3 13,13',eras[2312].accent)}${rect(7,8,2,5,'#182330')}`,{w:16,h:16,desc:'Act 3 stacked Meridian icon'}));
 manifest.push({id:'act3_meridian_stack',kind:'deep-site',name:'Meridian Campus — Stacked Final Dungeon',era:'stacked',site:'meridian',proposed:false,guideSection:'Premise and world / Travel rule',description:'Act 3 Meridian final dungeon: all four eras occupy one fractured chamber, ending at the Steward lattice.',files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,publicPath(v)]))});
}

await mkdir(dirname(MANIFEST),{recursive:true});
await writeFile(MANIFEST,`${JSON.stringify(manifest,null,2)}\n`,'utf8');
console.log(`Generated ${manifest.length} Deep Site scenes (${manifest.length*7} SVGs) and ${publicPath(MANIFEST)}`);
