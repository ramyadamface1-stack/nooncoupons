import test from 'node:test';
import assert from 'node:assert/strict';
import {DIRECT_READY_TARGET,planGenerationMarkets,planQuotaCooldown} from '../cloudflare-ai-direct/production-guard.mjs';
import {readFileSync} from 'node:fs';
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
 assert.match(source,/planGenerationMarkets\(readyStock\.objects\.length,minute\)/);
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
