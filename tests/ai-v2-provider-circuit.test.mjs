import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {quotaCooldownSeconds,providerCircuitId,providerCircuitActive,createProviderCircuitSnapshot} from '../automation/ai-v2/provider-circuit.mjs';
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
