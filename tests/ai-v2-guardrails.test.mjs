import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cadence,validateConfig,assertTopic,stableId,classifyFailure,normalizeDraft,qualityPreflight,mayCallProvider} from '../automation/ai-v2/guardrails.mjs';
import {objectPath,checkpointState} from '../automation/ai-v2/r2-checkpoints.mjs';
import {callProvider} from '../automation/ai-v2/providers.mjs';
const config=JSON.parse(readFileSync(new URL('../automation/ai-v2/config.json',import.meta.url)));
const topics=JSON.parse(readFileSync(new URL('../automation/ai-v2/topics.json',import.meta.url)));
test('safe no-cost defaults, unified one-minute cadence and market policy',()=>{
 assert.equal(validateConfig(config),true);assert.equal(config.enabled,false);
 assert.equal(config.targetPerHour,60);assert.equal(config.targetPerDay,1440);
 assert.equal(config.publicationMode,'checkpoint_only');assert.equal(config.maxConcurrent,1);
 assert.equal(config.siteMarkets.SA.coupon,'NOV170');assert.equal(config.siteMarkets.AE.coupon,'NOV188');
});
test('one-minute due is not a publication; all configured cadences remain supported',()=>{
 const active={...config,enabled:true},base=Date.parse('2026-11-01T12:00:00Z');
 assert.equal(cadence(active,base).due,true);
 assert.equal(cadence(active,base+60000).reason,'DUE');
 const five={...active,intervalMinutes:5,targetPerHour:12,targetPerDay:288};
 assert.equal(cadence(five,base+60000).reason,'INTERVAL_NOT_ELAPSED');
 assert.equal(cadence(active,base+300000).due,true);
 assert.equal(cadence(config,base).reason,'SCHEDULER_DISABLED');
 for(const i of [1,5,10,15,30,60]){
  const c={...active,intervalMinutes:i,targetPerHour:60/i,targetPerDay:1440/i};
  assert.equal(validateConfig(c),true);
 }
});
test('fixed article identity includes market and coupon, and private checkpoint path',()=>{
 for(const t of topics){
  const id=assertTopic(t,config);
  assert.equal(stableId(t),id);
  assert.match(objectPath(config,id),/^nooncoupons-content-v2\/_ops\/ai-v2-checkpoints\/[a-f0-9]{24}\.json$/);
 }
 assert.throws(()=>assertTopic({...topics[0],country:'AE'},config));
 assert.throws(()=>assertTopic({...topics[0],coupon:'DEC720'},config));
});
test('provider errors preserve quota, account, model and network categories',()=>{
 assert.equal(classifyFailure(401).category,'INVALID_KEY');
 assert.equal(classifyFailure(403,'organization restricted').scope,'organization');
 assert.deepEqual(classifyFailure(429,'quota','300'),{category:'QUOTA',retry:false,retryAfter:'300'});
 assert.equal(classifyFailure(502).category,'PROVIDER_TEMPORARY');
 assert.equal(classifyFailure(400,'model not found').category,'INVALID_MODEL');
});
test('uncertain provider completion never regenerates saved sections automatically',()=>{
 const s={articleId:'a'.repeat(24),version:3,state:'REQUEST_SENT',sections:[{html:'saved section'}]};
 const next=checkpointState(s,'UNKNOWN_REQUEST_OUTCOME');
 assert.equal(next.version,4);assert.equal(next.sections.length,1);assert.equal(next.state,'UNKNOWN_REQUEST_OUTCOME');
});
test('free deterministic field repair and critical content placeholders',()=>{
 assert.deepEqual(normalizeDraft({faq:[{question:'Q',answer:'A'}]}).faq,[{q:'Q',a:'A'}]);
 const html='<h1>Title</h1><script>alert(1)</script>'+String.fromCharCode(36)+'{coupon}';
 const q=qualityPreflight({html,topic:topics[0]},config);
 assert.equal(q.pass,false);for(const v of ['PLACEHOLDER','SCRIPT_NOT_ALLOWED','WORD_WINDOW'])assert.ok(q.violations.includes(v));
});
test('free-only budget and private storage are mandatory before any AI request',()=>{
 const args={config,freeApproved:true,checkpointWritable:true,topicReserved:true,hasAnyKey:true};
 assert.equal(mayCallProvider(args),'SCHEDULER_DISABLED');
 const active={...config,enabled:true};
 assert.equal(mayCallProvider({...args,config:active,freeApproved:false}),'FREE_BUDGET_NOT_APPROVED');
 assert.equal(mayCallProvider({...args,config:active,checkpointWritable:false}),'CHECKPOINT_UNAVAILABLE');
 assert.equal(mayCallProvider({...args,config:active,hasAnyKey:false}),'AI_KEYS_MISSING');
 assert.equal(mayCallProvider({...args,config:active}),null);
});
test('Groq transport executes exactly one call and categorizes explicit 429 without rotating',async()=>{
 let calls=0;const key='test-only-not-real';
 const success=await callProvider({provider:'groq',model:config.models.groq,key,prompt:'test',fetchFn:async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:'x'.repeat(700)}}]}),{status:200,headers:{'x-request-id':'safe-1'}})}});
 assert.equal(success.ok,true);assert.equal(success.requestId,'safe-1');assert.equal(calls,1);
 const fail=await callProvider({provider:'groq',model:config.models.groq,key,prompt:'test',fetchFn:async()=>{calls++;return new Response('quota',{status:429,headers:{'retry-after':'180'}})}});
 assert.equal(fail.category,'QUOTA');assert.equal(fail.retry,false);assert.equal(calls,2);
});
