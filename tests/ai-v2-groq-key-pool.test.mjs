import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGroqKeys,groqKeyInventory,selectGroqKey} from '../automation/ai-v2/groq-key-pool.mjs';
const key=n=>'gsk_'+('x'.repeat(30))+n;
test('multi-Groq keys work from multiline, comma/semicolon, and JSON, with no secret output',()=>{
 const a=key('a'),b=key('b');
 for(const input of [a+'\n'+b,a+','+b,a+'; '+b,JSON.stringify([a,b])])
  assert.deepEqual(parseGroqKeys(input),[a,b]);
 assert.deepEqual(parseGroqKeys(a+'\n'+a+'\nmissing'),[a]);
 assert.deepEqual(parseGroqKeys('[bad'),[]);
 const env={GROQ_API_KEYS:a+'\n'+b,GROQ_API_KEY:key('old')};
 const report=groqKeyInventory(env);
 assert.equal(report.eligibleCount,3);
 assert.equal(report.selectedSource,'GROQ_API_KEYS');
 assert.equal(selectGroqKey(env,0).key,a);
 assert.equal(selectGroqKey(env,1).key,b);
 assert.equal(selectGroqKey(env,2).key,key('old'));
 assert.equal(selectGroqKey(env,3).key,a);
 assert.equal(JSON.stringify(report).includes(a),false);
 assert.equal(selectGroqKey({GROQ_API_KEY:key('old')},0).source,'GROQ_API_KEY');
});

test('Groq extra secret adds multiple keys without replacing existing key',()=>{
 const old=key('old'),newA=key('newA'),newB=key('newB');
 const env={GROQ_API_KEY:old,GROQ_API_KEYS_EXTRA:[newA,newB,old].join(',')};
 assert.equal(groqKeyInventory(env).eligibleCount,3);
 assert.equal(selectGroqKey(env,0).source,'GROQ_API_KEY');
 assert.equal(selectGroqKey(env,1).source,'GROQ_API_KEYS_EXTRA');
 assert.deepEqual([0,1,2].map(n=>selectGroqKey(env,n).key),[old,newA,newB]);
});
