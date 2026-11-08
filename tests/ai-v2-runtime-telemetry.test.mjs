
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
