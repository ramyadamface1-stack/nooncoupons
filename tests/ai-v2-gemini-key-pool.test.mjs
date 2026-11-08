import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGeminiKeys,geminiKeyInventory,selectGeminiKey} from '../automation/ai-v2/gemini-key-pool.mjs';
import {callProvider} from '../automation/ai-v2/providers.mjs';
import {inspectGeminiAuth} from '../automation/ai-v2/check-gemini-model.mjs';
const newer=(n)=>'AQ.'+'x'.repeat(18)+n;
const older=(n)=>'AIza'+'y'.repeat(18)+n;
test('accepts multiple new Gemini auth keys in newline CSV semicolon and JSON formats',()=>{
  const a=newer('a'),b=newer('b');
  for(const input of [a+'\n'+b,a+','+b,a+'; '+b,JSON.stringify([a,b])]){
    assert.deepEqual(parseGeminiKeys(input),[a,b]);
  }
});
test('rejects duplicates, empty entries and malformed JSON without exposing input',()=>{
  const a=newer('a');
  assert.deepEqual(parseGeminiKeys(a+'\n'+a+'\ninvalid'),[a]);
  assert.deepEqual(parseGeminiKeys('[bad'),[]);
  assert.deepEqual(parseGeminiKeys(''),[]);
});
test('prefers AQ auth secrets but retains a distinct legacy key as an additive fallback',()=>{
  const a=newer('a'),b=newer('b'),old=older('o');
  const env={GEMINI_API_KEYS:a+'\n'+b,GEMINI_API_KEY:old};
  const inventory=geminiKeyInventory(env);
  assert.equal(inventory.newAuthCount,2);
  assert.equal(inventory.oldCount,1);
  assert.equal(inventory.selectedSource,'GEMINI_API_KEYS_AUTH');
  assert.equal(selectGeminiKey(env,0).key,a);
  assert.equal(selectGeminiKey(env,1).key,b);
  assert.equal(selectGeminiKey(env,2).key,old);
  assert.equal(selectGeminiKey(env,3).key,a);
  assert.equal(inventory.eligibleCount,3);
  assert.equal(JSON.stringify(inventory).includes(a),false);
  assert.equal(JSON.stringify(inventory).includes(old),false);
  assert.equal(selectGeminiKey({GEMINI_API_KEY:old},0).key,old);
});
test('new auth key uses documented Gemini API header without a real provider request',async()=>{
  const auth=newer('a');let calls=0;
  const testFetch=async(url,options)=>{
    calls++;
    assert.ok(url.includes('/v1beta/models/gemini-3.8-flash:generateContent'));
    assert.equal(options.headers['x-goog-api-key'],auth);
    assert.equal(options.headers.authorization,undefined);
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Valid generated section. '.repeat(60)}]}}]}),{status:200});
  };
  const result=await callProvider({provider:'gemini',model:'gemini-3.8-flash',key:auth,prompt:'Write a section',fetchFn:testFetch});
  assert.equal(result.ok,true);
  assert.equal(calls,1);
});
test('one read-only model check verifies first new auth key without calling generation endpoint',async()=>{
  const auth=newer('a');let calls=0;
  const result=await inspectGeminiAuth({GEMINI_API_KEYS:auth},async (url,opts)=>{
    calls++;assert.ok(url.endsWith('/models/gemini-3.8-flash'));
    assert.equal(opts.method,'GET');assert.equal(opts.headers['x-goog-api-key'],auth);
    return new Response('{}',{status:200});
  });
  assert.equal(result.authenticationVerified,true);assert.equal(result.checkedKeys,1);assert.equal(result.generationCalls,0);assert.equal(calls,1);
  assert.equal(JSON.stringify(result).includes(auth),false);
});
test('read-only model check reports 403 without rotating or logging key',async()=>{
  const auth=newer('b');let calls=0;
  const result=await inspectGeminiAuth({GEMINI_API_KEYS:auth},async()=>{calls++;return new Response('Permission denied',{status:403})});
  assert.equal(result.authenticationVerified,false);
  assert.equal(result.httpStatus,403);assert.equal(result.checkedKeys,1);assert.equal(calls,1);
  assert.equal(JSON.stringify(result).includes(auth),false);
});

test('mixed AQ and AIza Gemini keys are all eligible in the bulk secret',()=>{
  const a=newer('a'),old=older('o'),b=newer('b');
  const env={GEMINI_API_KEYS:[a,old,b].join('\n'),GEMINI_API_KEY:older('fallback')};
  const inventory=geminiKeyInventory(env);
  assert.equal(inventory.newCount,3);
  assert.equal(inventory.newAuthCount,2);
  assert.equal(inventory.eligibleCount,4);
  assert.equal(inventory.selectedSource,'GEMINI_API_KEYS');
  assert.deepEqual([0,1,2,3].map(i=>selectGeminiKey(env,i).key),[a,old,b,older('fallback')]);
});

test('Gemini extra secret adds keys without replacing existing bulk keys',()=>{
  const a=newer('a'),b=older('b'),c=newer('c');
  const env={GEMINI_API_KEYS:a,GEMINI_API_KEYS_EXTRA:[b,c,a].join(',')};
  const i=geminiKeyInventory(env);
  assert.equal(i.eligibleCount,3);
  assert.equal(i.extraCount,3);
  assert.deepEqual([0,1,2].map(n=>selectGeminiKey(env,n).key),[a,b,c]);
  assert.equal(selectGeminiKey(env,1).source,'GEMINI_API_KEYS_EXTRA');
});
