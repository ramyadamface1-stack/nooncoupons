import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {quotaCooldownSeconds,providerCircuitId,providerCircuitActive} from '../automation/ai-v2/provider-circuit.mjs';
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
