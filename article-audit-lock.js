const KEY='maintenance/article-corpus-audit-lock-v1.json';
const DEFAULT_TTL_MS=20*60*1000;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function retry(fn,attempts=4){
  let last;
  for(let i=0;i<attempts;i++){
    try{return await fn()}catch(e){last=e;if(i+1<attempts)await sleep(Math.min(1200,100*(2**i)))}
  }
  throw last;
}

function activePayload(runId,ttlMs=DEFAULT_TTL_MS){
  const now=Date.now();
  return {version:1,active:true,runId:String(runId||''),startedAt:new Date(now).toISOString(),heartbeatAt:new Date(now).toISOString(),expiresAt:new Date(now+ttlMs).toISOString()};
}

export async function acquireArticleAuditLock(env,runId,{ttlMs=DEFAULT_TTL_MS}={}){
  if(!env?.CONTENT_FINAL)throw new Error('r2_binding_missing');
  const owner=String(runId||'').trim();if(!owner)throw new Error('audit_run_id_required');
  const payload=activePayload(owner,ttlMs);
  await retry(()=>env.CONTENT_FINAL.put(KEY,JSON.stringify(payload),{httpMetadata:{contentType:'application/json; charset=utf-8'}}));
  return payload;
}

export async function refreshArticleAuditLock(env,runId,{ttlMs=DEFAULT_TTL_MS}={}){
  if(!env?.CONTENT_FINAL)throw new Error('r2_binding_missing');
  const owner=String(runId||'').trim();if(!owner)throw new Error('audit_run_id_required');
  const current=await readArticleAuditLock(env);
  if(current.active&&current.runId&&current.runId!==owner)throw new Error('audit_lock_owned_by_other_run');
  const now=Date.now(),payload={version:1,active:true,runId:owner,startedAt:current.startedAt||new Date(now).toISOString(),heartbeatAt:new Date(now).toISOString(),expiresAt:new Date(now+ttlMs).toISOString()};
  await retry(()=>env.CONTENT_FINAL.put(KEY,JSON.stringify(payload),{httpMetadata:{contentType:'application/json; charset=utf-8'}}));
  return payload;
}

export async function releaseArticleAuditLock(env,runId){
  if(!env?.CONTENT_FINAL)return false;
  const owner=String(runId||'').trim();
  let current=null;
  try{const o=await retry(()=>env.CONTENT_FINAL.get(KEY));if(o)current=JSON.parse(await o.text())}catch{return false}
  if(!current)return true;
  if(owner&&current.runId&&current.runId!==owner)return false;
  try{await retry(()=>env.CONTENT_FINAL.delete(KEY));return true}catch{return false}
}

export async function readArticleAuditLock(env){
  if(!env?.CONTENT_FINAL)return {active:false,reason:'r2_binding_missing',key:KEY};
  try{
    const o=await retry(()=>env.CONTENT_FINAL.get(KEY));
    if(!o)return {active:false,key:KEY};
    const x=JSON.parse(await o.text()),expires=Date.parse(x?.expiresAt||''),heartbeat=Date.parse(x?.heartbeatAt||x?.startedAt||'');
    if(x?.active!==true)return {active:false,key:KEY,...x};
    const effectiveExpires=Number.isFinite(expires)?expires:(Number.isFinite(heartbeat)?heartbeat+DEFAULT_TTL_MS:0);
    if(!effectiveExpires||effectiveExpires<=Date.now())return {active:false,expired:true,key:KEY,...x,effectiveExpiresAt:effectiveExpires?new Date(effectiveExpires).toISOString():null};
    return {active:true,key:KEY,...x,effectiveExpiresAt:new Date(effectiveExpires).toISOString()};
  }catch(e){
    return {active:true,failClosed:true,key:KEY,reason:'audit_lock_read_failed',error:String(e?.message||e).slice(0,160)};
  }
}

export async function publicationBlockedByArticleAudit(env){
  const lock=await readArticleAuditLock(env);
  return lock.active?lock:null;
}

export const ARTICLE_AUDIT_LOCK_INFO={version:1,key:KEY,ttlMinutes:DEFAULT_TTL_MS/60000,publicationFailClosed:true};
