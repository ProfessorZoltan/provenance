import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
for(const name of ['characters','deep-sites','waypoints','support']){
 const run=spawnSync(process.execPath,[`scripts/art-${name}.mjs`],{stdio:'inherit'});
 if(run.status!==0)process.exit(run.status??1);
}
await import('./art-catalog.mjs');
