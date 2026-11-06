import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../automation/ai-v2/config.json' with {type:'json'};
import topics from '../automation/ai-v2/topics.json' with {type:'json'};
import {publicationReadyTopic,resumableCheckpoint,queueInventory,queueScanWindow,nextQueueCursor,queueCursorAfterScan,pausedProviderNextCursor,QUEUE_SCAN_LIMIT,safeSaudiDeterministicRecovery,SA_SAFE_RECOVERY_REVISION,safeSaudiFilesystemRecovery,SA_FILESYSTEM_RECOVERY_REVISION,safeEnglishDeterministicRecovery,AE_SAFE_RECOVERY_REVISION} from '../automation/ai-v2/topic-queue.mjs';
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
 assert.equal(resumableCheckpoint({state:'PAUSED_QUOTA',lastRequestStatus:429,errorCategory:'QUOTA',sectionIndex:2,sections:[{},{}]}),true);
 assert.equal(resumableCheckpoint({state:'PAUSED_QUOTA',lastRequestStatus:429,errorCategory:'QUOTA',sectionIndex:2,sections:[{}]}),false);
 assert.equal(resumableCheckpoint({state:'PAUSED_PROVIDER',lastRequestStatus:503,errorCategory:'PROVIDER_TEMPORARY',sectionIndex:2,sections:[{},{}]}),true);
 assert.equal(resumableCheckpoint({state:'PAUSED_PROVIDER',lastRequestStatus:503,errorCategory:'PROVIDER_TEMPORARY',sectionIndex:2,sections:[{}]}),false);
 assert.equal(resumableCheckpoint({state:'UNKNOWN_REQUEST_OUTCOME'}),false);
 assert.equal(resumableCheckpoint({state:'UNKNOWN_PUBLICATION_OUTCOME'}),false);
 assert.equal(resumableCheckpoint({state:'UNKNOWN_PUBLICATION_OUTCOME'},{manualGroqResume:true,savedOnly:true}),false);
 assert.equal(resumableCheckpoint({state:'PUBLISH_REQUEST_SENT'}),true);
 assert.equal(resumableCheckpoint({state:'DEPLOYING'}),true);
 assert.equal(resumableCheckpoint({state:'BLOCKED_REVIEW',errorCategory:'WORD_WINDOW',sections:Array(5).fill({}),sectionIndex:5},{savedOnly:true}),true);
 assert.equal(resumableCheckpoint({state:'BLOCKED_REVIEW',errorCategory:'unsafe_section'}),false);
});
test('unknown publication only permits one delayed URL-only reconciliation, never provider retry',()=>{
 const at=Date.parse('2026-11-06T14:00:00Z');
 const x={state:'UNKNOWN_PUBLICATION_OUTCOME',articleId:'d'.repeat(24),
  updatedAt:new Date(at).toISOString(),sectionIndex:5,sections:Array(5).fill({})};
 assert.equal(resumableCheckpoint(x),false);
 assert.equal(resumableCheckpoint(x,{autoReadOnlyReconcile:true,nowMs:at+14*60000}),false);
 assert.equal(resumableCheckpoint(x,{autoReadOnlyReconcile:true,nowMs:at+15*60000}),true);
 assert.equal(resumableCheckpoint({...x,publicationReconciliationAttemptedAt:new Date(at+15*60000).toISOString()},{autoReadOnlyReconcile:true,nowMs:at+24*3600000}),false);
 assert.equal(resumableCheckpoint({...x,state:'UNKNOWN_REQUEST_OUTCOME'},{autoReadOnlyReconcile:true,nowMs:at+24*3600000}),false);
 assert.equal(resumableCheckpoint({...x,updatedAt:'invalid-date'},{autoReadOnlyReconcile:true,nowMs:at+24*3600000}),false);
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
  assert.ok(window.length<=24);
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

// Reproduces the production queue freeze observed after a lost publish ack.
// The ambiguous checkpoint must remain intact, while cursor moves past it.
test('quarantined uncertain publication never blocks scheduled cursor forever',()=>{
 const ambiguous={state:'UNKNOWN_PUBLICATION_OUTCOME',sectionIndex:5,sections:Array(5).fill({})};
 assert.equal(resumableCheckpoint(ambiguous),false);
 assert.equal(resumableCheckpoint({...ambiguous,state:'PUBLISH_REQUEST_SENT'}),true);
 assert.equal(resumableCheckpoint({...ambiguous,state:'DEPLOYING'}),true);
 assert.equal(queueCursorAfterScan(100,38,false),39);
 assert.equal(resumableCheckpoint({...ambiguous,state:'PREPARED_FOR_NATIVE_AUDIT'}),true);
});

test('English completed near-minimum draft is retried once using saved content, not a provider',()=>{
 const ae=topics.find(t=>t.country==='AE'),sa=topics.find(t=>t.country==='SA');
 const c={state:'BLOCKED_REVIEW',errorCategory:'WORD_WINDOW',sectionIndex:5,
  sections:Array.from({length:5},()=>({html:'<h2>Useful guide</h2><p>Comparison advice.</p>'})),
  qualityPreview:{wordCount:1341,violations:['WORD_WINDOW']}};
 assert.equal(safeEnglishDeterministicRecovery(c,ae),true);
 assert.equal(resumableCheckpoint(c,{autoSafeEnglishRecovery:true,topic:ae}),true);
 assert.equal(resumableCheckpoint(c,{autoSafeEnglishRecovery:true,topic:sa}),false);
 assert.equal(safeEnglishDeterministicRecovery({...c,deterministicRecoveryRevision:AE_SAFE_RECOVERY_REVISION},ae),false);
 assert.equal(safeEnglishDeterministicRecovery({...c,qualityPreview:{wordCount:1000,violations:['WORD_WINDOW']}},ae),false);
 assert.equal(safeEnglishDeterministicRecovery({...c,qualityPreview:{wordCount:1341,violations:['WORD_WINDOW','SCRIPT_NOT_ALLOWED']}},ae),false);
 assert.equal(resumableCheckpoint({...c,state:'UNKNOWN_PUBLICATION_OUTCOME'},{autoSafeEnglishRecovery:true,topic:ae}),false);
});

test('cooldown or exhausted free call budget yields an unfinished checkpoint without erasing it',()=>{
 for(const why of ['ALL_FREE_PROVIDERS_IN_COOLDOWN','CALL_BUDGET_LIMIT','NO_FREE_PROVIDER_AVAILABLE']){
  assert.equal(pausedProviderNextCursor(248,176,why),177);
  assert.equal(pausedProviderNextCursor(248,247,why),0);
 }
 for(const unsafe of ['UNKNOWN_REQUEST_OUTCOME','NATIVE_QUALITY_BLOCKED','PUBLISH_OUTCOME_UNKNOWN']){
  assert.throws(()=>pausedProviderNextCursor(248,176,unsafe),/UNSAFE_QUEUE_YIELD_REASON/);
 }
 assert.equal(resumableCheckpoint({state:'PAUSED_QUOTA',lastRequestStatus:429,errorCategory:'QUOTA',sectionIndex:2,sections:[{},{}]}),true);
 assert.equal(resumableCheckpoint({state:'UNKNOWN_PUBLICATION_OUTCOME'}),false);
});

test('saved Saudi draft with only noncritical list and index score problems is re-audited once with zero AI requests',()=>{
 const t=topics.find(x=>x.country==='SA');
 const s={state:'BLOCKED_REVIEW',sectionIndex:5,errorCategory:'NATIVE_QUALITY_BLOCKED',
  sections:Array.from({length:5},()=>({html:'<h2>مراجعة</h2><p>مقارنة البائع</p>'})),
  nativeGateDiagnostics:{score:99.4,p0:[],failed:['lists'],schemas:[],duplicates:[],indexation:['indexation_value_below_threshold']}};
 assert.equal(safeSaudiDeterministicRecovery(s,t),true);
 assert.equal(resumableCheckpoint(s,{autoSafeSaudiRecovery:true,topic:t}),true);
 assert.equal(safeSaudiDeterministicRecovery({...s,deterministicRecoveryRevision:SA_SAFE_RECOVERY_REVISION},t),false);
 assert.equal(safeSaudiDeterministicRecovery({...s,nativeGateDiagnostics:{...s.nativeGateDiagnostics,duplicates:['duplicate']}},t),false);
 assert.equal(safeSaudiDeterministicRecovery({...s,nativeGateDiagnostics:{...s.nativeGateDiagnostics,indexation:['insufficient_information_gain']}},t),false);
});

test('a Saudi completed draft blocked only by indexation score is eligible for one no-AI safe revision',()=>{
 const topic=topics.find(t=>t.slug==='saudi-buyer-logitech-webcam-privacy-meetings-nov170-2026');
 const state={state:'BLOCKED_REVIEW',sectionIndex:5,errorCategory:'NATIVE_QUALITY_BLOCKED',
  sections:Array.from({length:5},()=>({html:'<h2>تقييم</h2><p>مقارنة الكاميرا والإضاءة</p>'})),
  nativeGateDiagnostics:{score:100,p0:[],failed:[],schemas:[],duplicates:[],indexation:['indexation_value_below_threshold']}};
 assert.equal(safeSaudiDeterministicRecovery(state,topic),true);
 assert.equal(resumableCheckpoint(state,{autoSafeSaudiRecovery:true,topic}),true);
 assert.equal(safeSaudiDeterministicRecovery({...state,deterministicRecoveryRevision:SA_SAFE_RECOVERY_REVISION},topic),false);
});

test('a definitive invalid or unauthorized key preserves the partial draft for free-provider failover',()=>{
 for(const [errorCategory,lastRequestStatus] of [['INVALID_KEY',401],['PROVIDER_PERMISSION',403]]){
  assert.equal(resumableCheckpoint({state:'PAUSED_PROVIDER',errorCategory,lastRequestStatus,sectionIndex:0,sections:[]}),true);
  assert.equal(resumableCheckpoint({state:'PAUSED_PROVIDER',errorCategory,lastRequestStatus,sectionIndex:2,sections:[{},{}]}),true);
  assert.equal(resumableCheckpoint({state:'PAUSED_PROVIDER',errorCategory,lastRequestStatus,sectionIndex:2,sections:[{}]}),false);
 }
 assert.equal(resumableCheckpoint({state:'PAUSED_PROVIDER',errorCategory:'INVALID_KEY',lastRequestStatus:500,sectionIndex:0,sections:[]}),false);
 assert.equal(resumableCheckpoint({state:'UNKNOWN_REQUEST_OUTCOME',errorCategory:'INVALID_KEY',sectionIndex:0,sections:[]}),false);
});
test('definitive provider 401 is key-scoped and can fail over without spending more on the rejected credential',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.match(source,/const invalidAuth=/);
 assert.match(source,/pauseSec=invalidAuth\?86400/);
 assert.match(source,/if\(quota\|\|temporary\|\|invalidAuth\)/);
 assert.match(source,/state:quota\?'PAUSED_QUOTA':'PAUSED_PROVIDER'/);
 assert.match(source,/AI_V2_PROVIDER_FAILOVER/);
});

test('Saudi network accessory false coupon code can be re-audited once from existing saved sections',()=>{
 const topic={country:'SA',category:'موزعات USB',brand:'يوجرين',coupon:'NOV170'};
 const cp={state:'BLOCKED_REVIEW',errorCategory:'NATIVE_QUALITY_BLOCKED',
  sectionIndex:5,sections:Array.from({length:5},()=>({html:'<h2>معلومات المنتج</h2>'})),
  nativeTopic:{...topic,code:'NOV170'},
  nativeArticle:{html:'<article>موصل RJ45 وكابل CAT8 وشروط الكوبون NOV170</article>'},
  nativeGateDiagnostics:{p0:['coupon_lock'],failed:['coupon_lock'],schemas:[],duplicates:[],indexation:[]}
 };
 assert.equal(safeSaudiFilesystemRecovery(cp,topic),true);
 assert.equal(resumableCheckpoint(cp,{autoSafeSaudiFilesystemRecovery:true,topic}),true);
 assert.equal(safeSaudiFilesystemRecovery({...cp,filesystemRecoveryRevision:SA_FILESYSTEM_RECOVERY_REVISION},topic),false);
 assert.equal(safeSaudiFilesystemRecovery({...cp,nativeArticle:{html:cp.nativeArticle.html+' NOV188'}},topic),false);
 assert.equal(safeSaudiFilesystemRecovery({...cp,nativeGateDiagnostics:{p0:['coupon_lock','country_lock'],failed:['coupon_lock'],schemas:[],duplicates:[],indexation:[]}},topic),false);
 assert.equal(safeSaudiFilesystemRecovery({...cp,nativeArticle:{html:'NOV170 فقط'}},topic),false);
 assert.equal(safeSaudiFilesystemRecovery(cp,{...topic,country:'AE'}),false);
});
