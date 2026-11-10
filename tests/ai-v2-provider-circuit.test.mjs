import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {quotaCooldownSeconds,temporaryCooldown,providerCircuitId,providerModelKeyCircuitId,providerCircuitActive,createProviderCircuitSnapshot,providerFailoverOrder} from '../automation/ai-v2/provider-circuit.mjs';
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
