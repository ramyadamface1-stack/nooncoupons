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
test('the direct Worker has no GitHub runtime and publishing pilot is limited',()=>{
 for(const path of ['cloudflare-ai-direct/engine.mjs','cloudflare-ai-direct/keys.mjs',
  'cloudflare-ai-direct/rpc-entry.mjs'])
  assert.doesNotMatch(read(path),/api\.github\.com|actions\/workflows|GITHUB_DISPATCH_TOKEN|repository_dispatch/);
 const cfg=JSON.parse(read('cloudflare-ai-direct/wrangler.jsonc'));
 assert.equal(cfg.r2_buckets[0].bucket_name,'nooncoupons-content-v2');
 assert.equal(cfg.vars.DIRECT_AI_STAGE,'production');
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
 assert.match(release,/DIRECT_PRODUCTION=ACTIVE;READY_BUFFER_TARGET=12/);
 assert.match(release,/DIRECT_CLOUDFLARE_CRON=ONE_MINUTE_PRODUCTION/);
 assert.doesNotMatch(release,/wrangler deploy --config ai-scheduler-v2\/wrangler\.jsonc/);
});

test('direct canary uses unused N11 topics, and missing keys cannot burn an article checkpoint',()=>{
 const source=read('cloudflare-ai-direct/engine.mjs');
 assert.match(source,/topicByMarket=.*eleventhEditorialTopicWave/s);
 assert.match(source,/if\(!keys\.gemini\.length\&\&!keys\.groq\.length\)return logState\(env,\{phase:'KEYS_MISSING',market\}\)/);
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
 for(const status of [401,403])
  assert.equal(providerOutcomeAction({ok:false,http:status}),'NEXT_VALID_KEY');
 for(const status of [400,404,null])
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

test('versioned lazy topic reserve expands each market without prebuilding thousands of articles',async()=>{
 const {eleventhEditorialTopicWave}=await import('../automation/ai-v2/topic-refresh-n11.mjs');
 const {directTopicAt,directTopicSpaceLength,DIRECT_TOPIC_SPACE_VERSION,DIRECT_TOPIC_SCOPES}=
  await import('../cloudflare-ai-direct/topic-space.mjs');
 assert.equal(DIRECT_TOPIC_SPACE_VERSION,'n11-scoped-v1');
 assert.equal(DIRECT_TOPIC_SCOPES.length,6);
 for(const market of ['SA','AE']){
  const list=eleventhEditorialTopicWave.filter(t=>t.country===market);
  assert.ok(list.length>100);
  assert.equal(directTopicSpaceLength(list),list.length*7);
  const base=directTopicAt(list,0);
  assert.strictEqual(base,list[0],'original N11 topic is immutable');
  const expanded=Array.from({length:Math.min(list.length,100)},(_,i)=>
   directTopicAt(list,list.length+i)).filter(Boolean);
  assert.ok(expanded.length>5,'fresh unique intent topics are immediately accessible');
  const unique=new Set(expanded.map(t=>t.slug));
  assert.equal(unique.size,expanded.length);
  for(const item of expanded){
   assert.equal(item.country,market);
   assert.equal(item.coupon,market==='AE'?'NOV188':'NOV170');
   assert.match(item.slug,/-n11$/);
   assert.ok(item.slug.length<=120);
   assert.ok(item.topic.length<=72);
   assert.equal(item.sections.length,5);
  }
 }
 assert.throws(()=>directTopicSpaceLength(null),/INVALID_DIRECT_TOPICS/);
 assert.throws(()=>directTopicAt([],0),/INVALID_DIRECT_TOPIC_INDEX/);
 const engine=read('cloudflare-ai-direct/engine.mjs');
 assert.match(engine,/directTopicSpaceLength\(topics\)/);
 assert.match(engine,/directTopicAt\(topics,index\)/);
 assert.match(engine,/previous\?\.space===DIRECT_TOPIC_SPACE_VERSION/);
 assert.match(engine,/canary-groq-once-v3/);
});

test('fresh Gemini one-shot canary prevents second provider spend with missing keys',async()=>{
 const {directTick}=await import('../cloudflare-ai-direct/engine.mjs');
 let writes=0;const previous=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.equal(String(url),'https://noondealsnow.com/api/ai-v2-control-policy');
  return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 const env={DIRECT_AI_STAGE:'canary-gemini-generation',GEMINI_KEYS_JSON:'[]',GROQ_KEYS_JSON:'[]',
  CONTENT_FINAL:{list:async()=>({objects:[]}),put:async()=>{writes++;return {etag:'one'}}}};
 try{
  assert.deepEqual(await directTick(env),{ok:false,phase:'GEMINI_CANARY_KEYS_MISSING'});
  assert.equal(writes,0);
 }finally{globalThis.fetch=previous}
});

test('Groq and Gemini are interleaved; SA and AE start with distinct providers',async()=>{
 const {planDirectProviderWindow}=await import('../cloudflare-ai-direct/provider-window.mjs');
 const counts={gemini:4,groq:2};
 const sa=planDirectProviderWindow(counts,{market:'SA'});
 const ae=planDirectProviderWindow(counts,{market:'AE'});
 assert.deepEqual(sa.attempts,[
  {provider:'gemini',keyIndex:0},{provider:'groq',keyIndex:0},{provider:'gemini',keyIndex:1}]);
 assert.deepEqual(sa.next,{geminiNext:2,groqNext:1});
 assert.deepEqual(ae.attempts,[
  {provider:'groq',keyIndex:1},{provider:'gemini',keyIndex:2},{provider:'groq',keyIndex:0}]);
 assert.deepEqual(ae.next,{geminiNext:3,groqNext:1});
 assert.deepEqual(planDirectProviderWindow(counts,{market:'SA',previous:sa.next}).attempts,[
  {provider:'gemini',keyIndex:2},{provider:'groq',keyIndex:1},{provider:'gemini',keyIndex:3}]);
 assert.deepEqual(planDirectProviderWindow({gemini:0,groq:2},{market:'SA'}).attempts,[
  {provider:'groq',keyIndex:0},{provider:'groq',keyIndex:1}]);
 assert.deepEqual(planDirectProviderWindow(counts,{market:'AE',preferredProvider:'groq',
  allowFallback:false,maxAttempts:1}).attempts,[{provider:'groq',keyIndex:1}]);
 assert.deepEqual(planDirectProviderWindow({gemini:4,groq:0},{market:'AE',
  preferredProvider:'groq',allowFallback:false}).attempts,[]);
 assert.throws(()=>planDirectProviderWindow({gemini:-1,groq:0},{market:'AE'}),/INVALID_DIRECT_PROVIDER_WINDOW/);
 assert.throws(()=>planDirectProviderWindow(counts,{market:'XX'}),/INVALID_DIRECT_PROVIDER_WINDOW/);
 const engine=read('cloudflare-ai-direct/engine.mjs');
 assert.match(engine,/planDirectProviderWindow\(\{gemini:keys\.gemini\.length,groq:keys\.groq\.length\}/);
 assert.match(engine,/const advanced=await jsonPut\(env,keyCursor/);
 assert.match(engine,/Promise\.allSettled\(markets\.map/);
 assert.match(engine,/const publications=runNativePublicationWindow\(env,p,\{scheduledAt\}\)/);
  assert.doesNotMatch(engine,/const secondPublication=/);
 assert.doesNotMatch(engine,/pool\[\(start\+attempt\)%pool\.length\]/);
});

test('Groq canary fails closed without a Groq key and does not contact any provider',async()=>{
 const {directTick}=await import('../cloudflare-ai-direct/engine.mjs');
 const original=globalThis.fetch;
 let providerCalls=0,writes=0;
 globalThis.fetch=async url=>{
  if(String(url)!=='https://noondealsnow.com/api/ai-v2-control-policy'){
   providerCalls++;throw Error('NO_PROVIDER_PERMITTED');
  }
  return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,
   publishingIntervalMinutes:1}),{status:200});
 };
 const env={DIRECT_AI_STAGE:'canary-groq-generation',GEMINI_KEYS_JSON:'[]',GROQ_KEYS_JSON:'[]',
  CONTENT_FINAL:{list:async()=>({objects:[]}),put:async()=>{writes++;return {etag:'one'}}}};
 try{
  assert.deepEqual(await directTick(env),{ok:false,phase:'GROQ_CANARY_KEYS_MISSING'});
  assert.equal(providerCalls,0);
  assert.equal(writes,0);
 }finally{globalThis.fetch=original}
});

test('one Groq 429 is recorded once; repeat Cron never spends another key',async()=>{
 const {directTick,directStatus}=await import('../cloudflare-ai-direct/engine.mjs');
 const original=globalThis.fetch,objects=new Map();let serial=0,providerCalls=0;
 const bucket={
  async get(key){const x=objects.get(key);return x?{etag:x.etag,json:async()=>JSON.parse(x.body)}:null},
  async head(){return null},
  async list({prefix}){return {objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false}},
  async put(key,body,{onlyIf}={}){
   const old=objects.get(key);
   if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;
   if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;
   const item={body,etag:'tag-'+(++serial)};
   objects.set(key,item);return {etag:item.etag};
  }
 };
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://noondealsnow.com/api/ai-v2-control-policy')
   return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,
    publishingIntervalMinutes:1}),{status:200});
  assert.match(String(url),/^https:\/\/api\.groq\.com\//);
  assert.ok(String(options?.headers?.authorization||'').startsWith('Bearer gsk_'));
  providerCalls++;
  return new Response(JSON.stringify({error:{message:'quota'}}),{status:429});
 };
 const env={DIRECT_AI_STAGE:'canary-groq-generation',CONTENT_FINAL:bucket,
  GROQ_KEYS_JSON:JSON.stringify(['gsk_'+'b'.repeat(35)]),GEMINI_KEYS_JSON:'[]'};
 try{
  const one=await directTick(env);
  assert.equal(one.phase,'GROQ_CANARY_BLOCKED');
  assert.equal(one.provider,'groq');
  assert.equal(providerCalls,1);
  const two=await directTick(env);
  assert.equal(two.phase,'GROQ_CANARY_ALREADY_RECORDED');
  assert.equal(providerCalls,1);
  const status=await directStatus(env);
  assert.equal(status.groqCanaryEnabled,true);
  assert.equal(status.groqCanary.state,'BLOCKED');
  assert.equal(status.groqCanary.provider,'groq');
  assert.doesNotMatch(JSON.stringify(status),/gsk_bbbbb/);
 }finally{globalThis.fetch=original}
});

test('three distinct Groq 401 responses quarantine each invalid key, no repeat spending',async()=>{
 const {directTick,directStatus}=await import('../cloudflare-ai-direct/engine.mjs');
 const original=globalThis.fetch,objects=new Map();let seq=0,requests=0;
 const bucket={
  async get(key){const obj=objects.get(key);return obj?{etag:obj.etag,json:async()=>JSON.parse(obj.body)}:null},
  async head(key){return objects.has(key)?{etag:objects.get(key).etag}:null},
  async list({prefix}){return {objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false}},
  async put(key,body,{onlyIf}={}){
   const old=objects.get(key);
   if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;
   if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;
   const item={body,etag:'etag-'+(++seq)};objects.set(key,item);return {etag:item.etag};
  }
 };
 globalThis.fetch=async(url,opts)=>{
  if(String(url)==='https://noondealsnow.com/api/ai-v2-control-policy')
   return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
  assert.match(String(url),/^https:\/\/api\.groq\.com\//);
  requests++;
  return new Response(JSON.stringify({error:'invalid authentication'}),{status:401});
 };
 const env={DIRECT_AI_STAGE:'canary-groq-generation',CONTENT_FINAL:bucket,GEMINI_KEYS_JSON:'[]',
  GROQ_KEYS_JSON:JSON.stringify(Array.from({length:3},(_,i)=>'gsk_'+String(i).repeat(35)))};
 try{
  const one=await directTick(env);
  assert.equal(one.phase,'GROQ_CANARY_BLOCKED');
  assert.equal(one.reason,'PROVIDER_REJECTED');
  assert.equal(requests,3);
  const blocked=[...objects.keys()].filter(k=>k.includes('/provider-rejected/groq/'));
  assert.equal(blocked.length,3,'rejected key refs persisted without raw credentials');
  assert.equal((await directTick(env)).phase,'GROQ_CANARY_ALREADY_RECORDED');
  assert.equal(requests,3);
  const status=await directStatus(env);
  assert.equal(status.groqCanary.state,'BLOCKED');
  assert.doesNotMatch(JSON.stringify(status),/gsk_[012]{12}/);
 }finally{globalThis.fetch=original}
});

test('one-article native publication pilot only retries a confirmed no-write and then stops permanently',async()=>{
 const {canaryPublishOnce,directStatus}=await import('../cloudflare-ai-direct/engine.mjs');
 const slug='uae-buyer-samsung-tablet-pdf-handwriting-export-file-formats-nov188-2026-n11';
 const ready='_ops/noondealsnow-direct-ai-v1/ready/example.json';
 const objects=new Map();let seq=0;
 const insert=(key,value)=>{
  const etag='etag-'+(++seq);objects.set(key,{etag,body:JSON.stringify(value)});return {etag};
 };
 insert(ready,{state:'READY',topic:{country:'AE',coupon:'NOV188',slug},article:{html:'<article>safe mock</article>'}});
 const bucket={
  async get(key){const item=objects.get(key);return item?{etag:item.etag,json:async()=>JSON.parse(item.body)}:null},
  async list({prefix}){return {objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false}},
  async put(key,body,{onlyIf}={}){const old=objects.get(key);
   if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;
   if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;
   return insert(key,JSON.parse(body));
  }
 };
 const oldFetch=globalThis.fetch;
 let network=0,requests=0,ms=Date.parse('2026-11-12T08:00:00Z');
 globalThis.fetch=async url=>{
  if(String(url)!=='https://noondealsnow.com/api/ai-v2-control-policy')throw Error('FORBIDDEN_NETWORK');
  network++;return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 const env={DIRECT_AI_STAGE:'canary-publish',SITE_PUBLISH_TOKEN:'SECRET_NOT_TO_EXPOSE',CONTENT_FINAL:bucket};
 const publish=async()=>{requests++;return requests<=2?
  {ok:false,reason:'PUBLICATION_SLOT_NOT_DUE'}:
  {ok:true,reason:'LIVE_VERIFIED',slug};
 };
 try{
  let result=await canaryPublishOnce(env,{publish,clock:()=>ms});
  assert.deepEqual({state:result.state,attempts:result.attempts},{state:'WAIT_SLOT',attempts:1});
  ms+=60000;result=await canaryPublishOnce(env,{publish,clock:()=>ms});
  assert.equal(result.state,'WAIT_SLOT');assert.equal(result.attempts,2);
  ms+=60000;result=await canaryPublishOnce(env,{publish,clock:()=>ms});
  assert.equal(result.state,'VERIFIED');assert.equal(result.ok,true);assert.equal(result.attempts,3);
  ms+=60000;result=await canaryPublishOnce(env,{publish,clock:()=>ms});
  assert.equal(result.reason,'CANARY_PUBLISH_ALREADY_RECORDED');
  assert.equal(requests,3);
  const status=await directStatus(env);
  assert.equal(status.canaryPublishingEnabled,true);
  assert.equal(status.schedulerEnabled,false);
  assert.deepEqual({state:status.canaryPublication.state,attempts:status.canaryPublication.attempts},
   {state:'VERIFIED',attempts:3});
  assert.doesNotMatch(JSON.stringify(status),/SECRET_NOT_TO_EXPOSE/);
  assert.equal(network,5);
 }finally{globalThis.fetch=oldFetch}
});

test('Cloudflare pilot pins one eligible READY slug across multiple stocked articles',async()=>{
 const {canaryPublishOnce}=await import('../cloudflare-ai-direct/engine.mjs');
 const one='uae-buyer-samsung-tablet-pdf-handwriting-export-file-formats-nov188-2026-n11';
 const two='uae-buyer-dell-laptop-bios-battery-charging-limit-options-nov188-2026-n11';
 const records=new Map(),seq={i:0},prefix='_ops/noondealsnow-direct-ai-v1/ready/';
 const save=(key,value)=>{
  const etag='t-'+(++seq.i);records.set(key,{etag,body:JSON.stringify(value)});return {etag};
 };
 save(prefix+'first.json',{state:'READY',topic:{slug:one,country:'AE',coupon:'NOV188'}});
 save(prefix+'second.json',{state:'READY',topic:{slug:two,country:'AE',coupon:'NOV188'}});
 const bucket={
  async get(key){const v=records.get(key);return v?{etag:v.etag,json:async()=>JSON.parse(v.body)}:null},
  async list({prefix}){return {objects:[...records.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false}},
  async put(key,body,{onlyIf}={}){
   const old=records.get(key);
   if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;
   if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;
   return save(key,JSON.parse(body));
  }
 };
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.equal(String(url),'https://noondealsnow.com/api/ai-v2-control-policy');
  return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 const env={DIRECT_AI_STAGE:'canary-publish',SITE_PUBLISH_TOKEN:'SECRET_TEST',CONTENT_FINAL:bucket};
 let now=Date.parse('2026-11-12T09:00:00Z');const called=[];
 const publish=async(_env,_p,{onlySlug})=>{
  called.push(onlySlug);return called.length===1?
   {ok:false,reason:'PUBLICATION_SLOT_NOT_DUE'}:
   {ok:true,reason:'LIVE_VERIFIED',slug:onlySlug};
 };
 try{
  const first=await canaryPublishOnce(env,{publish,clock:()=>now});
  assert.equal(first.state,'WAIT_SLOT');
  assert.equal(first.slug,one);
  now+=60000;
  const second=await canaryPublishOnce(env,{publish,clock:()=>now});
  assert.equal(second.state,'VERIFIED');
  assert.equal(second.slug,one);
  assert.deepEqual(called,[one,one]);
  assert.ok(records.has(prefix+'second.json'),'other stocked article was not touched');
  assert.ok(records.has('_ops/noondealsnow-direct-ai-v1/canary-publish-once-v2.json'));
 }finally{globalThis.fetch=original}
});

test('publishing pilot permanently quarantines an ambiguous native response',async()=>{
 const {canaryPublishOnce}=await import('../cloudflare-ai-direct/engine.mjs');
 const slug='uae-buyer-samsung-tablet-pdf-handwriting-export-file-formats-nov188-2026-n11';
 const objects=new Map();let i=0;
 objects.set('_ops/noondealsnow-direct-ai-v1/ready/pilot.json',{etag:'r1',body:JSON.stringify({
  state:'READY',topic:{country:'AE',coupon:'NOV188',slug}})});
 const bucket={
  async get(key){const entry=objects.get(key);return entry?{etag:entry.etag,json:async()=>JSON.parse(entry.body)}:null},
  async list({prefix}){return {objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false}},
  async put(key,body,{onlyIf}={}){const old=objects.get(key);
   if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;
   if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;
   const entry={etag:'new'+(++i),body};objects.set(key,entry);return entry;
  }
 };
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 let attempts=0;
 const env={CONTENT_FINAL:bucket,SITE_PUBLISH_TOKEN:'not-visible',DIRECT_AI_STAGE:'canary-publish'};
 try{
  const one=await canaryPublishOnce(env,{publish:async()=>{
   attempts++;return {ok:false,reason:'PUBLISH_TRANSPORT_UNKNOWN'}},clock:()=>Date.parse('2026-11-12T08:00:00Z')});
  assert.equal(one.state,'BLOCKED_UNKNOWN');
  const two=await canaryPublishOnce(env,{publish:async()=>{
   attempts++;throw Error('SHOULD_NOT_RETRY')},clock:()=>Date.parse('2026-11-12T08:03:00Z')});
  assert.equal(two.reason,'CANARY_PUBLISH_ALREADY_RECORDED');
  assert.equal(attempts,1);
 }finally{globalThis.fetch=previous}
});

test('fresh native pilot never publishes without a new Gemini READY marker',async()=>{
 const {canaryPublishOnce}=await import('../cloudflare-ai-direct/engine.mjs');
 const originalFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async url=>{
  assert.equal(String(url),'https://noondealsnow.com/api/ai-v2-control-policy');
  return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 const env={DIRECT_AI_STAGE:'canary-publish-fresh',SITE_PUBLISH_TOKEN:'SECRET',CONTENT_FINAL:{
  async get(){return null},async list(){throw Error('SHOULD_NOT_LIST_READY')},
  async put(){throw Error('SHOULD_NOT_PUBLISH')}
 }};
 try{
  const result=await canaryPublishOnce(env,{publish:async()=>{calls++;throw Error('UNSAFE_PUBLISH')}});
  assert.deepEqual(result,{ok:false,reason:'FRESH_GEMINI_NOT_READY'});
  assert.equal(calls,0);
 }finally{globalThis.fetch=originalFetch}
});

test('fresh native pilot pins the exact newly generated slug and does not claim an existing URL as new publication',async()=>{
 const {canaryPublishOnce,directStatus}=await import('../cloudflare-ai-direct/engine.mjs');
 const prefix='_ops/noondealsnow-direct-ai-v1/',slug='uae-buyer-fresh-router-research-nov188-2026-n11';
 const records=new Map();let serial=0;const save=(key,value)=>{
  const item={etag:'e'+(++serial),value};records.set(key,item);return {etag:item.etag};
 };
 save(prefix+'canary-gemini-fresh-v1.json',{state:'READY_CREATED',slug,provider:'gemini'});
 save(prefix+'ready/old.json',{state:'READY',topic:{slug:'uae-buyer-old-topic-nov188-2026-n11',country:'AE',coupon:'NOV188'}});
 save(prefix+'ready/new.json',{state:'READY',topic:{slug,country:'AE',coupon:'NOV188'}});
 const b={
  async get(key){const o=records.get(key);return o?{etag:o.etag,json:async()=>o.value}:null},
  async put(key,body,{onlyIf}={}){const o=records.get(key);
   if(onlyIf?.etagMatches&&o?.etag!==onlyIf.etagMatches)return null;
   if(onlyIf?.etagDoesNotMatch==='*'&&o)return null;
   return save(key,JSON.parse(body));
  },
  async list({prefix:p}){return {objects:[...records.keys()].filter(k=>k.startsWith(p)).map(key=>({key})),truncated:false}}
 };
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.equal(String(url),'https://noondealsnow.com/api/ai-v2-control-policy');
  return new Response(JSON.stringify({ok:true,enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 const env={DIRECT_AI_STAGE:'canary-publish-fresh',SITE_PUBLISH_TOKEN:'PRIVATE_DO_NOT_ECHO',CONTENT_FINAL:b};
 const called=[];
 try{
  const first=await canaryPublishOnce(env,{publish:async(_env,_p,{onlySlug})=>{
   called.push(onlySlug);return {ok:true,reason:'ALREADY_LIVE_VERIFIED',slug:onlySlug};
  },clock:()=>Date.parse('2026-11-12T22:30:00Z')});
  assert.equal(first.ok,false);
  assert.equal(first.state,'EXTERNAL_LIVE');
  assert.deepEqual(called,[slug]);
  const next=await canaryPublishOnce(env,{publish:async()=>{throw Error('NO_DUPLICATE_POST')},
   clock:()=>Date.parse('2026-11-12T22:32:00Z')});
  assert.equal(next.reason,'CANARY_PUBLISH_ALREADY_RECORDED');
  const status=await directStatus(env);
  assert.equal(status.schedulerEnabled,false);
  assert.equal(status.freshNativePilotEnabled,true);
  assert.equal(status.canaryPublication.state,'EXTERNAL_LIVE');
  assert.doesNotMatch(JSON.stringify(status),/PRIVATE_DO_NOT_ECHO/);
 }finally{globalThis.fetch=originalFetch}
});
