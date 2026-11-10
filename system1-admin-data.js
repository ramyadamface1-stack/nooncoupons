// SYSTEM1 V3 — authenticated, bounded, read-only control-plane summary.
// No generation dispatch and no large R2 corpus scans in the web request.
import {aiV2AdminMonitor} from './ai-v2-admin-monitor.js';
import {getAiV2Control} from './admin-runtime.js';
import {getPublicationSlotStatus} from './publication-rate-limit.js';

const KEYWORDS='_ops/system1/keyword-opportunities-v1.json';
const STOCKPILE='_ops/system1/stockpile-summary-v1.json';
const VISUALS='_ops/system1/visual-quality-summary-v1.json';
function safeError(e){return String(e?.message||e||'unknown').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,70)}
async function readSmall(env,key,maxBytes=180000){
  if(!env?.CONTENT_FINAL?.get)return {available:false,reason:'R2_NOT_BOUND'};
  try{
    const obj=await env.CONTENT_FINAL.get(key);
    if(!obj)return {available:false,reason:'NOT_YET_PRODUCED'};
    if(Number(obj.size)>maxBytes)return {available:false,reason:'SNAPSHOT_TOO_LARGE'};
    const raw=await obj.text();
    if(raw.length>maxBytes)return {available:false,reason:'SNAPSHOT_TOO_LARGE'};
    return {available:true,data:JSON.parse(raw)};
  }catch{return {available:false,reason:'SNAPSHOT_READ_UNAVAILABLE'}}
}
export async function readSystem1Keywords(env,{market='ALL',q='',limit=60}={}){
  if(!['ALL','SA','AE'].includes(market)||typeof q!=='string'||q.length>120||
     !Number.isInteger(limit)||limit<1||limit>100)return {ok:false,error:'invalid_filters'};
  const source=await readSmall(env,KEYWORDS);
  if(!source.available)return {ok:true,available:false,reason:source.reason,items:[],total:null};
  const data=source.data;
  if(data?.version!==1||!Array.isArray(data?.items)||data.items.length>1200)
    return {ok:true,available:false,reason:'INVALID_INDEX',items:[],total:null};
  const needle=q.trim().toLocaleLowerCase();
  const matches=data.items.filter(x=>x&&['SA','AE'].includes(x.country)&&
     (market==='ALL'||market===x.country)&&
     (!needle||[x.keyword,x.brand,x.category,x.product,x.slug].join(' ').toLocaleLowerCase().includes(needle)));
  return {ok:true,available:true,source:'curated_existing_repository_queue',generatedAt:data.generatedAt,
    total:data.total??data.items.length,matched:matches.length,items:matches.slice(0,limit),
    seoDemandMeasured:false,mutableQueue:false,
    note:'هذه أفكار من طابور GitHub الموجود بالفعل، وليست كلمات جديدة أو عدد مهام تنتظر التنفيذ'};
}
export function nextGenerationWindowAt(atMs,minutes){
  if(!Number.isFinite(atMs)||![...Array.from({length:15},(_,i)=>i+1),30,60].includes(minutes))return null;
  const gap=minutes*60000;
  return new Date((Math.floor(atMs/gap)+1)*gap).toISOString();
}
function snapshotView(raw,name){
  if(!raw.available)return {available:false,reason:raw.reason};
  const s=raw.data;
  if(s?.version!==1||s?.site!=='noondealsnow'||typeof s.generatedAt!=='string')
    return {available:false,reason:'INVALID_'+name.toUpperCase()+'_SNAPSHOT'};
  return {available:true,...s};
}
export function nextPublicationOpportunityAt(atMs,generationMinutes,nextAiEligibleAt){
 if(!Number.isFinite(atMs)||![...Array.from({length:15},(_,i)=>i+1),30,60].includes(generationMinutes))return null;
 const gateMs=Date.parse(nextAiEligibleAt||'');
 if(nextAiEligibleAt&&(!Number.isFinite(gateMs)||gateMs<0))return null;
 // Earliest possible generation attempt on/after the publication permit.
 // This is a WINDOW, never an article's scheduled_at or guaranteed publication.
 return nextGenerationWindowAt(Math.max(atMs,Number.isFinite(gateMs)?gateMs-1:atMs),generationMinutes);
}
export async function system1AdminSummary(env,{monitor=aiV2AdminMonitor,control=getAiV2Control,
 publicationGate=getPublicationSlotStatus}={}){
  const items=await Promise.allSettled([
    monitor(env),control(env),readSmall(env,STOCKPILE),readSmall(env,VISUALS),publicationGate(env)
  ]);
  const item=i=>items[i].status==='fulfilled'?items[i].value:null;
  const mon=item(0),cfg=item(1),stock=snapshotView(item(2)||{available:false,reason:'STOCKPILE_READ_FAILED'},'stockpile'),
    visuals=snapshotView(item(3)||{available:false,reason:'VISUALS_READ_FAILED'},'visuals');
  const verified=mon?.verified?.ledgerAvailable===true?mon.verified:{ledgerAvailable:false,reason:mon?.verified?.reason||'VERIFIED_LEDGER_UNAVAILABLE'};
  const gate=item(4);
  const requestedMinutes=Number.isInteger(cfg?.publishingIntervalMinutes)&&
    cfg.publishingIntervalMinutes>=1&&cfg.publishingIntervalMinutes<=15?cfg.publishingIntervalMinutes:1;
  const publishingGateVerified=gate?.ok===true&&
    gate.aiV2PublishingIntervalMinutes===requestedMinutes&&
    typeof gate.aiV2Eligible==='boolean';
  const enable=cfg?.enabled===true;
  const scheduler=mon?.scheduler||{reachable:false};
  const generation=!cfg?'UNKNOWN':
    !enable?'PAUSED_MANUALLY':
    !mon?.ok?'ERROR':
    !scheduler.reachable?'ERROR':
    !scheduler.enabled?'DISABLED':
    mon.status==='quota-wait'?'PAUSED_QUOTA_EXHAUSTED':
    mon.status==='queue-no-eligible-topics'?'WAITING_ELIGIBLE_TOPIC':
    mon.status==='scheduler-active-no-fresh-report'?'WAITING_TELEMETRY':
    'SCHEDULER_ACTIVE_UNVERIFIED';
  // Publishing is a different state: the verified ledger is the source of truth.
  // Scheduler activation alone must never be called publication success.
  const publicationIntervalMinutes=publishingGateVerified?requestedMinutes:null;
  // Generator writes accepted articles directly, with a saved minimum gap.
  // Do not invent queued READY articles or future guaranteed publications.
  const nextPublicationWindowAt=publishingGateVerified&&enable&&
    scheduler?.reachable===true&&scheduler?.enabled===true?
    nextPublicationOpportunityAt(Date.now(),scheduler.intervalMinutes,gate.aiV2NextEligibleAt):null;
  const hourTarget=60/requestedMinutes,dayTarget=Math.ceil(1440/requestedMinutes);
  const snapshotAge=Number(verified?.ageMinutes);
  const verifiedFresh=verified.ledgerAvailable===true&&Number.isFinite(snapshotAge)&&
    snapshotAge>=0&&snapshotAge<=30;
  const cairoToday=verifiedFresh&&Number.isSafeInteger(verified?.todayCairo?.total)?
    verified.todayCairo:null;
  const todayPublished=cairoToday?cairoToday.total:null;
  const todayRemaining=todayPublished===null?null:Math.max(0,dayTarget-todayPublished);
  const startMs=Date.parse(verified?.cairoDayStartUtc||'');
  const elapsedMin=Number.isFinite(startMs)?
    Math.max(0,Math.min(1440,(Date.now()-startMs)/60000)):null;
  const expectedByNow=elapsedMin===null?null:Math.min(dayTarget,Math.floor(elapsedMin/requestedMinutes));
  const lastPublishedMs=Date.parse(verified?.lastArticle?.publishedAt||'');
  const noRecentPublication=verifiedFresh&&Number.isFinite(lastPublishedMs)&&
    Date.now()-lastPublishedMs>20*60000;
  const underTarget=verifiedFresh&&Number.isSafeInteger(verified?.lastHour?.total)&&
    verified.lastHour.total<hourTarget;
  const liveTargetStatus=!enable||scheduler?.enabled===false?'STOPPED':
    !scheduler?.reachable?'SCHEDULER_UNVERIFIED':
    !verifiedFresh||!cairoToday?'UNVERIFIED':
    noRecentPublication?'NO_RECENT_PUBLICATION':
    underTarget||todayPublished<expectedByNow?'BEHIND_TARGET':'ON_TARGET';
  const verifiedMarketTotals=verified?.last24Hours&&Number.isSafeInteger(verified.last24Hours.SA)&&Number.isSafeInteger(verified.last24Hours.AE)?
    {SA:verified.last24Hours.SA,AE:verified.last24Hours.AE}:null;
  const effectiveInterval=scheduler?.enabled&&enable&&[...Array.from({length:15},(_,i)=>i+1),30,60].includes(scheduler.intervalMinutes)?scheduler.intervalMinutes:null;
  const nextGenerationCheckAt=effectiveInterval?nextGenerationWindowAt(Date.now(),effectiveInterval):null;
  const publishing=verified?.lastHour?.total>0?'RECENT_VERIFIED':
    verified.ledgerAvailable?'NO_VERIFIED_PUBLICATION_LAST_HOUR':'UNVERIFIED';
  return {ok:true,version:3,site:'noondealsnow',checkedAt:new Date().toISOString(),timezone:'Africa/Cairo',
    markets:{SA:{language:'ar-SA',coupon:'NOV170'},AE:{language:'en-AE',coupon:'NOV188'}},
    generation:{status:generation,desiredEnabled:cfg?.enabled??null,dispatchIntervalMinutes:cfg?.intervalMinutes??null,
      actualScheduler:scheduler,marketReports:mon?.markets||null,lastSelected:mon?.latestSelected||null,
      lastReportAt:mon?.lastReportAt||null,
      draftsGeneratedLast24Hours:null,generatedCounterReason:'NO_INDEPENDENT_DRAFT_LEDGER',
      nextGenerationCheckAt, nextGenerationCheckNote:'COMPUTED_CRON_WINDOW_NOT_CONFIRMED_JOB'},
    publishing:{status:publishing,verified,publicationIntervalMinutes,verifiedMarketTotals,
      dailyGoal:{hourTarget,dayTarget,todayPublished,todayRemaining,
        expectedByNow,progressPercent:todayPublished===null?null:
         Math.min(100,Math.round(todayPublished/dayTarget*100)),
        status:liveTargetStatus,asOf:verifiedFresh?verified.generatedAt:null,
        lastHourVerified:verifiedFresh?verified.lastHour?.total:null,
        dayKeyCairo:cairoToday?verified.cairoDayKey:null,
        publishedSA:cairoToday?cairoToday.SA:null,
        publishedAE:cairoToday?cairoToday.AE:null,
        source:'VERIFIED_R2_LEDGER_CAIRO_DAY',
        complete:false,
        note:'الهدف 60 مقالة/ساعة عند فاصل دقيقة، وليس ضمانًا. الأرقام تتحدث حسب أحدث جرد موثق في R2 كل 15 دقيقة.'},
      desiredIntervalMinutes:requestedMinutes,intervalVerified:publishingGateVerified,
      nextPublicationWindowAt,permitNextEligibleAt:publishingGateVerified?gate.aiV2NextEligibleAt:null,
      permitEligibleNow:publishingGateVerified?gate.aiV2Eligible:null,
      nextArticleScheduledAt:null,nextArticleStatus:'NO_READY_ARTICLE_SCHEDULED',
      explanation:'نافذة النشر المستهدفة هي أول فرصة مسموحة لنشر مقال جاهز. لا يوجد موعد scheduled_at لمقال بعينه، ولا ضمان نشر دون جودة ومخزون مؤهل'},
    providers:mon?.providers||{gemini:null,groq:null},
    keywords:{available:null,source:'curated_existing_repository_queue',
      total:null,snapshotAt:null,onDemandEndpoint:'/api/admin/system1/keywords',
      measuredSearchVolume:false,runnerQueueIsSeparate:true},
    stockpile:stock,visualQuality:visuals,
    capabilities:{
      liveGenerationControl:true,manualGitHubDispatch:true,keyBulkImport:true,perKeyQuotaCircuit:true,
      keywordDiscoveryFromGsc:false,keywordApprovalsToRunner:false,
      separatedReadyStockpile:false,separatePublicationCadence:true,
      fiveStoredValidatedVisuals:false,liveProviderKeyVerification:false
    },
    limits:{freeTierOnly:true,runWhenBrowserClosed:true,
      note:'خدمة GitHub Actions / Cloudflare تقوم بالتشغيل الخلفي؛ لا تعتمد على فتح المتصفح. النشر الفعلي يعتمد على وجود محتوى مؤهل.'},
    warnings:[
      ...(!mon?.ok?['MONITOR_UNAVAILABLE']:[]),
      ...(generation==='WAITING_ELIGIBLE_TOPIC'?['NO_ELIGIBLE_TOPIC_IN_LAST_SCAN']:[]),
      ...(!publishingGateVerified?['PUBLISHING_CADENCE_NOT_VERIFIED']:[]),
      ...(!stock.available?['READY_STOCKPILE_NOT_MEASURED']:[]),
      ...(!visuals.available?['FIVE_VISUALS_NOT_VERIFIED']:[])
    ]
  };
}
