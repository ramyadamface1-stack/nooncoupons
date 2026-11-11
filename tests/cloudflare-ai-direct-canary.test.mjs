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
test('the direct Worker has no GitHub runtime and canary has no active Cron',()=>{
 for(const path of ['cloudflare-ai-direct/engine.mjs','cloudflare-ai-direct/keys.mjs',
  'cloudflare-ai-direct/rpc-entry.mjs'])
  assert.doesNotMatch(read(path),/api\.github\.com|actions\/workflows|GITHUB_DISPATCH_TOKEN|repository_dispatch/);
 const cfg=JSON.parse(read('cloudflare-ai-direct/wrangler.jsonc'));
 assert.equal(cfg.r2_buckets[0].bucket_name,'nooncoupons-content-v2');
 assert.equal(cfg.vars.DIRECT_AI_STAGE,'canary-no-cron');
 assert.deepEqual(cfg.triggers.crons,[]);
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
 assert.doesNotMatch(release,/GEMINI_API_KEY|GROQ_API_KEY/);
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
  DIRECT_AI_STAGE:'canary-no-cron',
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
