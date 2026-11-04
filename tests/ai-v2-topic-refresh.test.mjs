import test from 'node:test';
import assert from 'node:assert/strict';
import base from '../automation/ai-v2/topics.json' with {type:'json'};
import config from '../automation/ai-v2/config.json' with {type:'json'};
import {expandedEditorialTopics,establishedEditorialFamilies} from '../automation/ai-v2/topic-expansion.mjs';
import {newEditorialTopicWave} from '../automation/ai-v2/topic-refresh.mjs';
import {assertTopic} from '../automation/ai-v2/guardrails.mjs';
import {publicationReadyTopic,queueScanWindow,queueExpansionBridgeWindow} from '../automation/ai-v2/topic-queue.mjs';
test('second wave appends distinct, approved country-specific product scenarios without mutating past positions',()=>{
 const historical=[...base,...expandedEditorialTopics],old=new Set(historical.map(x=>x.slug));
 assert.ok(establishedEditorialFamilies.length>=45);
 assert.ok(newEditorialTopicWave.length>=750,'fresh queue too short');
 assert.equal(new Set(newEditorialTopicWave.map(x=>x.slug)).size,newEditorialTopicWave.length);
 assert.ok(newEditorialTopicWave.every(t=>!old.has(t.slug)));
 const actual=[...historical,...newEditorialTopicWave];
 for(let i=0;i<historical.length;i++)assert.equal(actual[i],historical[i],'historical position changed');
 assert.ok(newEditorialTopicWave.some(x=>x.country==='SA'));
 assert.ok(newEditorialTopicWave.some(x=>x.country==='AE'));
 for(const t of newEditorialTopicWave){
   assertTopic(t,config);
   assert.ok(publicationReadyTopic(t));
   assert.ok(t.topic.length<=72&&t.topic.length>=28);
   assert.ok(t.topic.includes(t.coupon));
   assert.ok(t.topic.includes(t.country==='AE'?'Noon UAE':'نون السعودية'));
   assert.ok(t.slug.endsWith('-2026-n2'));
 }
});
test('when old checkpoint windows are exhausted, a bounded bridge immediately reaches fresh wave',()=>{
 const oldCount=base.length+expandedEditorialTopics.length;
 const whole=oldCount+newEditorialTopicWave.length;
 const oldWindow=queueScanWindow(whole,oldCount-120);
 const bridged=queueExpansionBridgeWindow(whole,oldCount,oldWindow);
 assert.deepEqual(bridged,Array.from({length:8},(_,i)=>oldCount+i));
 const freshWindow=queueScanWindow(whole,oldCount+12);
 assert.deepEqual(queueExpansionBridgeWindow(whole,oldCount,freshWindow),[]);
 assert.equal(newEditorialTopicWave[0].country,'SA');
 assert.equal(newEditorialTopicWave[1].country,'AE');
});
test('publisher checks lightweight public health and never its high-CPU generator status endpoint',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("config.domain+'/api/health'"));
 assert.ok(!source.includes("config.domain+'/api/generator-health'"));
 assert.ok(source.includes('healthPayload?.ok!==true'));
});
