import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM1_HTML} from '../system1-control-center.js';
import {system1AdminSummary,nextGenerationWindowAt} from '../system1-admin-data.js';

test('SYSTEM1 operator overview displays real separate generation and publication states',()=>{
 for(const id of ['generatedDay','generatedDayHint','saPublishedDay','aePublishedDay','readyCount',
  'lastArticleSummary','nextArticleSummary','nextGenerationSchedule','nextPublishingSchedule',
  'lastHour','lastDay','geminiCount','groqCount','genInterval','saveInterval','publishInterval','savePublishingInterval','publishingIntervalHint','saveKeys','keyBulk','keyFile'])
  assert.ok(SYSTEM1_HTML.includes('id="'+id+'"'),id);
 assert.match(SYSTEM1_HTML,/window\.setInterval\(\(\)=>\{if\(!document\.hidden\)load\(\)\},60000\)/);
 assert.match(SYSTEM1_HTML,/نافذة النشر المستهدفة التالية/);
 assert.match(SYSTEM1_HTML,/العدد غير مقاس بعد، وليس صفرًا/);
 assert.match(SYSTEM1_HTML,/توقيت حسابي متوقع للفحص، وليس ضمان تشغيل GitHub/);
 assert.match(SYSTEM1_HTML,/id="savePublishingInterval"/);
 assert.match(SYSTEM1_HTML,/publishingIntervalMinutes:minutes/);
 assert.match(SYSTEM1_HTML,/https:\/\/github\.com\/ramyadamface1-stack\/nooncoupons\/actions/);
});
test('UTC generator windows are supported but never presented as confirmed article dates',()=>{
 assert.equal(nextGenerationWindowAt(Date.parse('2026-11-09T17:03:12.000Z'),1),'2026-11-09T17:04:00.000Z');
 assert.equal(nextGenerationWindowAt(Date.parse('2026-11-09T17:03:12.000Z'),5),'2026-11-09T17:05:00.000Z');
 assert.equal(nextGenerationWindowAt(Date.parse('2026-11-09T17:03:12.000Z'),15),'2026-11-09T17:15:00.000Z');
 assert.equal(nextGenerationWindowAt(NaN,1),null);
 assert.equal(nextGenerationWindowAt(Date.parse('2026-11-09T17:03:12.000Z'),2),'2026-11-09T17:04:00.000Z');
 assert.equal(nextGenerationWindowAt(Date.now(),16),null);
});
test('dashboard summary distinguishes published article and metrics from unmeasured generation and future publications',async()=>{
 const control=async()=>({enabled:true,intervalMinutes:5,publishingIntervalMinutes:15});
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
 assert.equal(response.publishing.desiredIntervalMinutes,15);
 assert.equal(response.publishing.nextPublicationWindowAt,null);
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
 assert.match(SYSTEM1_HTML,/غير متاحة حتى تحقق بوابة النشر/);
 assert.match(SYSTEM1_HTML,/حالات مستقلة وليس نسبة تقدّم/);
 assert.match(SYSTEM1_HTML,/function liveStripUnavailable\(message\)/);
 assert.match(SYSTEM1_HTML,/lastManualDispatch=\{at:new Date\(\)\.toISOString\(\)/);
 assert.doesNotMatch(SYSTEM1_HTML,/id="liveNextPublish"[^>]*>\d{1,2}:\d{2}/);
});


test('confirmed Cloudflare slot provides next real publishing opportunity, not a fabricated article',async()=>{
 const latest=Date.now()+7*60000;
 const monitor=async()=>({ok:true,status:'scheduler-active-no-fresh-report',
  scheduler:{reachable:true,enabled:true,intervalMinutes:1,controlStatus:'POLICY_VERIFIED'},
  verified:{ledgerAvailable:true,lastHour:{total:0},last24Hours:{total:3}},markets:[],providers:{}});
 const response=await system1AdminSummary({CONTENT_FINAL:{get:async()=>null}},{monitor,
  control:async()=>({enabled:true,intervalMinutes:1,publishingIntervalMinutes:7}),
  publicationGate:async()=>({ok:true,aiV2PublishingIntervalMinutes:7,aiV2Eligible:false,
   aiV2NextEligibleAt:new Date(latest).toISOString()})});
 assert.equal(response.publishing.publicationIntervalMinutes,7);
 assert.equal(response.publishing.intervalVerified,true);
 assert.ok(Date.parse(response.publishing.nextPublicationWindowAt)>=latest-1);
 assert.equal(response.publishing.nextArticleScheduledAt,null);
 assert.equal(response.capabilities.separatePublicationCadence,true);
});

test('daily pulse includes real target, remaining, pace, verified dates and single click start',()=>{
 for(const id of ['dailyPulse','dailyGoalTarget','dailyGoalPublished','dailyGoalRemaining',
  'dailyGoalHour','dailyProgress','dailyProgressFill','dailyGoalStatus','dailyGoalUpdated',
  'startNowFromRibbon'])assert.match(SYSTEM1_HTML,new RegExp('id="'+id+'"'),id);
 assert.match(SYSTEM1_HTML,/function renderDailyPulse\(s\)/);
 assert.match(SYSTEM1_HTML,/dailyGoal\.status|d\.status/);
 assert.match(SYSTEM1_HTML,/await setControl\(\{enabled:true\}\)/);
 assert.match(SYSTEM1_HTML,/await runNow\(true\)/);
 assert.match(SYSTEM1_HTML,/published.*هدف|اتنشر فعلًا اليوم/);
 assert.match(SYSTEM1_HTML,/NO_RECENT_PUBLICATION/);
 assert.match(SYSTEM1_HTML,/BEHIND_TARGET/);
});
test('verified Cairo-day target shows 1440 at one minute, 288 at five, and no invented counts',async()=>{
 const snapshot={ledgerAvailable:true,ageMinutes:5,generatedAt:new Date().toISOString(),
  lastHour:{total:65,SA:30,AE:35},last24Hours:{total:750,SA:360,AE:390},
  todayCairo:{total:800,SA:375,AE:425},cairoDayKey:'2026-11-10',
  cairoDayStartUtc:new Date(Date.now()-7*60*60000).toISOString(),
  lastArticle:{slug:'real-ai',country:'AE',publishedAt:new Date().toISOString()}};
 const monitor=async()=>({ok:true,status:'published-recently',
  scheduler:{reachable:true,enabled:true,intervalMinutes:1,controlStatus:'POLICY_VERIFIED'},
  verified:snapshot,markets:[],providers:{}});
 const env={CONTENT_FINAL:{get:async()=>null}};
 const publicationGate=async()=>({ok:true,aiV2PublishingIntervalMinutes:1,aiV2Eligible:true});
 const result=await system1AdminSummary(env,{monitor,
  control:async()=>({enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),publicationGate});
 assert.equal(result.publishing.dailyGoal.dayTarget,1440);
 assert.equal(result.publishing.dailyGoal.hourTarget,60);
 assert.equal(result.publishing.dailyGoal.todayPublished,800);
 assert.equal(result.publishing.dailyGoal.todayRemaining,640);
 assert.equal(result.publishing.dailyGoal.status,'ON_TARGET');
 assert.equal(result.publishing.dailyGoal.source,'VERIFIED_R2_LEDGER_CAIRO_DAY');
 const slow=await system1AdminSummary(env,{monitor:async()=>({
  ...await monitor(),verified:{...snapshot,lastHour:{total:6},todayCairo:{total:20,SA:10,AE:10}}}),
  control:async()=>({enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),publicationGate});
 assert.equal(slow.publishing.dailyGoal.status,'BEHIND_TARGET');
 assert.equal(slow.publishing.dailyGoal.todayRemaining,1420);
 const unknown=await system1AdminSummary(env,{monitor:async()=>({
  ...await monitor(),verified:{...snapshot,ageMinutes:31}}),
  control:async()=>({enabled:true,intervalMinutes:1,publishingIntervalMinutes:1}),publicationGate});
 assert.equal(unknown.publishing.dailyGoal.todayPublished,null);
 assert.equal(unknown.publishing.dailyGoal.status,'UNVERIFIED');
 const everyFive=await system1AdminSummary(env,{monitor,
  control:async()=>({enabled:true,intervalMinutes:5,publishingIntervalMinutes:5}),
  publicationGate:async()=>({ok:true,aiV2PublishingIntervalMinutes:5,aiV2Eligible:true})});
 assert.equal(everyFive.publishing.dailyGoal.dayTarget,288);
 assert.equal(everyFive.publishing.dailyGoal.hourTarget,12);
});
