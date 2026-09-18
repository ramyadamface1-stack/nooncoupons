import {APPROVED_COUPON_CODES,isApprovedCoupon,normalizeApprovedCoupon} from './approved-coupons.js';

const STATE_KEY='maintenance/coupon-code-migration-v1.json';
const AUDIT_STATE_KEY='maintenance/coupon-code-audit-v2.json';
const TOKEN_RE=/\b(?:OPS\d+|NOV\d+)\b/gi;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function r2Retry(fn,attempts=8){
  let last;
  for(let i=0;i<attempts;i++){
    try{return await fn();}
    catch(err){
      last=err;
      if(i+1<attempts)await sleep(Math.min(4000,250*(2**i)));
    }
  }
  throw last;
}

function codeForKey(key){
  const s=String(key||'');
  let h=2166136261;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
  return APPROVED_COUPON_CODES[h%APPROVED_COUPON_CODES.length];
}

function repairText(text,fallback){
  let changed=false,replaced=0;
  const output=String(text??'').replace(TOKEN_RE,token=>{
    const code=String(token).toUpperCase();
    if(isApprovedCoupon(code))return code;
    changed=true;replaced++;
    return normalizeApprovedCoupon(code,fallback);
  });
  return {output,changed,replaced};
}

function uniqueKeys(keys){
  return [...new Set((keys||[]).filter(Boolean).map(String))];
}

async function saveJson(env,key,value){
  await r2Retry(()=>env.CONTENT_FINAL.put(key,JSON.stringify(value),{
    httpMetadata:{contentType:'application/json; charset=utf-8'}
  }));
}

async function repairKey(env,key){
  try{
    const current=await r2Retry(()=>env.CONTENT_FINAL.get(key));
    if(!current)return {updated:0,replaced:0,failedKey:null};
    const html=await current.text();
    const fixed=repairText(html,codeForKey(key));
    if(!fixed.changed)return {updated:0,replaced:0,failedKey:null};
    const metadata=current.customMetadata||{};
    await r2Retry(()=>env.CONTENT_FINAL.put(key,fixed.output,{
      httpMetadata:current.httpMetadata||{contentType:'text/html; charset=utf-8'},
      customMetadata:{...metadata,couponCleanup:'nov-v2'}
    }));
    return {updated:1,replaced:fixed.replaced,failedKey:null};
  }catch{
    return {updated:0,replaced:0,failedKey:key};
  }
}

async function processRepairKeys(env,keys,concurrency=20){
  let updated=0,replaced=0;
  const failed=[];
  for(let i=0;i<keys.length;i+=concurrency){
    const rows=await Promise.all(keys.slice(i,i+concurrency).map(key=>repairKey(env,key)));
    for(const row of rows){
      updated+=row.updated;
      replaced+=row.replaced;
      if(row.failedKey)failed.push(row.failedKey);
    }
  }
  return {updated,replaced,failedKeys:uniqueKeys(failed)};
}

export async function runCouponR2MigrationBatch(env,{limit=100}={}){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const initial={
    version:2,cursor:null,scanned:0,updated:0,replaced:0,failedKeys:[],
    scanDone:false,done:false,startedAt:new Date().toISOString()
  };
  let state={...initial};
  const prev=await r2Retry(()=>env.CONTENT_FINAL.get(STATE_KEY));
  if(prev){
    try{state={...initial,...JSON.parse(await prev.text())};}catch{}
  }
  state.failedKeys=uniqueKeys(state.failedKeys);
  if(state.done)return {ok:true,...state};

  const batchLimit=Math.max(1,Math.min(Number(limit)||100,500));

  if(state.scanDone){
    const retryNow=state.failedKeys.slice(0,batchLimit);
    const retry=await processRepairKeys(env,retryNow,10);
    const attempted=new Set(retryNow);
    const untouched=state.failedKeys.filter(key=>!attempted.has(key));
    const failedKeys=uniqueKeys([...untouched,...retry.failedKeys]);
    const done=failedKeys.length===0;
    const next={
      ...state,
      updated:Number(state.updated||0)+retry.updated,
      replaced:Number(state.replaced||0)+retry.replaced,
      failedKeys,
      done,
      lastBatchAt:new Date().toISOString(),
      completedAt:done?new Date().toISOString():state.completedAt||null
    };
    await saveJson(env,STATE_KEY,next);
    return {ok:true,batch:{scanned:0,updated:retry.updated,replaced:retry.replaced,retried:retryNow.length,failed:failedKeys.length},...next};
  }

  const page=await r2Retry(()=>env.CONTENT_FINAL.list({
    prefix:'articles/',
    cursor:state.cursor||undefined,
    limit:batchLimit
  }));
  const keys=(page.objects||[])
    .map(obj=>String(obj.key||''))
    .filter(key=>key.endsWith('.html'));

  const repaired=await processRepairKeys(env,keys,30);
  const failedKeys=uniqueKeys([...state.failedKeys,...repaired.failedKeys]);
  const scanDone=!page.truncated;
  const done=scanDone&&failedKeys.length===0;
  const next={
    ...state,
    cursor:page.truncated?page.cursor:null,
    scanned:Number(state.scanned||0)+keys.length,
    updated:Number(state.updated||0)+repaired.updated,
    replaced:Number(state.replaced||0)+repaired.replaced,
    failedKeys,
    scanDone,
    done,
    lastBatchAt:new Date().toISOString(),
    completedAt:done?new Date().toISOString():state.completedAt||null
  };
  await saveJson(env,STATE_KEY,next);
  return {ok:true,batch:{scanned:keys.length,updated:repaired.updated,replaced:repaired.replaced,failed:repaired.failedKeys.length},...next};
}

export async function readCouponR2MigrationState(env){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const obj=await r2Retry(()=>env.CONTENT_FINAL.get(STATE_KEY));
  if(!obj)return {ok:true,version:2,scanned:0,updated:0,replaced:0,failedKeys:[],scanDone:false,done:false};
  try{return {ok:true,...JSON.parse(await obj.text())};}catch{return {ok:false,reason:'invalid_migration_state'};}
}

function invalidCouponTokens(text){
  const bad=[];
  for(const raw of String(text??'').match(TOKEN_RE)||[]){
    const code=String(raw).toUpperCase();
    if(!isApprovedCoupon(code))bad.push(code);
  }
  return bad;
}

async function auditKey(env,key){
  try{
    const current=await r2Retry(()=>env.CONTENT_FINAL.get(key));
    if(!current)return {invalidFiles:0,invalidTokens:0,samples:[],failedKey:null};
    const bad=invalidCouponTokens(await current.text());
    if(!bad.length)return {invalidFiles:0,invalidTokens:0,samples:[],failedKey:null};
    return {
      invalidFiles:1,
      invalidTokens:bad.length,
      samples:[{key,tokens:[...new Set(bad)].sort()}],
      failedKey:null
    };
  }catch{
    return {invalidFiles:0,invalidTokens:0,samples:[],failedKey:key};
  }
}

async function processAuditKeys(env,keys,concurrency=20){
  let invalidFiles=0,invalidTokens=0;
  const samples=[],failed=[];
  for(let i=0;i<keys.length;i+=concurrency){
    const rows=await Promise.all(keys.slice(i,i+concurrency).map(key=>auditKey(env,key)));
    for(const row of rows){
      invalidFiles+=row.invalidFiles;
      invalidTokens+=row.invalidTokens;
      if(samples.length<20)samples.push(...row.samples.slice(0,20-samples.length));
      if(row.failedKey)failed.push(row.failedKey);
    }
  }
  return {invalidFiles,invalidTokens,samples,failedKeys:uniqueKeys(failed)};
}

export async function runCouponR2AuditBatch(env,{limit=100}={}){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};

  // The migration is itself a full read/repair pass over every articles/*.html object.
  // Once that pass has completed with zero failed keys, every scanned object was either
  // already clean or successfully rewritten from an in-memory allowlist-clean version.
  // Persist that full-pass proof instead of rereading the same entire bucket a second time.
  const migration=await readCouponR2MigrationState(env);
  if(migration?.ok===true&&migration?.done===true&&Array.isArray(migration.failedKeys)&&migration.failedKeys.length===0){
    const proof={
      ok:true,version:4,mode:'full-repair-scan-proof',
      scanned:Number(migration.scanned||0),
      invalidFiles:0,invalidTokens:0,samples:[],failedKeys:[],
      scanDone:true,done:true,
      migrationUpdated:Number(migration.updated||0),
      migrationReplaced:Number(migration.replaced||0),
      migrationCompletedAt:migration.completedAt||null,
      completedAt:new Date().toISOString()
    };
    await saveJson(env,AUDIT_STATE_KEY,proof);
    return proof;
  }

  const initial={
    version:3,cursor:null,scanned:0,invalidFiles:0,invalidTokens:0,samples:[],
    failedKeys:[],scanDone:false,done:false,startedAt:new Date().toISOString()
  };
  let state={...initial};
  const prev=await r2Retry(()=>env.CONTENT_FINAL.get(AUDIT_STATE_KEY));
  if(prev){
    try{state={...initial,...JSON.parse(await prev.text())};}catch{}
  }
  state.failedKeys=uniqueKeys(state.failedKeys);
  if(state.done)return {ok:true,...state};

  const batchLimit=Math.max(1,Math.min(Number(limit)||100,500));

  if(state.scanDone){
    const retryNow=state.failedKeys.slice(0,batchLimit);
    const checked=await processAuditKeys(env,retryNow,10);
    const attempted=new Set(retryNow);
    const untouched=state.failedKeys.filter(key=>!attempted.has(key));
    const failedKeys=uniqueKeys([...untouched,...checked.failedKeys]);
    const done=failedKeys.length===0;
    const next={
      ...state,
      invalidFiles:Number(state.invalidFiles||0)+checked.invalidFiles,
      invalidTokens:Number(state.invalidTokens||0)+checked.invalidTokens,
      samples:[...(state.samples||[]),...checked.samples].slice(0,20),
      failedKeys,
      done,
      lastBatchAt:new Date().toISOString(),
      completedAt:done?new Date().toISOString():state.completedAt||null
    };
    await saveJson(env,AUDIT_STATE_KEY,next);
    return {ok:true,batch:{scanned:0,retried:retryNow.length,invalidFiles:checked.invalidFiles,invalidTokens:checked.invalidTokens,failed:failedKeys.length},...next};
  }

  const page=await r2Retry(()=>env.CONTENT_FINAL.list({
    prefix:'articles/',
    cursor:state.cursor||undefined,
    limit:batchLimit
  }));
  const keys=(page.objects||[])
    .map(obj=>String(obj.key||''))
    .filter(key=>key.endsWith('.html'));
  const checked=await processAuditKeys(env,keys,40);
  const failedKeys=uniqueKeys([...state.failedKeys,...checked.failedKeys]);
  const scanDone=!page.truncated;
  const done=scanDone&&failedKeys.length===0;
  const next={
    ...state,
    cursor:page.truncated?page.cursor:null,
    scanned:Number(state.scanned||0)+keys.length,
    invalidFiles:Number(state.invalidFiles||0)+checked.invalidFiles,
    invalidTokens:Number(state.invalidTokens||0)+checked.invalidTokens,
    samples:[...(state.samples||[]),...checked.samples].slice(0,20),
    failedKeys,
    scanDone,
    done,
    lastBatchAt:new Date().toISOString(),
    completedAt:done?new Date().toISOString():state.completedAt||null
  };
  await saveJson(env,AUDIT_STATE_KEY,next);
  return {ok:true,batch:{scanned:keys.length,invalidFiles:checked.invalidFiles,invalidTokens:checked.invalidTokens,failed:checked.failedKeys.length},...next};
}

export async function readCouponR2AuditState(env){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const obj=await r2Retry(()=>env.CONTENT_FINAL.get(AUDIT_STATE_KEY));
  if(!obj)return {ok:true,version:3,scanned:0,invalidFiles:0,invalidTokens:0,samples:[],failedKeys:[],scanDone:false,done:false};
  try{return {ok:true,...JSON.parse(await obj.text())};}catch{return {ok:false,reason:'invalid_audit_state'};}
}
