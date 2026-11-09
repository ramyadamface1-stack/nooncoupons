import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import base from '../automation/ai-v2/topics.json' with {type:'json'};
import config from '../automation/ai-v2/config.json' with {type:'json'};
import {expandedEditorialTopics,establishedEditorialFamilies} from '../automation/ai-v2/topic-expansion.mjs';
import {newEditorialTopicWave} from '../automation/ai-v2/topic-refresh.mjs';
import {assertTopic} from '../automation/ai-v2/guardrails.mjs';
import {publicationReadyTopic,queueScanWindow,queueExpansionBridgeWindow,queueRotatingFreshWaveWindow} from '../automation/ai-v2/topic-queue.mjs';
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

import {thirdEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n3.mjs';

test('third wave appends unique commercial questions while preserving both older queues and all native safety rules',()=>{
 const preceding=[...base,...expandedEditorialTopics,...newEditorialTopicWave];
 const oldSlugs=new Set(preceding.map(x=>x.slug));
 assert.ok(thirdEditorialTopicWave.length>=700,'insufficient fresh varied topics');
 const distinct=new Set(thirdEditorialTopicWave.map(x=>x.slug));
 assert.equal(distinct.size,thirdEditorialTopicWave.length);
 for(const topic of thirdEditorialTopicWave){
  assert.ok(!oldSlugs.has(topic.slug),topic.slug);
  assertTopic(topic,config);
  assert.ok(publicationReadyTopic(topic));
  assert.ok(topic.topic.length>=28&&topic.topic.length<=72);
  assert.ok(topic.topic.includes(topic.coupon));
  assert.ok(topic.queryModifier&&topic.modelKey&&topic.comparisonKey);
  assert.equal(topic.sections.length,5);
  assert.ok(topic.slug.endsWith('-2026-n3'));
 }
 const all=[...preceding,...thirdEditorialTopicWave];
 for(let i=0;i<preceding.length;i++)assert.equal(all[i],preceding[i]);
 const bridged=queueExpansionBridgeWindow(all.length,preceding.length,queueScanWindow(all.length,preceding.length-50));
 assert.deepEqual(bridged,Array.from({length:8},(_,i)=>preceding.length+i));
 assert.equal(thirdEditorialTopicWave[0].country,'SA');
 assert.equal(thirdEditorialTopicWave[1].country,'AE');
});

import {fourthEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n4.mjs';
test('N4 queue refills exhausted 3002-topic corpus with unique, high-intent country and brand guides',()=>{
 const historical=[...base,...expandedEditorialTopics,...newEditorialTopicWave,...thirdEditorialTopicWave];
 assert.ok(historical.length>=3000,'previous queue count changed');
 assert.ok(fourthEditorialTopicWave.length>=1150,'fresh N4 queue too small');
 const existing=new Set(historical.map(x=>x.slug));
 const seen=new Set();
 for(const t of fourthEditorialTopicWave){
  assert.ok(!existing.has(t.slug),'collision with published historical slug '+t.slug);
  assert.ok(!seen.has(t.slug),'new N4 slug duplicated '+t.slug);
  seen.add(t.slug);
  assertTopic(t,config);
  assert.ok(publicationReadyTopic(t));
  assert.ok(t.topic.includes(t.coupon));
  assert.ok(t.queryModifier&&t.modelKey&&t.comparisonKey);
  assert.equal(t.sections.length,5);
  assert.ok(t.slug.endsWith('-2026-n4'));
 }
 const full=[...historical,...fourthEditorialTopicWave];
 for(let i=0;i<historical.length;i++)assert.equal(full[i],historical[i],'historical position modified');
 const oldWindow=queueScanWindow(full.length,0);
 const bridge=queueExpansionBridgeWindow(full.length,historical.length,oldWindow);
 assert.deepEqual(bridge,Array.from({length:8},(_,i)=>historical.length+i));
 assert.equal(fourthEditorialTopicWave[0].country,'SA');
 assert.equal(fourthEditorialTopicWave[1].country,'AE');
});

import {fifthEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n5.mjs';
test('fifth append-only reserve keeps old checkpoints stable and adds distinct source-conscious buying questions',()=>{
 const prior=[...base,...expandedEditorialTopics,...newEditorialTopicWave,...thirdEditorialTopicWave,...fourthEditorialTopicWave];
 assert.ok(fifthEditorialTopicWave.length>=180,'N5 must contain a useful fresh reserve');
 const existing=new Set(prior.map(x=>x.slug)),unique=new Set();
 for(const t of fifthEditorialTopicWave){
  assert.ok(!existing.has(t.slug),'Already used editorial slug '+t.slug);
  assert.ok(!unique.has(t.slug),'N5 slug repeated '+t.slug);unique.add(t.slug);
  assertTopic(t,config);assert.ok(publicationReadyTopic(t));
  assert.ok(t.topic.length>=28&&t.topic.length<=72);
  assert.ok(t.topic.includes(t.coupon));
  assert.ok(t.topic.includes(t.country==='AE'?'Noon UAE':'نون السعودية'));
  assert.ok(t.slug.endsWith('-2026-n5'));
  assert.equal(t.sections.length,5);
 }
 const all=[...prior,...fifthEditorialTopicWave];
 for(let i=0;i<prior.length;i++)assert.equal(all[i],prior[i],'Historic R2 checkpoint index changed');
 const bridge=queueExpansionBridgeWindow(all.length,prior.length,queueScanWindow(all.length,prior.length-60));
 assert.deepEqual(bridge,Array.from({length:8},(_,i)=>prior.length+i));
 assert.equal(fifthEditorialTopicWave[0].country,'SA');
 assert.equal(fifthEditorialTopicWave[1].country,'AE');
});

test('N5 identity remains in production queue before appended N6 wave',()=>{
 const source=readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.match(source,/import \{fifthEditorialTopicWave\} from '\.\/topic-refresh-n5\.mjs'/);
 assert.match(source,/\.\.\.fourthEditorialTopicWave,\.\.\.fifthEditorialTopicWave,\.\.\.sixthEditorialTopicWave,\.\.\.seventhEditorialTopicWave\]/);
 assert.match(source,/queueRotatingFreshWaveWindow\(topics\.length,seventhWaveStart,firstWindow,4\)/);
 assert.match(source,/queueExpansionBridgeWindow\(topics\.length,existingTopicCount,firstWindow,4\)/);
 const previous=[...base,...expandedEditorialTopics,...newEditorialTopicWave,...thirdEditorialTopicWave,...fourthEditorialTopicWave];
 const next=[...previous,...fifthEditorialTopicWave];
 assert.ok(fifthEditorialTopicWave.length>=180);
 assert.equal(next.length-previous.length,fifthEditorialTopicWave.length);
 for(let i=0;i<previous.length;i++)assert.equal(next[i],previous[i]);
});
test('latest wave bridge rotates instead of rereading only the first four',()=>{
 const start=200,total=224;
 assert.deepEqual(queueRotatingFreshWaveWindow(total,start,[0,1,2,3]),[200,201,202,203]);
 assert.deepEqual(queueRotatingFreshWaveWindow(total,start,[24,25,26,27]),[201,202,203,204]);
 assert.deepEqual(queueRotatingFreshWaveWindow(total,start,[48,49,50,51]),[202,203,204,205]);
 assert.deepEqual(queueRotatingFreshWaveWindow(total,start,[199,0,1,2]),[208,209,210,211]);
 assert.deepEqual(queueRotatingFreshWaveWindow(total,start,[200,201,202,203]),[]);
 assert.deepEqual(queueRotatingFreshWaveWindow(total,start,[225]),[]);
 assert.deepEqual(queueRotatingFreshWaveWindow(total,start,[12],5),[]);
 const visited=new Set();
 for(let cursor=0;cursor<200;cursor+=24)
   for(const p of queueRotatingFreshWaveWindow(total,start,[cursor]))visited.add(p);
 assert.ok(visited.size>=10);
});

import {sixthEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n6.mjs';
test('N6 new original buyer concerns preserve all 4820 previous R2 identities and market codes',()=>{
 const older=[...base,...expandedEditorialTopics,...newEditorialTopicWave,...thirdEditorialTopicWave,...fourthEditorialTopicWave,...fifthEditorialTopicWave];
 assert.ok(older.length>=4820,'Existing append-only queue unexpectedly changed');
 assert.ok(sixthEditorialTopicWave.length>=180,'N6 needs substantial original reserve');
 const oldSlugs=new Set(older.map(t=>t.slug)),freshSlugs=new Set();
 for(const t of sixthEditorialTopicWave){
   assert.ok(!oldSlugs.has(t.slug),'Previous article slug repeated: '+t.slug);
   assert.ok(!freshSlugs.has(t.slug),'N6 slug repeated: '+t.slug);
   freshSlugs.add(t.slug);
   assertTopic(t,config);
   assert.ok(publicationReadyTopic(t));
   assert.equal(t.coupon,t.country==='AE'?'NOV188':'NOV170');
   assert.ok(t.topic.includes(t.coupon));
   assert.ok(t.topic.includes(t.country==='AE'?'Noon UAE':'نون السعودية'));
   assert.ok(t.topic.length>=28&&t.topic.length<=72);
   assert.ok(t.slug.endsWith('-2026-n6'));
   assert.equal(t.sections.length,5);
 }
 assert.ok(sixthEditorialTopicWave.some(t=>t.country==='SA'));
 assert.ok(sixthEditorialTopicWave.some(t=>t.country==='AE'));
 const combined=[...older,...sixthEditorialTopicWave];
 for(let i=0;i<older.length;i++)assert.equal(combined[i],older[i]);
});
test('N6 history remains wired before N7, without changing legacy provider budget',()=>{
 const s=readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.match(s,/import \{sixthEditorialTopicWave\} from '\.\/topic-refresh-n6\.mjs'/);
 assert.match(s,/const sixthWaveStart=fifthWaveStart\+fifthEditorialTopicWave\.length/);
 assert.match(s,/queueRotatingFreshWaveWindow\(topics\.length,seventhWaveStart,firstWindow,4\)/);
 assert.match(s,/queueExpansionBridgeWindow\(topics\.length,existingTopicCount,firstWindow,4\)/);
 assert.match(s,/market-queue-v1/);
 assert.doesNotMatch(s,/removeCheckpoint|deleteCheckpoint/);
});

import {seventhEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n7.mjs';
test('N7 replenishes fresh market-safe questions without altering the N1-N6 corpus or coupons',()=>{
 const previous=[...base,...expandedEditorialTopics,...newEditorialTopicWave,...thirdEditorialTopicWave,...fourthEditorialTopicWave,...fifthEditorialTopicWave,...sixthEditorialTopicWave];
 const oldSlugs=new Set(previous.map(t=>t.slug)),seen=new Set();
 const olderQuestions=new Set(sixthEditorialTopicWave.map(t=>t.queryModifier));
 assert.ok(seventhEditorialTopicWave.length>=220,'Need a substantial, truly fresh N7 reserve');
 for(const t of seventhEditorialTopicWave){
   assert.ok(!oldSlugs.has(t.slug),'Prior checkpoint slug must remain untouched: '+t.slug);
   assert.ok(!seen.has(t.slug),'N7 slug collision: '+t.slug);
   seen.add(t.slug);
   assert.ok(!olderQuestions.has(t.queryModifier),'N6 buyer question duplicated: '+t.queryModifier);
   assertTopic(t,config);
   assert.ok(publicationReadyTopic(t));
   assert.ok(['SA','AE'].includes(t.country));
   assert.equal(t.coupon,t.country==='AE'?'NOV188':'NOV170');
   assert.ok(t.topic.includes(t.coupon));
   assert.ok(t.topic.includes(t.country==='AE'?'Noon UAE':'نون السعودية'));
   assert.ok(t.topic.length>=28&&t.topic.length<=72);
   assert.ok(t.slug.endsWith('-2026-n7'));
   assert.equal(t.sections.length,5);
 }
 assert.ok(seventhEditorialTopicWave.some(t=>t.country==='SA'));
 assert.ok(seventhEditorialTopicWave.some(t=>t.country==='AE'));
 const appended=[...previous,...seventhEditorialTopicWave];
 for(let i=0;i<previous.length;i++)assert.equal(appended[i],previous[i]);
});
test('new N7 is used in production and keeps the 4+4 bounded reserve without resetting cursors',()=>{
 const s=readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.match(s,/import \{seventhEditorialTopicWave\} from '\.\/topic-refresh-n7\.mjs'/);
 assert.match(s,/const seventhWaveStart=sixthWaveStart\+sixthEditorialTopicWave\.length/);
 assert.match(s,/\.\.\.sixthEditorialTopicWave,\.\.\.seventhEditorialTopicWave\]/);
 assert.match(s,/queueRotatingFreshWaveWindow\(topics\.length,seventhWaveStart,firstWindow,4\)/);
 assert.match(s,/queueExpansionBridgeWindow\(topics\.length,existingTopicCount,firstWindow,4\)/);
 assert.match(s,/market-queue-v1/);
 assert.doesNotMatch(s,/removeCheckpoint|deleteCheckpoint/);
});
