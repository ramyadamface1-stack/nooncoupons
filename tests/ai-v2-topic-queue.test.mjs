import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../automation/ai-v2/config.json' with {type:'json'};
import topics from '../automation/ai-v2/topics.json' with {type:'json'};
import {publicationReadyTopic,resumableCheckpoint,queueInventory,queueScanWindow,nextQueueCursor,queueCursorAfterScan,QUEUE_SCAN_LIMIT,safeSaudiDeterministicRecovery,SA_SAFE_RECOVERY_REVISION} from '../automation/ai-v2/topic-queue.mjs';
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

test('new editorial titles never end with a broken word or violate the 72-character SEO ceiling',()=>{
 for(const t of topics.slice(20)){
   const marker=t.country==='AE'?': matching ':' حسب ';
   const focus=t.sections[0].split(marker)[1].replace(/ to the intended use$/,'');
   const included=t.topic.split(': ')[1].split(t.country==='AE'?' | Noon UAE':' | نون السعودية')[0];
   assert.ok(focus.startsWith(included),'broken focus: '+t.slug);
   assert.ok(focus===included||focus.charAt(included.length)===' ','cut a word: '+t.slug);
   assert.ok(t.topic.length<=72&&t.topic.length>=28);
 }
});

test('selected topic is retried on next minute before moving to the following product',()=>{
 assert.equal(queueCursorAfterScan(100,20,true),20);
 assert.equal(queueCursorAfterScan(100,20,false),21);
 const slot={state:'PREPARED_FOR_NATIVE_AUDIT',sectionIndex:5,sections:Array(5).fill({})};
 assert.equal(resumableCheckpoint(slot),true);
 const published={...slot,state:'LIVE_VERIFIED'};
 assert.equal(resumableCheckpoint(published),false);
});

test('new buying-topic queue interleaves UAE and Saudi markets without changing earlier cursor slots',()=>{
 assert.equal(topics[31].slug,'uae-sandisk-portable-ssd-backup-speed-nov188-2026');
 assert.equal(topics[32].slug,'uae-seagate-external-hdd-capacity-backup-nov188-2026');
 assert.equal(topics[33].slug,'uae-kingston-laptop-ram-ddr-upgrade-nov188-2026');
 for(let i=34;i<96;i+=2){
  assert.equal(topics[i].country,'SA','expected SA at queue '+i);
  assert.equal(topics[i+1].country,'AE','expected AE at queue '+(i+1));
 }
 assert.equal(new Set(topics.map(t=>t.slug)).size,topics.length);
});

test('Saudi saved drafts get one strict zero-provider native gate re-audit, never an unsafe retry',()=>{
 const sa=topics.find(t=>t.country==='SA'),ae=topics.find(t=>t.country==='AE');
 const base={state:'BLOCKED_REVIEW',sectionIndex:5,sections:Array.from({length:5},()=>({html:'<h2>قارن</h2><p>دليل أصلي</p>'}))};
 const short={...base,errorCategory:'WORD_WINDOW',qualityPreview:{wordCount:1483,violations:['WORD_WINDOW']}};
 assert.equal(safeSaudiDeterministicRecovery(short,sa),true);
 assert.equal(resumableCheckpoint(short,{autoSafeSaudiRecovery:true,topic:sa}),true);
 assert.equal(resumableCheckpoint(short,{topic:sa}),false);
 assert.equal(resumableCheckpoint(short,{autoSafeSaudiRecovery:true,topic:ae}),false);
 assert.equal(safeSaudiDeterministicRecovery({...short,qualityPreview:{wordCount:1200,violations:['WORD_WINDOW']}},sa),false);
 assert.equal(safeSaudiDeterministicRecovery({...short,qualityPreview:{wordCount:1483,violations:['WORD_WINDOW','SCRIPT_NOT_ALLOWED']}},sa),false);
 assert.equal(safeSaudiDeterministicRecovery({...short,deterministicRecoveryRevision:SA_SAFE_RECOVERY_REVISION},sa),false);
 const native={...base,errorCategory:'NATIVE_QUALITY_BLOCKED',nativeGateDiagnostics:{
  score:99,p0:['title_avoids_literal_coupon_code'],failed:['title_avoids_literal_coupon_code'],schemas:[],duplicates:[],indexation:[]
 }};
 assert.equal(safeSaudiDeterministicRecovery(native,sa),true);
 const technicalCouponLock={...native,nativeGateDiagnostics:{...native.nativeGateDiagnostics,p0:['coupon_lock'],failed:['coupon_lock']}};
 assert.equal(safeSaudiDeterministicRecovery(technicalCouponLock,sa),true);
 assert.equal(safeSaudiDeterministicRecovery({...native,nativeGateDiagnostics:{...native.nativeGateDiagnostics,failed:['title_avoids_literal_coupon_code','duplicate']}},sa),false);
 assert.equal(safeSaudiDeterministicRecovery({...native,sections:[]},sa),false);
 assert.equal(safeSaudiDeterministicRecovery({state:'UNKNOWN_REQUEST_OUTCOME',sectionIndex:5,sections:base.sections},sa),false);
});
