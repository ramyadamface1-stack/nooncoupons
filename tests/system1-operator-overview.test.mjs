import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM1_HTML} from '../system1-control-center.js';
import {system1AdminSummary,nextGenerationWindowAt} from '../system1-admin-data.js';

test('SYSTEM1 operator overview displays real separate generation and publication states',()=>{
 for(const id of ['generatedDay','generatedDayHint','saPublishedDay','aePublishedDay','readyCount',
  'lastArticleSummary','nextArticleSummary','nextGenerationSchedule','nextPublishingSchedule',
  'lastHour','lastDay','geminiCount','groqCount','genInterval','saveInterval','saveKeys','keyBulk','keyFile'])
  assert.ok(SYSTEM1_HTML.includes('id="'+id+'"'),id);
 assert.match(SYSTEM1_HTML,/window\.setInterval\(\(\)=>\{if\(!document\.hidden\)load\(\)\},120000\)/);
 assert.match(SYSTEM1_HTML,/NEXT|موعد النشر غير محدد|موعد النشر غير محدد/);
 assert.match(SYSTEM1_HTML,/العدد غير مقاس بعد، وليس صفرًا/);
 assert.match(SYSTEM1_HTML,/توقيت حسابي متوقع للفحص، وليس ضمان تشغيل GitHub/);
 assert.doesNotMatch(SYSTEM1_HTML,/id="savePublishingInterval"/);
 assert.match(SYSTEM1_HTML,/https:\/\/github\.com\/ramyadamface1-stack\/nooncoupons\/actions/);
});
test('UTC generator windows are supported but never presented as confirmed article dates',()=>{
 assert.equal(nextGenerationWindowAt(Date.parse('2026-11-09T17:03:12.000Z'),1),'2026-11-09T17:04:00.000Z');
 assert.equal(nextGenerationWindowAt(Date.parse('2026-11-09T17:03:12.000Z'),5),'2026-11-09T17:05:00.000Z');
 assert.equal(nextGenerationWindowAt(Date.parse('2026-11-09T17:03:12.000Z'),15),'2026-11-09T17:15:00.000Z');
 assert.equal(nextGenerationWindowAt(NaN,1),null);
 assert.equal(nextGenerationWindowAt(Date.now(),2),null);
});
test('dashboard summary distinguishes published article and metrics from unmeasured generation and future publications',async()=>{
 const control=async()=>({enabled:true,intervalMinutes:5});
 const monitor=async()=>({ok:true,verified:{
  ledgerAvailable:true,lastHour:{total:2,SA:1,AE:1},last24Hours:{total:18,SA:10,AE:8},
  lastArticle:{slug:'saudi-buyer-real-product-nov170-2026',country:'SA',publishedAt:'2026-11-09T17:20:00.000Z'},
  generatedAt:'2026-11-09T17:20:30.000Z'
 },scheduler:{reachable:true,enabled:true,intervalMinutes:5},markets:[],providers:{gemini:{total:43},groq:{total:1}}});
 const response=await system1AdminSummary({CONTENT_FINAL:{get:async()=>null}},{monitor,control});
 assert.equal(response.publishing.status,'RECENT_VERIFIED');
 assert.deepEqual(response.publishing.verifiedMarketTotals,{SA:10,AE:8});
 assert.equal(response.publishing.nextArticleScheduledAt,null);
 assert.equal(response.publishing.publicationIntervalMinutes,null);
 assert.equal(response.generation.draftsGeneratedLast24Hours,null);
 assert.equal(response.generation.generatedCounterReason,'NO_INDEPENDENT_DRAFT_LEDGER');
 assert.match(response.generation.nextGenerationCheckAt,/Z$/);
 assert.equal(response.publishing.verified.lastArticle.country,'SA');
 const paused=await system1AdminSummary({CONTENT_FINAL:{get:async()=>null}},{monitor,control:async()=>({enabled:false,intervalMinutes:5})});
 assert.equal(paused.generation.nextGenerationCheckAt,null);
 const unavailable=await system1AdminSummary({CONTENT_FINAL:{get:async()=>null}},{monitor:async()=>({ok:false,scheduler:{reachable:false},verified:{ledgerAvailable:false}}),control});
 assert.equal(unavailable.publishing.verifiedMarketTotals,null);
 assert.equal(unavailable.publishing.nextArticleScheduledAt,null);
});


test('generation button starts from the site while keeping backend completion honest',()=>{
 assert.match(SYSTEM1_HTML,/id="runOnce">2 — توليد الآن من الموقع<\/button>/);
 assert.match(SYSTEM1_HTML,/\/api\/admin\/ai-v2-run-now/);
 assert.match(SYSTEM1_HTML,/استلمت خدمة الخلفية طلب التوليد من الموقع/);
 assert.match(SYSTEM1_HTML,/لم يتم تأكيد توليد أو نشر مقالة بعد/);
 assert.doesNotMatch(SYSTEM1_HTML,/id="runOnce">[^<]*GitHub/);
});

test('live status ribbon is visible before every tab and contains verified stages and publication facts',()=>{
 assert.ok(SYSTEM1_HTML.indexOf('id="liveStrip"')<SYSTEM1_HTML.indexOf('id="view-overview"'));
 for(const id of ['liveStrip','liveHeadline','liveReason','liveCheckedAt','liveStageScheduler',
  'liveStageGeneration','liveStageReady','liveStagePublishing','liveLastPublished',
  'liveNextPublish','liveReadyCount','liveIssue','liveAttempt'])
  assert.match(SYSTEM1_HTML,new RegExp('id="'+id+'"'),id);
 assert.match(SYSTEM1_HTML,/function renderLiveStrip\(s\)/);
 assert.match(SYSTEM1_HTML,/scheduler\.controlStatus==='POLICY_VERIFIED'/);
 assert.match(SYSTEM1_HTML,/publicationFresh&&lastHour>0/);
 assert.match(SYSTEM1_HTML,/s\.stockpile\?\.available===true&&Number\.isSafeInteger/);
 assert.match(SYSTEM1_HTML,/المجدول غير مفعّل فعليًا/);
 assert.match(SYSTEM1_HTML,/غير محدد — ليس موعد التوليد/);
 assert.match(SYSTEM1_HTML,/مؤشرات مستقلة وليس نسبة تقدّم/);
 assert.match(SYSTEM1_HTML,/function liveStripUnavailable\(message\)/);
 assert.match(SYSTEM1_HTML,/lastManualDispatch=\{at:new Date\(\)\.toISOString\(\)/);
 assert.doesNotMatch(SYSTEM1_HTML,/id="liveNextPublish"[^>]*>\d{1,2}:\d{2}/);
});
