import {APPROVED_COUPON_CODES,isApprovedCoupon,normalizeApprovedCoupon} from './approved-coupons.js';

const STATE_KEY='maintenance/coupon-code-migration-v1.json';
const TOKEN_RE=/\b(?:OPS\d+|NOV\d+)\b/gi;

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
  for(const obj of page.objects||[]){
    if(!String(obj.key||'').endsWith('.html'))continue;
    scanned++;
    const current=await env.CONTENT_FINAL.get(obj.key);
    if(!current)continue;
    const html=await current.text();
    const fallback=codeForKey(obj.key);
    const fixed=repairText(html,fallback);
    if(!fixed.changed)continue;
    const metadata=current.customMetadata||{};
    await env.CONTENT_FINAL.put(obj.key,fixed.output,{
      httpMetadata:current.httpMetadata||{contentType:'text/html; charset=utf-8'},
      customMetadata:{...metadata,couponCleanup:'nov-v1'}
    });
    updated++;replaced+=fixed.replaced;
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
