import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public/art');
const entries = [];
const r = (x,y,w,h,c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const p = (d,c) => `<path d="${d}" fill="${c}"/>`;
const svg = (body,w=320,h=180) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`;
function save(file,body,w=320,h=180){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),svg(body,w,h)+'\n');return file;}
const palettes = {
 '2031': {sky:'#f6e9bd',water:'#648fa0',land:'#7b9c62',edge:'#435943',road:'#ead3a1',town:'#d5a666',glow:'#fff0b8'},
 '2064': {sky:'#101e3d',water:'#213b61',land:'#445976',edge:'#172c48',road:'#c9a45c',town:'#86b6d7',glow:'#f1d28a'},
 '2148': {sky:'#27243e',water:'#354c68',land:'#61694c',edge:'#343c3c',road:'#a09171',town:'#a67b61',glow:'#e0a578'},
 '2312': {sky:'#17334e',water:'#284d6a',land:'#799b9a',edge:'#3f636c',road:'#b7d9d0',town:'#d8e7df',glow:'#75e0df'},
};
const landmarks=[['meridian',152,58],['halden',236,104],['basin',78,118],['capitol',170,98],['kell',103,47]];
function mapScene(era){
 const c=palettes[era]; let s=r(0,0,320,180,c.water);
 for(let y=4;y<180;y+=8)for(let x=4;x<320;x+=16)s+=r(x+(y%16),y,5,1,c.sky);
 const coastline='M38 37H58V24H112V31H170V20H205V35H238V47H271V70H281V104H266V135H244V149H207V158H172V149H131V160H92V151H62V137H44V106H28V seventy'.replace('seventy','70')+'H38Z';
 s+=p(coastline,c.edge)+p('M42 41H62V28H108V35H174V24H201V39H234V51H267V74H277V100H262V131H240V145H203V154H176V145H127V156H96V147H66V133H48V102H32V74H42Z',c.land);
 // Same river and ridges in all four eras; flooding expands in The Quiet.
 s+=p('M196 35H204V64H197V82H214V108H230V140H224V114H208V88H190V60H196Z',c.water);
 if(era==='2148')s+=r(225,91,34,37,c.water)+r(237,119,24,17,c.water);
 for(let i=0;i<9;i++){let x=60+i*10,y=39+(i%3)*9;s+=p(`M${x} ${y+12}h4v-4h3v-4h3v-4h4v4h3v4h3v4Z`,c.edge)+r(x+10,y,4,3,c.glow);}
 for(let i=0;i<30;i++){let x=48+(i*31)%170,y=68+(i*17)%61;if(x>177&&x<220)continue;s+=r(x,y,4,4,c.edge)+r(x+1,y-2,2,3,c.land);}
 // Road network deliberately schematic; coordinates are an art proposal, not new travel rules.
 for(const [a,b] of [[0,1],[0,3],[0,4],[3,2]]){const A=landmarks[a],B=landmarks[b];const dx=B[1]-A[1],dy=B[2]-A[2];const n=Math.ceil(Math.hypot(dx,dy)/4);for(let i=0;i<n;i++)s+=r(Math.round(A[1]+dx*i/n),Math.round(A[2]+dy*i/n),2,2,c.road);}
 for(const [id,x,y] of landmarks){s+=r(x-5,y-4,12,10,c.edge)+r(x-3,y-7,8,12,c.town)+r(x,y-4,2,5,c.glow);if(id==='basin')s+=r(x-10,y,4,5,c.town)+r(x+8,y,4,5,c.town);if(id==='halden')s+=r(x-7,y+8,20,2,c.road);}
 for(let i=0;i<5;i++)s+=r(65+i*29,126-(i%3)*24,3,3,c.glow);
 return s;
}
for(const era of Object.keys(palettes))entries.push({id:`${era}_world_map`,kind:'world-map',name:`World map — ${era}`,era,site:null,guideSection:'Art and style / World map and interface',description:'Shared stepped coastline, river and five Deep Site landmarks. Geography and waypoint dots are proposed composition, not canonical travel connections. Flooding and infrastructure change with the era.',proposed:true,files:{map:save(`maps/${era}_world.svg`,mapScene(era))},landmarks:landmarks.map(([site,x,y])=>({site,x,y}))});
// Small readable HUD pictograms, on transparent 16px tiles.
const iconShapes={
 kinetic:p('M3 2h3v2h2v2h2v2h2v2h2v3h-3v-2H9V9H7V7H5V5H3Z','a')+r(2,10,4,4,'b'),
 thermal:p('M8 1h2v5h3v7h-2v2H4v-2H2V8h3V5h3Z','a')+r(6,9,4,5,'b'),
 signal:r(1,7,3,3,'b')+r(6,4,3,9,'a')+r(11,1,3,15,'a'),
 chronal:p('M3 1h10v3h-2v2H9v4h2v2h2v3H3v-3h2v-2h2V6H5V4H3Z','a')+r(6,2,4,2,'b'),
 rewind:p('M7 3v10L1 8Z M14 3v10L8 8Z','a'),
 fork:r(7,8,2,7,'a')+r(3,5,10,2,'a')+r(3,1,2,5,'a')+r(11,1,2,5,'a')+r(6,11,4,3,'b'),
 echo:r(2,3,8,10,'a')+r(6,1,8,10,'b')+r(8,3,4,6,'a'),
 collapse:r(1,1,4,2,'a')+r(1,1,2,4,'a')+r(11,1,4,2,'a')+r(13,1,2,4,'a')+r(1,13,4,2,'a')+r(1,11,2,4,'a')+r(11,13,4,2,'a')+r(13,11,2,4,'a')+r(6,6,4,4,'b'),
 resolve:r(6,2,4,12,'a')+r(2,6,12,4,'a'),
 threads:r(2,2,3,12,'a')+r(7,2,3,12,'a')+r(12,2,2,12,'b'),
 tempo:r(3,2,10,2,'a')+r(1,4,2,8,'a')+r(13,4,2,8,'a')+r(3,12,10,2,'a')+r(7,4,2,5,'b')+r(8,8,4,2,'b'),
 entropy:p('M2 1h5v4H5v3h4v3H7v4H2Z M10 1h4v14H9v-3h3V8H9V5h1Z','a'),
 cinder:p('M8 1h2v6h3v6h-2v2H4v-2H2V8h3V5h3Z','a'),
 choir:r(3,1,10,2,'a')+r(1,3,2,6,'a')+r(13,3,2,6,'a')+r(3,9,10,2,'a')+r(7,5,2,10,'b'),
 commons:r(1,4,4,4,'a')+r(6,1,4,4,'b')+r(11,4,4,4,'a')+r(3,9,10,4,'a'),
 relic:r(3,3,10,10,'a')+r(5,5,6,6,'b')+r(0,5,2,2,'b')+r(14,5,2,2,'b')+r(5,0,2,2,'b')+r(5,14,2,2,'b'),
 credits:r(3,2,10,12,'a')+r(1,4,2,8,'a')+r(13,4,2,8,'a')+r(6,4,5,2,'b')+r(5,6,2,4,'b')+r(6,10,5,2,'b'),
 barter:r(1,4,7,7,'a')+r(8,6,7,7,'b')+r(3,6,3,3,'b'),
 allocation:r(2,3,12,10,'a')+r(4,5,3,3,'b')+r(9,5,3,1,'b')+r(9,8,3,1,'b'),
 scan:r(2,2,12,2,'a')+r(2,2,2,12,'a')+r(12,2,2,12,'a')+r(2,12,12,2,'a')+r(5,7,6,2,'b'),
 shop:p('M2 2h12v3H2Z M1 5h14v4H1Z','a')+r(3,9,10,6,'b')+r(6,10,4,5,'a'),
 deep_site:p('M7 0h2v3h3v3h3v4h-3v3H9v3H7v-3H4v-3H1V6h3V3h3Z','a')+r(6,5,4,6,'b'),
 save:r(2,1,12,14,'a')+r(4,2,7,4,'b')+r(4,9,8,5,'b'),
 charter:r(3,1,10,14,'b')+r(5,4,6,1,'a')+r(5,7,6,1,'a')+r(5,10,4,1,'a'),
};
for(const [id,shape] of Object.entries(iconShapes)){const accent=id==='cinder'||id==='thermal'?'#e88a60':id==='choir'||['chronal','echo'].includes(id)?'#b99ce9':'#72c7c5';const body=shape.replaceAll('fill="a"',`fill="${accent}"`).replaceAll('fill="b"','fill="#f7dfa2"');entries.push({id:`icon_${id}`,kind:'icon',name:id.replaceAll('_',' '),era:null,site:null,guideSection:['cinder','choir','commons'].includes(id)?'Factions and party':'Battle mechanics / Tech tree / Shops and currency',description:'Transparent 16px HUD tile. Use alongside a text label; color is not the sole cue.',files:{icon:save(`ui/${id}.svg`,body,16,16)}});}
// Narrative chapter/ending illustrations use the same enclave silhouette, changed by outcome.
function endingScene(id){const c=palettes['2312'];let s=r(0,0,320,180,id==='silence'?'#222c49':'#162b47');for(let i=0;i<35;i++)s+=r((i*53)%320,(i*19)%79,1,1,'#9aafb7');s+=r(0,143,320,37,'#273e50');
 for(let i=0;i<9;i++){let x=i*38-9,y=74+(i%3)*16;s+=r(x,y,30,143-y,'#4a677b')+r(x+2,y+2,26,3,'#89a6ae');for(let j=0;j<5;j++)s+=r(x+5+(j%2)*13,y+12+Math.floor(j/2)*16,5,7,id==='silence'?'#27374c':'#71b9c3');}
 if(id==='commons'){s+=r(89,131,146,8,'#d6b680');for(let i=0;i<8;i++){let x=100+i*16;s+=r(x,137,5,6,'#e0b18b')+r(x-1,143,7,10,i%2?'#76ad99':'#bf846b');}for(let i=0;i<7;i++)s+=r(100+i*18,111+(i%2)*2,12,6,['#78b9a5','#e5c16d','#ad95d5'][i%3]);}
 if(id==='gift'){s+=r(105,20,110,8,'#a4cae0')+r(95,28,130,44,'#58788c')+r(119,38,82,20,'#93dbdc')+r(136,43,12,10,'#e6f4df')+r(174,43,12,10,'#e6f4df');for(let i=0;i<11;i++)s+=r(57+i*20,80,2,78,'#668a99');s+=r(45,100,230,3,'#98b6bb');}
 if(id==='silence'){for(let i=0;i<40;i++)s+=r((i*47)%320,146+(i*7)%30,16,2,'#bac8cd');s+=r(154,143,12,18,'#cf8057')+r(157,148,6,12,'#f5d789')+r(139,157,44,3,'#645043');for(let i=0;i<3;i++)s+=r(122+i*36,145,5,13,'#858e9c');}
 if(id==='perpetuity'){s+=r(132,10,58,121,'#172337')+r(140,18,42,6,'#c8b282');for(let i=0;i<7;i++)s+=r(146,33+i*12,30,2,'#5f879d');s+=r(24,139,64,29,'#665f5b')+r(30,144,9,10,'#e9b56a')+r(49,144,9,10,'#e9b56a')+r(71,147,4,13,'#e0ad85')+r(76,156,12,3,'#8bb89e');}
 if(id==='reconciled'){s+=r(97,71,126,4,'#b9dfe0');for(let x=111;x<218;x+=32)s+=r(x,34,2,94,'#527791');s+=r(112,106,12,12,'#f1c097')+r(108,118,20,26,'#b09b70')+r(107,144,8,19,'#263751')+r(121,144,8,19,'#263751');s+=r(193,94,18,18,'#9fd3da')+r(185,112,32,36,'#889fac')+r(184,148,12,17,'#5d6c86')+r(207,148,12,17,'#5d6c86');s+=r(136,134,36,2,'#efd58e')+r(145,128,20,2,'#b6e4df');}
 return s;}
const endingNames={commons:'The Commons',gift:'The Gift',silence:'The Silence',perpetuity:'Perpetuity',reconciled:'Reconciled'};
for(const [id,name] of Object.entries(endingNames))entries.push({id:`ending_${id}`,kind:'ending',name,era:'2312',site:'meridian',guideSection:'Timeline decision flow / Ending conditions',description:{commons:'An open public assembly replaces private control.',gift:'A benevolent face watches an enclosed, illuminated city.',silence:'Dark infrastructure, snow and a small human fire.',perpetuity:'The Board tower remains; one warm ungoverned enclave survives at its foot.',reconciled:'Young Strand faces his older chassis across a shared chronal thread.'}[id],proposed:true,files:{scene:save(`story/ending_${id}.svg`,endingScene(id))}});
fs.mkdirSync(path.join(root,'manifests'),{recursive:true});fs.writeFileSync(path.join(root,'manifests/support.json'),JSON.stringify(entries,null,2)+'\n');console.log(`Support art: ${entries.length} entries.`);
