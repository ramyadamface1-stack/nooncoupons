import test from 'node:test';
import assert from 'node:assert/strict';
import base from '../automation/ai-v2/topics.json' with {type:'json'};
import config from '../automation/ai-v2/config.json' with {type:'json'};
import {expandedEditorialTopics} from '../automation/ai-v2/topic-expansion.mjs';
import {assertTopic} from '../automation/ai-v2/guardrails.mjs';
import {publicationReadyTopic} from '../automation/ai-v2/topic-queue.mjs';
test('the durable original queue is unchanged and expansion is unique and market safe',()=>{
 assert.ok(expandedEditorialTopics.length>=650);
 const old=new Set(base.map(t=>t.slug)),newSlugs=expandedEditorialTopics.map(t=>t.slug);
 assert.equal(newSlugs.length,new Set(newSlugs).size);
 assert.ok(newSlugs.every(x=>!old.has(x)));
 for(const item of expandedEditorialTopics){
  assertTopic(item,config);
  assert.ok(publicationReadyTopic(item));
  assert.ok(item.topic.length>=28&&item.topic.length<=72);
  assert.ok(item.topic.includes(item.coupon));
  assert.ok(item.sections.length===5&&item.sections[0].includes(item.country==='AE'?'matching ':' حسب '));
  assert.ok(item.queryModifier&&item.brandKey&&item.modelKey&&item.comparisonKey);
 }
});

test('empty legacy scan bridges immediately to expanded bank without moving old positions',async()=>{
 const {queueExpansionBridgeWindow,queueScanWindow}=await import('../automation/ai-v2/topic-queue.mjs');
 const oldWindow=queueScanWindow(base.length,80);
 assert.deepEqual(queueExpansionBridgeWindow(base.length+expandedEditorialTopics.length,base.length,oldWindow),Array.from({length:8},(_,i)=>base.length+i));
 assert.deepEqual(queueExpansionBridgeWindow(base.length+expandedEditorialTopics.length,base.length,[base.length-5,base.length]),[]);
 assert.deepEqual(queueExpansionBridgeWindow(base.length+expandedEditorialTopics.length,base.length,[base.length+4]),[]);
 assert.deepEqual(queueExpansionBridgeWindow(base.length,base.length,oldWindow),[]);
});
