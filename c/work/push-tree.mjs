import {execFileSync} from 'node:child_process';
const names=execFileSync('git',['diff-tree','--no-commit-id','--name-only','-r','HEAD'],{encoding:'utf8'}).trim().split('\n');
const batch=Number(process.argv[2]);
const selected=names.slice(batch*50,(batch+1)*50);
console.log(JSON.stringify(selected.map(p=>({path:p,mode:'100644',type:'blob',content:execFileSync('git',['show','HEAD:'+p],{encoding:'utf8',maxBuffer:8*1024*1024})}))));
