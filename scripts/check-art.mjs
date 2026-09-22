import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('public/art');
const c=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
const ids=new Set(),files=new Set();
for(const e of c.entries){
 if(ids.has(e.id))throw Error('Duplicate ID '+e.id); ids.add(e.id);
 if(!e.guideSection||!e.description)throw Error('Missing design provenance '+e.id);
 for(const file of Object.values(e.files)){
  if(typeof file!=='string'||file.includes('..')||path.isAbsolute(file))throw Error('Invalid asset path');
  const svg=fs.readFileSync(path.join(root,file),'utf8');
  const pixel=['party','party_echo','enemy','boss','npc','icon','ending'].includes(e.kind);
  if(!svg.includes('viewBox=')||(pixel&&!svg.includes('shape-rendering="crispEdges"')))throw Error('Missing pixel grid '+file);
  if(/<script|<foreignObject|var\(--|(?:href|src)=["']https?:/i.test(svg))throw Error('Nonportable SVG '+file);
  files.add(file);
 }
}
for(const site of ['meridian','halden','basin','capitol','kell'])for(const era of ['2031','2064','2148','2312']){
 const scene=c.entries.find(e=>e.kind==='deep-site'&&e.site===site&&e.era===era);
 if(!scene)throw Error(`Missing ${era} ${site}`);
 for(const key of ['hub','battle','sky','distant','midground','foreground','icon'])if(!scene.files[key])throw Error(`Missing ${key} for ${scene.id}`);
}
for(const era of ['2031','2064','2148','2312'])if(c.entries.filter(e=>e.kind==='waypoint'&&e.era===era).length!==5)throw Error('Expected five named Waypoints in '+era);
if(c.fileCount!==files.size||c.entryCount!==c.entries.length)throw Error('Outdated catalog counts');
console.log(`Art checks passed: ${ids.size} entries, ${files.size} standalone files, all 20 Deep Sites and 20 named Waypoints.`);
// Character poses must fit their sprite cells; clipping would hide weapons or defeat poses.
for(const e of c.entries.filter(e=>['party','party_echo','enemy','boss'].includes(e.kind))){
  const poseBodies=[];
  for(const pose of ['idle','act','hit','down']){
    const file=e.files[pose];if(!file)throw Error(`Missing ${e.id} ${pose}`);
    const svg=fs.readFileSync(path.join(root,file),'utf8');const vb=svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    for(const m of svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g)){
      const [x,y,w,h]=m.slice(1).map(Number);if(x<0||y<0||x+w>+vb[1]||y+h>+vb[2])throw Error(`Clipped sprite pixels: ${file}`);
    }
    poseBodies.push(svg.replace(/<title[\s\S]*?<\/title>/,'').replace(/<desc[\s\S]*?<\/desc>/,''));
  }
  if(new Set(poseBodies).size!==4)throw Error(`Non-distinct poses for ${e.id}`);
}
for(const id of ['auditor','wren','dax','ilo9','mara','hale','quiroga','strand_young']){
 const e=c.entries.find(e=>e.id===id);if(!e?.files.portrait||!e?.files.token)throw Error('Missing party deliverables '+id);
 for(const era of ['2031','2064','2148','2312'])if(!ids.has(`${id}_echo_${era}`))throw Error('Missing Echo '+id+era);
}
console.log('Character cells, distinct poses and all 32 Echo variants validated.');
