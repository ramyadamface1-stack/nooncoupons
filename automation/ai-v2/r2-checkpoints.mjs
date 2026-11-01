import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const hash=s=>createHash('sha256').update(s).digest('hex');
export function objectPath(config,id){
  if(!/^[a-f0-9]{24}$/.test(id))throw Error('INVALID_ARTICLE_ID');
  const {bucket,prefix}=config.checkpoint;
  if(!/^[a-z0-9-]+$/.test(bucket)||!/^_ops\/ai-v2-checkpoints\/$/.test(prefix))throw Error('UNSAFE_CHECKPOINT_CONFIG');
  return bucket+'/'+prefix+id+'.json';
}
function wrangler(args){
  try{return execFileSync('npx',['--no-install','wrangler',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:1_000_000})}
  catch(e){throw Error('R2_CHECKPOINT_IO_ERROR: '+String(e.stderr||e.message).slice(0,280).replace(/(?i)Bearer\s+\S+/g,'[REDACTED]'))}
}
export function readCheckpoint(config,id,{missingOk=true}={}){
  const dir=mkdtempSync(join(tmpdir(),'ndn-read-')),file=join(dir,'state.json');
  try{
    const path=objectPath(config,id);
    try{wrangler(['r2','object','get',path,'--remote','--file',file])}catch(e){
      if(missingOk&&/404|not found|does not exist|No such key/i.test(String(e.message)))return null;
      throw e;
    }
    if(!existsSync(file))throw Error('R2_GET_DID_NOT_WRITE_FILE');
    const state=JSON.parse(readFileSync(file,'utf8'));
    if(state.articleId!==id)throw Error('CHECKPOINT_ID_MISMATCH');
    return state;
  }finally{rmSync(dir,{recursive:true,force:true})}
}
export function saveCheckpoint(config,state){
  const dir=mkdtempSync(join(tmpdir(),'ndn-write-')),file=join(dir,'state.json');
  try{
    const body=JSON.stringify({...state,updatedAt:new Date().toISOString()});
    writeFileSync(file,body,{mode:0o600});
    const path=objectPath(config,state.articleId);
    wrangler(['r2','object','put',path,'--remote','--file',file,'--content-type','application/json','--force']);
    const persisted=readCheckpoint(config,state.articleId,{missingOk:false});
    const expected=hash(body);
    const actual=hash(JSON.stringify(persisted));
    if(expected!==actual)throw Error('CHECKPOINT_READBACK_HASH_MISMATCH');
    return persisted;
  }finally{rmSync(dir,{recursive:true,force:true})}
}
export function checkpointState(old,phase,patch={}){
  if(!old||!old.articleId)throw Error('CHECKPOINT_ID_REQUIRED');
  const count=Number(old.version||0)+1;
  return {...old,...patch,state:phase,version:count,updatedAt:new Date().toISOString()};
}
