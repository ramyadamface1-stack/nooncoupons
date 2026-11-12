import test from 'node:test';
import assert from 'node:assert/strict';
import {DIRECT_READY_TARGET,planGenerationMarkets,planQuotaCooldown} from '../cloudflare-ai-direct/production-guard.mjs';
import {readFileSync} from 'node:fs';
import {inspectNativeReadyStock} from '../cloudflare-ai-direct/stock-housekeeping.mjs';
const source=readFileSync(new URL('../cloudflare-ai-direct/engine.mjs',import.meta.url),'utf8');

test('native generation fills a bounded R2 buffer and only runs one market at stable stock',()=>{
 assert.equal(DIRECT_READY_TARGET,12);
 assert.deepEqual(planGenerationMarkets(0,100),['SA','AE']);
 assert.deepEqual(planGenerationMarkets(3,101),['SA','AE']);
 assert.deepEqual(planGenerationMarkets(4,100),['SA']);
 assert.deepEqual(planGenerationMarkets(11,101),['AE']);
 assert.deepEqual(planGenerationMarkets(12,102),[]);
 assert.deepEqual(planGenerationMarkets(40,103),[]);
 for(const bad of [-1,NaN,1.5])assert.throws(()=>planGenerationMarkets(bad,3),/INVALID_DIRECT_PRODUCTION_PLAN/);
 assert.match(source,/READY_STOCK_BACKPRESSURE/);
 assert.match(source,/READY_STOCK_OVER_LIMIT_PAUSED/);
 assert.match(source,/planGenerationMarkets\(readyStock\.activeCount,minute\)/);
 assert.match(source,/inspectNativeReadyStock\(env\.CONTENT_FINAL\)/);
 assert.match(source,/Promise\.allSettled\(markets\.map/);
});

test('per-key provider quota cooling increases and caps at four hours without retrying 5xx',()=>{
 const instant=Date.parse('2026-11-12T21:00:00Z');
 const firstGemini=planQuotaCooldown('gemini',0,instant);
 assert.equal(firstGemini.failures,1);
 assert.equal(firstGemini.cooldownMs,15*60000);
 assert.equal(firstGemini.until,'2026-11-12T21:15:00.000Z');
 assert.equal(planQuotaCooldown('gemini',3,instant).cooldownMs,2*3600000);
 assert.equal(planQuotaCooldown('gemini',5,instant).cooldownMs,4*3600000);
 assert.equal(planQuotaCooldown('groq',0,instant).cooldownMs,3*60000);
 assert.equal(planQuotaCooldown('groq',5,instant).cooldownMs,96*60000);
 assert.throws(()=>planQuotaCooldown('workers-ai',0,instant),/INVALID_PROVIDER_COOLDOWN/);
 assert.throws(()=>planQuotaCooldown('groq',-1,instant),/INVALID_PROVIDER_COOLDOWN/);
 assert.match(source,/provider-quota-cooldown\//);
 assert.match(source,/if\(action==='NEXT_FREE_KEY'\)/);
 assert.match(source,/QUOTA_COOLDOWN_WRITE_UNCONFIRMED/);
 assert.match(source,/if\(action==='QUARANTINE_UNKNOWN'\)/);
 assert.doesNotMatch(source,/api\.github\.com|actions\/workflows/);
});

test('production exposes redacted publication outcomes without any API key',async()=>{
 const {directStatus}=await import('../cloudflare-ai-direct/engine.mjs');
 const before=globalThis.fetch;
 const observation={at:'2026-11-12T21:50:00Z',containsRawKeys:false,
  publicationMode:'cloudflare-direct-production',
  results:[{ok:false,reason:'PUBLICATION_SLOT_NOT_DUE',slug:null},
   {ok:true,reason:'LIVE_VERIFIED',slug:'uae-buyer-verified-nov188-2026-n11'}]};
 const key='_ops/noondealsnow-direct-ai-v1/publication-observation.json';
 globalThis.fetch=async url=>{
  assert.equal(String(url),'https://noondealsnow.com/api/ai-v2-control-policy');
  return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 const env={DIRECT_AI_STAGE:'production',SITE_PUBLISH_TOKEN:'DO_NOT_DISPLAY_SECRET',CONTENT_FINAL:{
  async get(k){return k===key?{json:async()=>observation}:null},
  async list(){return {objects:[],truncated:false}}
 }};
 try{
  const status=await directStatus(env);
  assert.equal(status.schedulerEnabled,true);
  assert.deepEqual(status.lastPublication,observation);
  assert.deepEqual(status.lastPublication.results.map(x=>x.reason),
   ['PUBLICATION_SLOT_NOT_DUE','LIVE_VERIFIED']);
  assert.doesNotMatch(JSON.stringify(status),/DO_NOT_DISPLAY_SECRET/);
  assert.match(source,/publication-observation\.json/);
  assert.match(source,/containsRawKeys:false/);
 }finally{globalThis.fetch=before}
});

test('R2 inventory counts genuine READY and unresolved outcomes, not rejected records',async()=>{
 const ROOT='_ops/noondealsnow-direct-ai-v1/',READY=ROOT+'ready/';
 const map=new Map();
 const add=(slug,state)=>map.set(READY+slug+'.json',{state,topic:{slug}});
 add('sa-ready-article-2026','READY');
 add('ae-ready-article-2026','READY');
 add('ae-unknown-article-2026','UNKNOWN_PUBLICATION_OUTCOME');
 for(let i=0;i<14;i++)add('sa-blocked-article-'+i+'-2026','BLOCKED_REVIEW');
 add('sa-verified-article-2026','LIVE_VERIFIED');
 map.set(ROOT+'checkpoint/sa-verified-article-2026.json',{state:'LIVE_VERIFIED'});
 const deleted=[];
 const bucket={
  async list({prefix,limit}){const keys=[...map.keys()].filter(x=>x.startsWith(prefix)).sort();
   return {objects:keys.slice(0,limit).map(key=>({key})),truncated:keys.length>limit}},
  async get(key){const row=map.get(key);return row?{json:async()=>row}:null},
  async head(key){return map.has(key)?{etag:'exists'}:null},
  async put(key,value,{onlyIf}={}){if(onlyIf?.etagDoesNotMatch==='*'&&map.has(key))return null;
   map.set(key,JSON.parse(value));return {etag:'saved'}},
  async delete(key){deleted.push(key);map.delete(key)}
 };
 const first=await inspectNativeReadyStock(bucket,{maxCleanup:4});
 assert.equal(first.readyCount,2);
 assert.equal(first.unknownCount,1);
 assert.equal(first.activeCount,3);
 assert.equal(first.quarantined+first.cleanedVerified,4);
 assert.equal(deleted.length,4);
 assert.equal(map.has(READY+'ae-unknown-article-2026.json'),true);
 for(let attempt=0;attempt<5;attempt++)await inspectNativeReadyStock(bucket,{maxCleanup:4});
 const done=await inspectNativeReadyStock(bucket,{maxCleanup:0});
 assert.equal(done.activeCount,3);
 assert.equal(done.readyCount,2);
 assert.equal(done.truncated,false);
 assert.equal([...map.keys()].filter(x=>x.startsWith(ROOT+'review/')).length,14);
 assert.equal(map.has(READY+'sa-verified-article-2026.json'),false);
});
test('unreadable and unclassified inventory remains fail-closed rather than silently deleted',async()=>{
 const key='_ops/noondealsnow-direct-ai-v1/ready/broken-payload.json';
 const bucket={async list(){return {objects:[{key}],truncated:false}},
  async get(){return {json:async()=>{throw Error('BROKEN')}}},
  async delete(){throw Error('MUST_NOT_DELETE')}};
 const result=await inspectNativeReadyStock(bucket);
 assert.equal(result.readyCount,0);
 assert.equal(result.unknownCount,1);
 assert.equal(result.activeCount,1);
 assert.equal(result.quarantined,0);
 await assert.rejects(()=>inspectNativeReadyStock(bucket,{maxCleanup:100}),/INVALID_READY_INVENTORY_ARGUMENT/);
});
