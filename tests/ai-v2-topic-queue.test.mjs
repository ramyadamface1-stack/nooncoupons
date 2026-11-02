import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../automation/ai-v2/config.json' with {type:'json'};
import topics from '../automation/ai-v2/topics.json' with {type:'json'};
import {publicationReadyTopic,resumableCheckpoint,queueInventory,queueScanWindow,nextQueueCursor,QUEUE_SCAN_LIMIT} from '../automation/ai-v2/topic-queue.mjs';
import {assertTopic} from '../automation/ai-v2/guardrails.mjs';
test('curated queue has unique topic slugs, stable IDs, country and approved coupon',()=>{
 const ids=topics.map(t=>assertTopic(t,config));
 assert.equal(ids.length,new Set(ids).size);
 assert.equal(topics.length,new Set(topics.map(t=>t.slug)).size);
 assert.ok(topics.length>=16);
 assert.ok(topics.some(t=>t.country==='SA'));
 assert.ok(topics.filter(t=>publicationReadyTopic(t)).length>=10);
 assert.equal(publicationReadyTopic(topics.find(t=>t.country==='SA')),true);
});
test('one verified live article cannot repeat and stored ambiguity is inspected, not re-generated',()=>{
 assert.equal(resumableCheckpoint({state:'LIVE_VERIFIED'}),false);
 assert.equal(resumableCheckpoint({state:'PAUSED_QUOTA'}),false);
 assert.equal(resumableCheckpoint({state:'PAUSED_QUOTA'},{manualGroqResume:true}),true);
 assert.equal(resumableCheckpoint({state:'UNKNOWN_REQUEST_OUTCOME'}),false);
 assert.equal(resumableCheckpoint({state:'PUBLISH_REQUEST_SENT'}),true);
 assert.equal(resumableCheckpoint({state:'DEPLOYING'}),true);
 assert.equal(resumableCheckpoint({state:'BLOCKED_REVIEW',errorCategory:'WORD_WINDOW',sections:Array(5).fill({}),sectionIndex:5},{savedOnly:true}),true);
 assert.equal(resumableCheckpoint({state:'BLOCKED_REVIEW',errorCategory:'unsafe_section'}),false);
});
test('queue inventory explicitly distinguishes unready Arabic market',()=>{
 const info=queueInventory(topics);
 assert.equal(info.total,topics.length);
 assert.equal(info.renderable,info.total);
 assert.deepEqual(info.pendingMarketRenderer,[]);
});

test('Arabic native gate repair may resume only a persisted complete saved draft with explicit approval',()=>{
 const saved={state:'BLOCKED_REVIEW',errorCategory:'NATIVE_QUALITY_BLOCKED',sections:Array(5).fill({}),sectionIndex:5};
 assert.equal(resumableCheckpoint(saved,{savedOnly:true}),false);
 assert.equal(resumableCheckpoint(saved,{savedOnly:true,nativeGateRepair:true}),true);
 assert.equal(resumableCheckpoint({...saved,sectionIndex:3},{savedOnly:true,nativeGateRepair:true}),false);
});

test('bounded round robin never scans the entire corpus and eventually covers every topic',()=>{
 let seen=new Set(),cursor=20;
 for(let n=0;n<Math.ceil(topics.length/QUEUE_SCAN_LIMIT);n++){
  let window=queueScanWindow(topics.length,cursor);
  assert.ok(window.length<=8);
  window.forEach(i=>seen.add(i));
  cursor=nextQueueCursor(topics.length,window.at(-1));
 }
 assert.equal(seen.size,topics.length);
 assert.equal(queueScanWindow(20,undefined)[0],19);
 assert.deepEqual(queueScanWindow(10,9,3),[9,0,1]);
 assert.equal(nextQueueCursor(10,9),0);
});
test('product-specific buying topics are not duplicated and preserve market codes in titles',()=>{
 assert.ok(topics.length>=85);
 for(const t of topics.slice(20)){
  assert.ok(t.topic.length>=28&&t.topic.length<=72,t.topic);
  assert.ok(t.topic.includes(t.coupon)&&t.topic.includes(t.country==='SA'?'نون السعودية':'Noon UAE'));
  assert.equal(t.sections.length,5);
 }
});
