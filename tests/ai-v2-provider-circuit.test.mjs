import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {quotaCooldownSeconds,temporaryCooldown,providerCircuitId,providerModelKeyCircuitId,providerCircuitActive,createProviderCircuitSnapshot,providerFailoverOrder,unknownRequestModelKeyCooldown,AMBIGUOUS_PROVIDER_MODEL_KEY_COOLDOWN_SECONDS,recordGeminiModelQuotaRejection,GEMINI_MODEL_FALLBACK_DISTINCT_429_KEYS} from '../automation/ai-v2/provider-circuit.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
test('confirmed Groq 429 pauses across topics with bounded cooldown',()=>{
 assert.equal(quotaCooldownSeconds('30'),900);
 assert.equal(quotaCooldownSeconds('3600'),3600);
 assert.equal(quotaCooldownSeconds('999999'),86400);
 assert.equal(quotaCooldownSeconds(''),3600);
 const until=new Date(Date.parse('2026-11-01T20:00:00Z')+3600000).toISOString();
 assert.equal(providerCircuitActive({state:'PAUSED_QUOTA',resumeAt:until},Date.parse('2026-11-01T20:30:00Z')),true);
 assert.equal(providerCircuitActive({state:'PAUSED_QUOTA',resumeAt:until},Date.parse('2026-11-01T21:01:00Z')),false);
 assert.equal(providerCircuitActive({state:'PAUSED_PROVIDER',resumeAt:until},Date.parse('2026-11-01T20:30:00Z')),true);
});
test('separate provider circuit records never collide',()=>{
 assert.notEqual(providerCircuitId('groq',sha),providerCircuitId('gemini',sha));
 assert.notEqual(providerCircuitId('gemini',sha,'aaaaaaaaaaaa'),providerCircuitId('gemini',sha,'bbbbbbbbbbbb'));
 assert.notEqual(providerCircuitId('groq',sha),providerCircuitId('groq',sha,'aaaaaaaaaaaa'));
 assert.notEqual(providerCircuitId('groq',sha,'aaaaaaaaaaaa'),providerCircuitId('groq',sha,'bbbbbbbbbbbb'));
 assert.throws(()=>providerCircuitId('gemini',sha,'bad'),/invalid_key_ref/);
 assert.throws(()=>providerCircuitId('paid-provider',sha),/unsupported_provider/);
});

test('per-run cooldown cache reads each circuit at most once and updates after an acknowledged write',async()=>{
 const persisted=new Map([['global',null],['key1',{articleId:'key1',state:'ACTIVE'}]]);
 let reads=0,writes=0;
 const snap=createProviderCircuitSnapshot(async id=>{reads++;return persisted.get(id)||null},
  async state=>{writes++;persisted.set(state.articleId,state);return state});
 assert.equal(await snap.read('global'),null);
 assert.equal(await snap.read('global'),null);
 assert.equal((await snap.read('key1')).state,'ACTIVE');
 assert.equal(reads,2);
 await snap.write({articleId:'key1',state:'PAUSED_QUOTA',resumeAt:'2026-11-03T20:00:00Z'});
 assert.equal((await snap.read('key1')).state,'PAUSED_QUOTA');
 assert.equal(reads,2);
 assert.equal(writes,1);
 const next=createProviderCircuitSnapshot(async id=>{reads++;return persisted.get(id)||null},async s=>s);
 assert.equal((await next.read('key1')).state,'PAUSED_QUOTA');
 assert.equal(reads,3);
});
test('failed circuit writes never insert an imaginary cooldown',async()=>{
 const snap=createProviderCircuitSnapshot(async()=>null,async()=>{throw Error('R2_WRITE_UNAVAILABLE')});
 await assert.rejects(snap.write({articleId:'key2',state:'PAUSED_QUOTA'}),/R2_WRITE_UNAVAILABLE/);
 assert.equal(await snap.read('key2'),null);
 await assert.rejects(snap.write({state:'PAUSED_QUOTA'}),/CIRCUIT_ID_REQUIRED/);
});

test('5xx backoff begins below five minutes, increases only for recent repeated model-key failures, and honors Retry-After',()=>{
 const at=Date.parse('2026-11-03T16:00:00Z');
 assert.deepEqual(temporaryCooldown('',null,at),{seconds:45,streak:1});
 const recent={temporaryFailStreak:1,lastTemporaryAt:new Date(at-60000).toISOString()};
 assert.deepEqual(temporaryCooldown('',recent,at),{seconds:90,streak:2});
 assert.deepEqual(temporaryCooldown('240',recent,at),{seconds:240,streak:2});
 const older={...recent,lastTemporaryAt:new Date(at-3600000).toISOString()};
 assert.deepEqual(temporaryCooldown('',older,at),{seconds:45,streak:1});
 assert.deepEqual(temporaryCooldown('1200',null,at),{seconds:600,streak:1});
 assert.deepEqual(temporaryCooldown('',{temporaryFailStreak:4,lastTemporaryAt:new Date(at-1000).toISOString()},at),{seconds:300,streak:4});
});
test('confirmed 503 is scoped to the exact model and opaque key, not a global lock across free keys',()=>{
 const a=providerModelKeyCircuitId('gemini','gemini-3.5-flash-lite','aaaaaaaaaaaa',sha);
 const b=providerModelKeyCircuitId('gemini','gemini-3.5-flash-lite','bbbbbbbbbbbb',sha);
 const c=providerModelKeyCircuitId('gemini','gemini-3.8-flash','aaaaaaaaaaaa',sha);
 assert.notEqual(a,b);assert.notEqual(a,c);assert.notEqual(a,providerCircuitId('gemini',sha));
 assert.throws(()=>providerModelKeyCircuitId('gemini','', 'aaaaaaaaaaaa',sha),/INVALID_MODEL_KEY_CIRCUIT/);
});

test('confirmed 429 switches to the other already-approved free provider before trying more rejected provider keys',()=>{
 assert.deepEqual(providerFailoverOrder(['gemini','groq']),['gemini','groq']);
 assert.deepEqual(providerFailoverOrder(['gemini','groq'],'gemini'),['groq','gemini']);
 assert.deepEqual(providerFailoverOrder(['gemini','groq'],'groq'),['gemini','groq']);
 assert.deepEqual(providerFailoverOrder(['gemini'],'gemini'),['gemini']);
 assert.deepEqual(providerFailoverOrder(['groq','gemini','groq'],'groq'),['gemini','groq']);
 assert.deepEqual(providerFailoverOrder(['gemini','groq'],'unapproved-paid'),['gemini','groq']);
});


test('ambiguous Gemini timeout pauses exactly one free model/key without inventing a quota response',()=>{
 const at=Date.parse('2026-11-10T19:20:00Z'),model='gemini-3.8-flash',key='aaaaaaaaaaaa';
 const id=providerModelKeyCircuitId('gemini',model,key,sha);
 const record=unknownRequestModelKeyCooldown({circuitId:id,provider:'gemini',model,keyRef:key,atMs:at,prior:{version:4}});
 assert.equal(AMBIGUOUS_PROVIDER_MODEL_KEY_COOLDOWN_SECONDS,600);
 assert.deepEqual(record,{
  articleId:id,state:'PAUSED_PROVIDER',provider:'gemini',model,keyRef:key,
  errorCategory:'NETWORK_OR_TIMEOUT_AFTER_REQUEST_SENT',
  createdAt:'2026-11-10T19:20:00.000Z',
  resumeAt:'2026-11-10T19:30:00.000Z',version:5
 });
 assert.ok(providerCircuitActive(record,at+599000));
 assert.equal(providerCircuitActive(record,at+600000),false);
 assert.notEqual(id,providerModelKeyCircuitId('gemini',model,'bbbbbbbbbbbb',sha));
 assert.notEqual(id,providerModelKeyCircuitId('gemini','gemini-3.5-flash-lite',key,sha));
 assert.notEqual(id,providerCircuitId('gemini',sha));
 assert.equal(record.lastRequestStatus,undefined,'Do not fake a definite 429');
 assert.equal(record.key,undefined,'Never persist the real credential');
});

test('invalid unknown-timeout circuit identifiers fail closed and a failed write never poisons unrelated free keys',async()=>{
 const at=Date.parse('2026-11-10T19:20:00Z');
 for(const patch of [{circuitId:'bad'}, {provider:'paid'}, {keyRef:'raw-secret'}, {model:''}]){
  assert.throws(()=>unknownRequestModelKeyCooldown({
   circuitId:'f'.repeat(24),provider:'gemini',model:'gemini-3.8-flash',keyRef:'a'.repeat(12),atMs:at,
   ...patch
  }),/INVALID_AMBIGUOUS_PROVIDER_CIRCUIT/);
 }
 const id=providerModelKeyCircuitId('gemini','gemini-3.8-flash','a'.repeat(12),sha);
 const other=providerModelKeyCircuitId('gemini','gemini-3.8-flash','b'.repeat(12),sha);
 const snap=createProviderCircuitSnapshot(async()=>null,async()=>{throw Error('R2_DOWN')});
 const record=unknownRequestModelKeyCooldown({circuitId:id,provider:'gemini',
  model:'gemini-3.8-flash',keyRef:'a'.repeat(12),atMs:at});
 await assert.rejects(()=>snap.write(record),/R2_DOWN/);
 assert.equal(await snap.read(id),null);
 assert.equal(await snap.read(other),null);
 const source=(await import('node:fs')).readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.match(source,/await saveCheckpoint\(config,checkpointState\(state,'UNKNOWN_REQUEST_OUTCOME',\{errorCategory:'NETWORK_OR_TIMEOUT_AFTER_REQUEST_SENT'\}\)\);\s*try\{\s*await providerCircuits\.write\(unknownRequestModelKeyCooldown\(/);
 assert.match(source,/console\.warn\('AI_V2_UNKNOWN_MODEL_KEY_COOLDOWN_PERSIST_FAILED'\)/);
});


test('two distinct definite 429 keys suggest free Gemini model rotation only within the same job',()=>{
 const byModel=new Map(),first='gemini-3.1-flash-lite',alternate='gemini-3.5-flash-lite';
 assert.equal(GEMINI_MODEL_FALLBACK_DISTINCT_429_KEYS,2);
 let signal=recordGeminiModelQuotaRejection(byModel,first,'aaaaaaaaaaaa');
 assert.deepEqual(signal,{distinctRejectedKeys:1,preferOtherFreeModel:false});
 signal=recordGeminiModelQuotaRejection(byModel,first,'aaaaaaaaaaaa');
 assert.deepEqual(signal,{distinctRejectedKeys:1,preferOtherFreeModel:false},
   'Repeated aliases of a single exhausted key do not prove distinct key exhaustion');
 signal=recordGeminiModelQuotaRejection(byModel,alternate,'aaaaaaaaaaaa');
 assert.deepEqual(signal,{distinctRejectedKeys:1,preferOtherFreeModel:false},
   'Different model does not share the original model rejection count');
 signal=recordGeminiModelQuotaRejection(byModel,first,'bbbbbbbbbbbb');
 assert.deepEqual(signal,{distinctRejectedKeys:2,preferOtherFreeModel:true});
 assert.equal(recordGeminiModelQuotaRejection(new Map(),first,'bbbbbbbbbbbb').preferOtherFreeModel,false,
   'New job has no inherited model-wide ban');
 assert.throws(()=>recordGeminiModelQuotaRejection({},first,'aaaaaaaaaaaa'),/INVALID_GEMINI_QUOTA_ROTATION_SIGNAL/);
 assert.throws(()=>recordGeminiModelQuotaRejection(new Map(),first,'raw-key'),/INVALID_GEMINI_QUOTA_ROTATION_SIGNAL/);
});

test('same-run 429 fallback retains per-key quota circuits and strict request budget',async()=>{
 const source=(await import('node:fs')).readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.match(source,/const geminiQuotaRejectedByModelThisRun=new Map\(\)/);
 assert.match(source,/if\(quota&&provider==='gemini'\)/);
 assert.match(source,/recordGeminiModelQuotaRejection\(\s*geminiQuotaRejectedByModelThisRun,model,keyRef\)/);
 assert.match(source,/temporarilyFailedModelsThisRun\.add\(provider\+'\|'\+model\)/);
 assert.match(source,/if\(calls>=config\.limits\.maxProviderCallsPerRun\)/);
 assert.match(source,/if\(quota\)lastQuotaRejectedProvider=provider/);
 assert.match(source,/pauseCircuitId=temporary\?modelKeyCircuitId:circuitId/,
   'Confirmed quota remains persisted against the exact failing credential');
 assert.doesNotMatch(source,/AI_V2_GEMINI_FREE_MODEL_ROTATION.*GEMINI_API_KEY/);
});
