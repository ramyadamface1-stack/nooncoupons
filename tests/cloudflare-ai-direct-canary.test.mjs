import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importDirectKeys,listDirectKeys} from '../cloudflare-ai-direct/keys.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function bucket(){
 const values=new Map();return {values,
  async put(key,value){values.set(key,value);return {etag:'ok'}},
  async get(key){const value=values.get(key);return value===undefined?null:{json:async()=>JSON.parse(value)}},
  async list({prefix}){return{objects:[...values.keys()].filter(x=>x.startsWith(prefix)).map(key=>({key}))}}
 };
}
test('the direct Worker has no GitHub runtime and canary publishes nothing',()=>{
 for(const path of ['cloudflare-ai-direct/engine.mjs','cloudflare-ai-direct/keys.mjs',
  'cloudflare-ai-direct/rpc-entry.mjs'])
  assert.doesNotMatch(read(path),/api\.github\.com|actions\/workflows|GITHUB_DISPATCH_TOKEN|repository_dispatch/);
 const cfg=JSON.parse(read('cloudflare-ai-direct/wrangler.jsonc'));
 assert.equal(cfg.r2_buckets[0].bucket_name,'nooncoupons-content-v2');
 assert.equal(cfg.vars.DIRECT_AI_STAGE,'canary-generation');
 assert.deepEqual(cfg.triggers.crons,['* * * * *']);
 const engine=read('cloudflare-ai-direct/engine.mjs');
 assert.match(engine,/async function canaryGenerateOnce\(env,scheduledAt\)/);
 assert.match(engine,/canary-once-v2\//);
 assert.match(engine,/maxProviderAttempts:1/);
 assert.match(engine,/canaryWave:2/);
 assert.match(engine,/canaryGenerateOnce\(env,scheduledAt\)/);
 assert.match(engine,/const reservation=await jsonPut\(env,attemptKey,\{state:'STARTED'/);
 assert.match(engine,/if\(prior\)return \{ok:prior.state==='READY_CREATED'/);
 assert.doesNotMatch(engine.split('async function canaryGenerateOnce')[1].split('export async function directTick')[0],/publishOne\(/);
});
test('panel import encrypts bulk keys and returns metadata only',async()=>{
 const b=bucket(),master=crypto.getRandomValues(new Uint8Array(32));
 const env={CONTENT_FINAL:b,NDN_KEYS_MASTER:btoa(String.fromCharCode(...master)),
  GEMINI_KEYS_JSON:'[]',GROQ_KEYS_JSON:'[]'};
 const gemini='AQ.'+'a'.repeat(38),groq='gsk_'+'b'.repeat(37);
 assert.equal((await importDirectKeys(env,{provider:'gemini',keys:gemini})).addedCount,1);
 assert.equal((await importDirectKeys(env,{provider:'groq',keys:groq})).addedCount,1);
 for(const saved of b.values.values()){assert.ok(!saved.includes(gemini));assert.ok(!saved.includes(groq))}
 const masked=await listDirectKeys(env);
 assert.equal(masked.groups.gemini[1].keyCount,1);
 assert.equal(masked.groups.groq[1].keyCount,1);
 assert.doesNotMatch(JSON.stringify(masked),/AQ\.aaaa|gsk_bbbb/);
 const full=await listDirectKeys(env,{includePlain:true});
 assert.deepEqual(full.gemini,[gemini]);assert.deepEqual(full.groq,[groq]);
});
test('invalid input or absent AES key cannot write plaintext into R2',async()=>{
 const b=bucket(),env={CONTENT_FINAL:b};
 await assert.rejects(importDirectKeys(env,{provider:'gemini',keys:'bad'}),/INVALID_KEY_FORMAT/);
 await assert.rejects(importDirectKeys(env,{provider:'groq',keys:'gsk_'+'b'.repeat(34)}),/DIRECT_KEY_ENCRYPTION_NOT_CONFIGURED/);
 assert.equal(b.values.size,0);
});
test('the live scheduler remains untouched until canary proof',()=>{
 assert.match(read('ai-scheduler-v2/rpc-entry.mjs'),/import scheduler,\{adminManualDispatch\}/);
 assert.deepEqual(JSON.parse(read('ai-scheduler-v2/wrangler.jsonc')).triggers.crons,['* * * * *']);
 const release=read('.github/workflows/deploy-noondealsnow-cloudflare-direct-r2.yml');
 assert.match(release,/secrets\.NOON_NEW_CF_API_TOKEN/);
 assert.match(release,/wrangler deploy --config cloudflare-ai-direct\/wrangler\.jsonc/);
 // One-time deploy-time handoff may read existing GitHub Secrets, but
 // the direct Cloudflare engine itself must never call GitHub or spawn Actions.
 assert.match(release,/node cloudflare-ai-direct\/pack-existing-keys\.mjs gemini/);
 assert.match(release,/node cloudflare-ai-direct\/pack-existing-keys\.mjs groq/);
 assert.match(release,/wrangler secret put GEMINI_KEYS_JSON/);
 assert.match(release,/wrangler secret put GROQ_KEYS_JSON/);
 assert.match(release,/wrangler secret put SITE_PUBLISH_TOKEN/);
 assert.match(release,/DIRECT_PUBLISHING=STILL_DISABLED_UNTIL_SAFE_CUTOVER/);
 assert.match(release,/DIRECT_CLOUDFLARE_CRON=ONE_MINUTE_GENERATION_ONLY/);
 assert.doesNotMatch(release,/wrangler deploy --config ai-scheduler-v2\/wrangler\.jsonc/);
});

test('direct canary uses unused N11 topics, and missing keys cannot burn an article checkpoint',()=>{
 const source=read('cloudflare-ai-direct/engine.mjs');
 assert.match(source,/topicByMarket=.*eleventhEditorialTopicWave/s);
 assert.match(source,/if\(!pool\.length\)return logState\(env,\{phase:'KEYS_MISSING',market\}\)/);
 assert.doesNotMatch(source,/state:'NO_KEYS'/);
 assert.match(source,/env\.DIRECT_AI_STAGE!=='production'/);
 assert.match(source,/reason:'DIRECT_ENGINE_CANARY_NOT_ACTIVE'/);
 assert.doesNotMatch(source,/api\.github\.com|actions\/workflows|GITHUB_DISPATCH_TOKEN/);
});

test('canary manual request explicitly declines before any provider or R2 access',async()=>{
 const {requestDirectGeneration}=await import('../cloudflare-ai-direct/engine.mjs');
 let touched=0;
 const result=await requestDirectGeneration({
  DIRECT_AI_STAGE:'canary-generation',
  CONTENT_FINAL:{get(){touched++},put(){touched++},list(){touched++}}
 });
 assert.deepEqual(result,{dispatched:false,reason:'DIRECT_ENGINE_CANARY_NOT_ACTIVE',githubUsed:false});
 assert.equal(touched,0,'canary must not access keys, request a provider or reserve a topic');
});
test('private direct RPC checks actual decrypted keys and publish token without displaying values in public health',()=>{
 const engine=read('cloudflare-ai-direct/engine.mjs');
 const rpc=read('cloudflare-ai-direct/rpc-entry.mjs');
 assert.match(engine,/export async function directAdminStatus/);
 assert.match(engine,/listDirectKeys\(env,\{includePlain:true\}\)/);
 assert.match(engine,/activationBlockers/);
 assert.match(engine,/DIRECT_PROVIDER_KEYS_MISSING/);
 assert.match(engine,/NATIVE_PUBLISH_TOKEN_MISSING/);
 assert.match(rpc,/async status\(\)\{return directAdminStatus\(this.env\)\}/);
 assert.doesNotMatch(engine.split('export async function directStatus')[1].split('export async function directAdminStatus')[0],/geminiCount|groqCount|publishTokenConfigured/);
});

test('direct provider outcome guard never retries ambiguous 5xx or transport errors',async()=>{
 const {providerOutcomeAction}=await import('../cloudflare-ai-direct/provider-response.mjs');
 assert.equal(providerOutcomeAction({ok:true,http:200}),'ACCEPT');
 assert.equal(providerOutcomeAction({ok:false,http:429}),'NEXT_FREE_KEY');
 for(const status of [500,502,503,504,520,524])
  assert.equal(providerOutcomeAction({ok:false,http:status}),'QUARANTINE_UNKNOWN');
 for(const status of [400,401,403,404,null])
  assert.equal(providerOutcomeAction({ok:false,http:status}),'STOP');
 const code=read('cloudflare-ai-direct/engine.mjs');
 assert.match(code,/providerOutcomeAction\(result\)/);
 assert.match(code,/state:'UNKNOWN_REQUEST_OUTCOME'/);
 assert.match(code,/phase:'PROVIDER_HTTP_OUTCOME_UNKNOWN'/);
 assert.doesNotMatch(code,/\[429,500,502,503,504\]\.includes\(result\.http\)/);
});
test('direct status tracks SA and AE separately, and never reports a truncated READY list as exact',()=>{
 const engine=read('cloudflare-ai-direct/engine.mjs');
 assert.match(engine,/status-sa\.json/);
 assert.match(engine,/status-ae\.json/);
 assert.match(engine,/marketGeneration:\{SA:saStatus\|\|null,AE:aeStatus\|\|null\}/);
 assert.match(engine,/readyCountExact:ready\.truncated!==true/);
});

test('expired R2 lease can be taken by a new owner without stale owner releasing it',async()=>{
 const {withDirectLease}=await import('../cloudflare-ai-direct/lease.mjs');
 const objects=new Map();let serial=0;
 const bucket={
  async get(key){
   const current=objects.get(key);
   return current?{etag:current.etag,json:async()=>JSON.parse(current.body)}:null;
  },
  async put(key,body,options={}){
   const prior=objects.get(key),cond=options.onlyIf||{};
   if(cond.etagDoesNotMatch==='*'&&prior)return null;
   if(cond.etagMatches&&prior?.etag!==cond.etagMatches)return null;
   const etag='etag-'+(++serial);
   objects.set(key,{etag,body});return {etag};
  },
  async delete(){throw Error('DANGEROUS_DELETE_SHOULD_NEVER_RUN')}
 };
 const env={CONTENT_FINAL:bucket};
 let enterA,releaseA,enterB,releaseB;
 const startedA=new Promise(resolve=>enterA=resolve);
 const heldA=new Promise(resolve=>releaseA=resolve);
 const startedB=new Promise(resolve=>enterB=resolve);
 const heldB=new Promise(resolve=>releaseB=resolve);
 const a=withDirectLease(env,'publisher',async()=>{enterA();await heldA;return 'a'},
  {clock:()=>1000,ttlMs:50});
 await startedA;
 const b=withDirectLease(env,'publisher',async()=>{enterB();await heldB;return 'b'},
  {clock:()=>2000,ttlMs:500});
 await startedB;
 releaseA();assert.equal(await a,'a');
 const active=await bucket.get('_ops/noondealsnow-direct-ai-v1/lease/publisher.json');
 assert.equal((await active.json()).until,2500,'A must not release owner B');
 assert.deepEqual(await withDirectLease(env,'publisher',async()=>{throw Error('should not enter')},
   {clock:()=>2100,ttlMs:50}),{ok:false,reason:'LEASE_ACTIVE'});
 releaseB();assert.equal(await b,'b');
 const released=await bucket.get('_ops/noondealsnow-direct-ai-v1/lease/publisher.json');
 assert.equal((await released.json()).until,0);
 assert.equal(await withDirectLease(env,'publisher',async()=>42,{clock:()=>2100,ttlMs:50}),42);
});
test('corrupted direct lease fails closed without write or dangerous delete',async()=>{
 const {withDirectLease}=await import('../cloudflare-ai-direct/lease.mjs');
 let puts=0;
 const b={get:async()=>({etag:'etag1',json:async()=>({until:NaN})}),
  put:async()=>{puts++;return null},delete:async()=>{throw Error('DELETE_NEVER_ALLOWED')}};
 assert.deepEqual(await withDirectLease({CONTENT_FINAL:b},'generate-SA',async()=>false),
  {ok:false,reason:'LEASE_STATE_INVALID'});
 assert.equal(puts,0);
 const source=read('cloudflare-ai-direct/lease.mjs');
 assert.match(source,/onlyIf:\{etagMatches:latest\.etag\}/);
 assert.doesNotMatch(source,/\.delete\(/);
});

test('canary health reads each attempt marker without exposing keys or performing generation',async()=>{
 const {directStatus}=await import('../cloudflare-ai-direct/engine.mjs');
 const originalFetch=globalThis.fetch;
 let providerCalls=0;
 globalThis.fetch=async url=>{
  if(String(url)!=='https://noondealsnow.com/api/ai-v2-control-policy'){providerCalls++;throw Error('UNEXPECTED_PROVIDER_CALL')}
  return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 const records={
  '_ops/noondealsnow-direct-ai-v1/canary-once-v2/SA.json':{state:'READY_CREATED',reason:'READY_CREATED',at:'2026-11-11T20:10:00.000Z',credential:'SECRET_MUST_NOT_LEAK'},
  '_ops/noondealsnow-direct-ai-v1/canary-once-v2/AE.json':{state:'STARTED',at:'2026-11-11T20:11:00.000Z'}
 };
 const env={DIRECT_AI_STAGE:'canary-generation',CONTENT_FINAL:{
  list:async()=>({objects:[],truncated:false}),
  get:async key=>records[key]?{json:async()=>records[key]}:null
 }};
 try{
  const status=await directStatus(env);
  assert.equal(status.schedulerEnabled,false);
  assert.equal(status.canaryGenerationEnabled,true);
  assert.equal(status.canaryWave,2);
  assert.equal(status.readyCount,0);
  assert.deepEqual(status.canaryAttempts.SA,{state:'READY_CREATED',phase:'READY_CREATED',at:'2026-11-11T20:10:00.000Z'});
  assert.deepEqual(status.canaryAttempts.AE,{state:'STARTED',phase:null,at:'2026-11-11T20:11:00.000Z'});
  assert.equal(providerCalls,0);
  assert.doesNotMatch(JSON.stringify(status),/SECRET_MUST_NOT_LEAK/);
 }finally{globalThis.fetch=originalFetch}
});

test('direct provider key selection uses disjoint initial SA/AE windows and advances before POST',async()=>{
 const {planDirectKeyRotation}=await import('../cloudflare-ai-direct/key-rotation.mjs');
 const sa=planDirectKeyRotation(44,null,'SA'),ae=planDirectKeyRotation(44,null,'AE');
 assert.deepEqual(sa,{indices:[0,1,2],next:3,market:'SA'});
 assert.deepEqual(ae,{indices:[22,23,24],next:25,market:'AE'});
 assert.equal(sa.indices.some(index=>ae.indices.includes(index)),false);
 assert.deepEqual(planDirectKeyRotation(44,{next:sa.next},'SA').indices,[3,4,5]);
 assert.deepEqual(planDirectKeyRotation(4,{next:3},'SA').indices,[3,0,1]);
 assert.deepEqual(planDirectKeyRotation(1,null,'AE').indices,[0]);
 assert.throws(()=>planDirectKeyRotation(0,null,'SA'),/INVALID_KEY_ROTATION_ARGUMENT/);
 const source=read('cloudflare-ai-direct/engine.mjs');
 assert.match(source,/planDirectKeyRotation\(pool\.length,previousKeys,market\)/);
 assert.match(source,/const advanced=await jsonPut\(env,keyCursor/);
 assert.match(source,/for\(let attempt=0;attempt<rotation\.indices\.length;attempt\+\+\)/);
 assert.doesNotMatch(source,/pool\[\(start\+attempt\)%pool\.length\]/);
});
