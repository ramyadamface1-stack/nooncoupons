import {APPROVED_COUPON_CODES,isApprovedCoupon,normalizeApprovedCoupon} from './approved-coupons.js';

const STATE_KEY='maintenance/coupon-code-migration-v1.json';
const AUDIT_STATE_KEY='maintenance/coupon-code-audit-v2.json';
const TOKEN_RE=/\b(?:OPS\d+|NOV\d+)\b/gi;

async function r2Retry(fn,attempts=4){
  let last;
  for(let i=0;i<attempts;i++){
    try{return await fn();}
    catch(err){
      last=err;
      if(i+1<attempts)await new Promise(resolve=>setTimeout(resolve,100*(i+1)));
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

export async function runCouponR2MigrationBatch(env,{limit=100}={}){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  let state={version:1,cursor:null,scanned:0,updated:0,replaced:0,done:false,startedAt:new Date().toISOString()};
  const prev=await env.CONTENT_FINAL.get(STATE_KEY);
  if(prev){
    try{state={...state,...JSON.parse(await prev.text())};}catch{}
  }
  if(state.done)return {ok:true,...state};

  const page=await env.CONTENT_FINAL.list({prefix:'articles/',cursor:state.cursor||undefined,limit:Math.max(1,Math.min(Number(limit)||100,500))});
  let scanned=0,updated=0,replaced=0;
  const objects=(page.objects||[]).filter(obj=>String(obj.key||'').endsWith('.html'));
  scanned=objects.length;

  async function repairObject(obj){
    const current=await r2Retry(()=>env.CONTENT_FINAL.get(obj.key));
    if(!current)return {updated:0,replaced:0};
    const html=await current.text();
    const fallback=codeForKey(obj.key);
    const fixed=repairText(html,fallback);
    if(!fixed.changed)return {updated:0,replaced:0};
    const metadata=current.customMetadata||{};
    await r2Retry(()=>env.CONTENT_FINAL.put(obj.key,fixed.output,{
      httpMetadata:current.httpMetadata||{contentType:'text/html; charset=utf-8'},
      customMetadata:{...metadata,couponCleanup:'nov-v1'}
    }));
    return {updated:1,replaced:fixed.replaced};
  }

  const concurrency=50;
  for(let i=0;i<objects.length;i+=concurrency){
    const results=await Promise.all(objects.slice(i,i+concurrency).map(repairObject));
    for(const row of results){updated+=row.updated;replaced+=row.replaced;}
  }

  const next={
    ...state,
    cursor:page.truncated?page.cursor:null,
    scanned:Number(state.scanned||0)+scanned,
    updated:Number(state.updated||0)+updated,
    replaced:Number(state.replaced||0)+replaced,
    done:!page.truncated,
    lastBatchAt:new Date().toISOString(),
    completedAt:!page.truncated?new Date().toISOString():state.completedAt||null
  };
  await env.CONTENT_FINAL.put(STATE_KEY,JSON.stringify(next),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return {ok:true,batch:{scanned,updated,replaced},...next};
}

export async function readCouponR2MigrationState(env){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const obj=await env.CONTENT_FINAL.get(STATE_KEY);
  if(!obj)return {ok:true,version:1,scanned:0,updated:0,replaced:0,done:false};
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

export async function runCouponR2AuditBatch(env,{limit=500}={}){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  let state={version:2,cursor:null,scanned:0,invalidFiles:0,invalidTokens:0,samples:[],done:false,startedAt:new Date().toISOString()};
  const prev=await env.CONTENT_FINAL.get(AUDIT_STATE_KEY);
  if(prev){
    try{state={...state,...JSON.parse(await prev.text())};}catch{}
  }
  if(state.done)return {ok:true,...state};

  const page=await env.CONTENT_FINAL.list({prefix:'articles/',cursor:state.cursor||undefined,limit:Math.max(1,Math.min(Number(limit)||500,500))});
  const objects=(page.objects||[]).filter(obj=>String(obj.key||'').endsWith('.html'));
  let invalidFiles=0,invalidTokens=0;
  const samples=[];

  async function auditObject(obj){
    const current=await r2Retry(()=>env.CONTENT_FINAL.get(obj.key));
    if(!current)return {invalidFiles:0,invalidTokens:0,samples:[]};
    const bad=invalidCouponTokens(await current.text());
    if(!bad.length)return {invalidFiles:0,invalidTokens:0,samples:[]};
    return {invalidFiles:1,invalidTokens:bad.length,samples:[{key:obj.key,tokens:[...new Set(bad)].sort()}]};
  }

  const concurrency=50;
  for(let i=0;i<objects.length;i+=concurrency){
    const results=await Promise.all(objects.slice(i,i+concurrency).map(auditObject));
    for(const row of results){
      invalidFiles+=row.invalidFiles;
      invalidTokens+=row.invalidTokens;
      if(samples.length<20)samples.push(...row.samples.slice(0,20-samples.length));
    }
  }

  const next={
    ...state,
    cursor:page.truncated?page.cursor:null,
    scanned:Number(state.scanned||0)+objects.length,
    invalidFiles:Number(state.invalidFiles||0)+invalidFiles,
    invalidTokens:Number(state.invalidTokens||0)+invalidTokens,
    samples:[...(state.samples||[]),...samples].slice(0,20),
    done:!page.truncated,
    lastBatchAt:new Date().toISOString(),
    completedAt:!page.truncated?new Date().toISOString():state.completedAt||null
  };
  await env.CONTENT_FINAL.put(AUDIT_STATE_KEY,JSON.stringify(next),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return {ok:true,batch:{scanned:objects.length,invalidFiles,invalidTokens},...next};
}

export async function readCouponR2AuditState(env){
  if(!env?.CONTENT_FINAL)return {ok:false,reason:'r2_binding_missing'};
  const obj=await env.CONTENT_FINAL.get(AUDIT_STATE_KEY);
  if(!obj)return {ok:true,version:2,scanned:0,invalidFiles:0,invalidTokens:0,samples:[],done:false};
  try{return {ok:true,...JSON.parse(await obj.text())};}catch{return {ok:false,reason:'invalid_audit_state'};}
}
