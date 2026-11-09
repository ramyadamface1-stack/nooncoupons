
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildSafeMonitor,writeSafeMonitor} from '../automation/ai-v2/runtime-telemetry.mjs';
import {providerCircuitId} from '../automation/ai-v2/provider-circuit.mjs';
import {aiV2AdminMonitor} from '../ai-v2-admin-monitor.js';

const key1='AIza'+'C'.repeat(33),key2='AIza'+'D'.repeat(33),key3='gsk_'+'Z'.repeat(34);
const sha=s=>createHash('sha256').update(s).digest('hex');
test('private monitor includes only key hashes/sources and true quota pause',async()=>{
 const circuit=providerCircuitId('gemini',sha,sha(key1).slice(0,12));
 const reader=async id=>id===circuit?{state:'PAUSED_QUOTA',resumeAt:'2099-11-08T12:00:00Z'}:null;
 const env={GEMINI_API_KEY:key1,NDN_GEMINI_POOL_01:key2,GROQ_API_KEY:key3};
 const monitor=await buildSafeMonitor(env,{market:'SA',reader,lastReport:{
  status:'SKIPPED',reason:'QUEUE_WINDOW_EMPTY'
 },lastSelected:{provider:'gemini',keyRef:sha(key1).slice(0,12),source:'GEMINI_API_KEY',model:'test-model',at:'2026-11-08T10:00:00Z'}});
 assert.equal(monitor.providers.gemini.total,2);
 assert.equal(monitor.providers.gemini.counts.quotaWait,1);
 assert.equal(monitor.providers.gemini.counts.eligibleUnverified,1);
 assert.equal(monitor.providers.groq.total,1);
 assert.equal(monitor.selected.id,sha(key1).slice(0,12));
 assert.equal(monitor.keyMaterialIncluded,false);
 const out=JSON.stringify(monitor);
 for(const secret of [key1,key2,key3])assert.ok(!out.includes(secret),'must not expose raw key');
 assert.equal(monitor.lastOutcome.published,false);
});
test('if global provider quota is paused, every inspected key is marked waiting',async()=>{
 const global=providerCircuitId('groq',sha);
 const monitor=await buildSafeMonitor({GROQ_API_KEY:key3},{
  market:'AE',reader:async id=>id===global?{state:'PAUSED_QUOTA',resumeAt:'2099-01-01T00:00:00Z'}:null
 });
 assert.equal(monitor.providers.groq.globalPaused,true);
 assert.equal(monitor.providers.groq.counts.quotaWait,1);
});
test('monitor R2 writes only safe JSON to existing namespace',async()=>{
 const monitor=await buildSafeMonitor({GEMINI_API_KEY:key1},{
  market:'AE',reader:async()=>null
 });
 const calls=[];
 const fetchFn=async(url,opts)=>{calls.push({url,opts});return new Response(null,{status:200})};
 const result=await writeSafeMonitor(monitor,{
  CLOUDFLARE_API_TOKEN:'unit-test-token-not-real',
  CLOUDFLARE_ACCOUNT_ID:'e4c35f8a50a7b2e4cfb9d6c534962603'
 },fetchFn);
 assert.equal(result.ok,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.method,'PUT');
 assert.match(calls[0].url,/nooncoupons-content-v2\/objects\/_ops\/ai-v2-runtime-AE.json/);
 assert.ok(!calls[0].opts.body.includes(key1));
 assert.equal(await writeSafeMonitor(monitor,{}).then(x=>x.ok),false);
});
test('private admin status never infers working provider from unavailable R2 or scheduler',async()=>{
 const fake={CONTENT_FINAL:{get:async()=>null}};
 const result=await aiV2AdminMonitor(fake,async()=>{throw Error('offline')});
 assert.equal(result.status,'scheduler-unreachable');
 assert.equal(result.scheduler.reachable,false);
 assert.equal(result.providers.gemini,null);
 assert.equal(result.verified.lastHour?.total??0,0,'empty verified ledger cannot imply articles published');
 assert.equal(result.safety.configuredDoesNotMeanValidated,true);
});

test('admin monitoring never loads the giant publication ledger and reports queue saturation clearly',async()=>{
 const now=new Date().toISOString();
 const market={version:1,market:'SA',keyMaterialIncluded:false,generatedAt:now,
   providers:{gemini:{total:43,counts:{eligibleUnverified:43,quotaWait:0,providerWait:0,unverified:0,notInspected:0},entries:[]},
    groq:{total:1,counts:{eligibleUnverified:1,quotaWait:0,providerWait:0,unverified:0,notInspected:0},entries:[]}},
   lastOutcome:{status:'SKIPPED',reason:'QUEUE_WINDOW_EMPTY'},selected:null};
 const summary={version:1,generatedAt:now,windows:{'1h':{total:0},'24h':{total:3}},
  lastArticle:{slug:'test-valid-publication',country:'SA',publishedAt:now}};
 const accessed=[];
 const env={CONTENT_FINAL:{get:async key=>{
  accessed.push(key);
  if(key.includes('publication-ledger'))throw Error('full ledger should never be read by admin');
  if(key==='_ops/ai-v2-runtime-SA.json')return {json:async()=>market};
  if(key==='_ops/ai-v2-verified-summary-v1.json')return {json:async()=>summary};
  return null;
 }}};
 const result=await aiV2AdminMonitor(env,async()=>Response.json({
  ok:true,source:'admin-do-policy-plus-explicit-runtime-secret',
  schedulerEnabled:true,intervalMinutes:1,controlStatus:'POLICY_VERIFIED'
 }));
 assert.equal(result.ok,true);
 assert.equal(result.status,'queue-no-eligible-topics');
 assert.equal(result.providers.gemini.total,43);
 assert.equal(result.verified.ledgerAvailable,true);
 assert.equal(result.verified.lastHour.total,0);
 assert.ok(!accessed.some(key=>key.includes('publication-ledger')));
});
test('no R2 summary means verified count unknown rather than falsely zero',async()=>{
 const env={CONTENT_FINAL:{get:async()=>null}};
 const result=await aiV2AdminMonitor(env,async()=>Response.json({
  ok:true,source:'admin-do-policy-plus-explicit-runtime-secret',
  schedulerEnabled:true,intervalMinutes:1,controlStatus:'POLICY_VERIFIED'
 }));
 assert.equal(result.status,'scheduler-active-no-fresh-report');
 assert.equal(result.verified.ledgerAvailable,false);
 assert.equal(result.verified.lastHour,null);
 assert.equal(result.verified.reason,'SUMMARY_NOT_YET_WRITTEN');
});

test('existing Cloudflare service binding supplies verified fallback when canonical health is unreachable',async()=>{
 let called=0;
 const now=new Date().toISOString();
 const env={CONTENT_FINAL:{get:async key=>key.endsWith('runtime-SA.json')?{
  json:async()=>({version:1,market:'SA',keyMaterialIncluded:false,generatedAt:now,
   lastOutcome:{status:'SKIPPED',reason:'QUEUE_WINDOW_EMPTY'},selected:null,providers:{gemini:{total:43,counts:{eligibleUnverified:43,quotaWait:0,providerWait:0,unverified:0,notInspected:0},entries:[]},
    groq:{total:1,counts:{eligibleUnverified:1,quotaWait:0,providerWait:0,unverified:0,notInspected:0},entries:[]}}})
 }:null},AI_V2_SCHEDULER:{fetch:async request=>{
   called++;assert.match(String(request),/noondealsnow-ai-scheduler-v2/);
   return Response.json({ok:true,source:'admin-do-policy-plus-explicit-runtime-secret',
      schedulerEnabled:true,controlStatus:'POLICY_VERIFIED',intervalMinutes:1});
 }}};
 const result=await aiV2AdminMonitor(env,async()=>{throw Error('canonical health inaccessible')});
 assert.equal(called,1);
 assert.equal(result.scheduler.reachable,true);
 assert.equal(result.scheduler.enabled,true);
 assert.equal(result.status,'queue-no-eligible-topics');
});


test('canonical live scheduler wins over a stale disabled internal service binding',async()=>{
 const env={CONTENT_FINAL:{get:async()=>null},AI_V2_SCHEDULER:{fetch:async()=>Response.json({
  ok:true,source:'admin-do-policy-plus-explicit-runtime-secret',schedulerEnabled:false,
  intervalMinutes:1,controlStatus:'POLICY_VERIFIED'})}};
 const result=await aiV2AdminMonitor(env,async()=>Response.json({
  ok:true,source:'admin-do-policy-plus-explicit-runtime-secret',schedulerEnabled:true,
  intervalMinutes:1,controlStatus:'POLICY_VERIFIED'}));
 assert.equal(result.scheduler.enabled,true);
 assert.equal(result.scheduler.statusSource,'PUBLIC_CLOUDFLARE_HEALTH');
 assert.equal(result.scheduler.internalFallback,false);
 assert.equal(result.status,'scheduler-active-no-fresh-report');
});

test('public health unavailable and stale disabled binding must not falsely claim OFF',async()=>{
 const env={CONTENT_FINAL:{get:async()=>null},AI_V2_SCHEDULER:{fetch:async()=>Response.json({
  ok:true,source:'admin-do-policy-plus-explicit-runtime-secret',schedulerEnabled:false,
  intervalMinutes:1,controlStatus:'POLICY_VERIFIED'})}};
 const result=await aiV2AdminMonitor(env,async()=>{throw Error('network unavailable')});
 assert.equal(result.scheduler.reachable,false);
 assert.equal(result.scheduler.statusSource,'HEALTH_SOURCES_UNVERIFIED');
 assert.equal(result.status,'scheduler-unreachable');
});

test('verified disabled live canonical scheduler is correctly displayed as paused',async()=>{
 const result=await aiV2AdminMonitor({CONTENT_FINAL:{get:async()=>null}},async()=>Response.json({
  ok:true,source:'admin-do-policy-plus-explicit-runtime-secret',schedulerEnabled:false,
  intervalMinutes:1,controlStatus:'POLICY_VERIFIED'}));
 assert.equal(result.scheduler.reachable,true);
 assert.equal(result.scheduler.enabled,false);
 assert.equal(result.status,'paused');
});
