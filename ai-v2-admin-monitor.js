// Read-only AI V2 operator view. Everything is redacted runtime telemetry
// from PRIVATE R2 + the separately deployed scheduler + verified publication
// ledger. "Scheduled" or "GitHub success" NEVER equals a published article.
// Production Worker has a small CPU budget. Do NOT parse the full historic
// publication ledger on every admin refresh; read only the compact, periodically
// generated verification summary. A missing summary is UNKNOWN, never zero.
const SCHEDULER='https://noondealsnow-ai-scheduler-v2.ndn-e4c35f8a50.workers.dev/health';

async function fromR2(env,market){
 try{
   const obj=await env.CONTENT_FINAL?.get('_ops/ai-v2-runtime-'+market+'.json');
   if(!obj)return null;
   const raw=await obj.json();
   return raw?.version===1&&raw?.market===market&&raw?.keyMaterialIncluded===false?raw:null;
 }catch{return null}
}
const VERIFIED_SUMMARY='_ops/ai-v2-verified-summary-v1.json';
async function verifiedSnapshot(env){
 try{
   const obj=await env.CONTENT_FINAL?.get(VERIFIED_SUMMARY);
   if(!obj)return {available:false,reason:'SUMMARY_NOT_YET_WRITTEN'};
   const s=await obj.json();
   const one=s?.windows?.['1h'],day=s?.windows?.['24h'];
   if(s?.version!==1||!Number.isFinite(Date.parse(s.generatedAt||''))||
      !Number.isSafeInteger(one?.total)||!Number.isSafeInteger(day?.total)||
      one.total<0||day.total<0)return {available:false,reason:'SUMMARY_INVALID'};
   return {available:true,generatedAt:s.generatedAt,lastHour:one,last24Hours:day,
     lastArticle:s.lastArticle||null,
     ageMinutes:Math.max(0,Math.round((Date.now()-Date.parse(s.generatedAt))/60000))};
 }catch{return {available:false,reason:'SUMMARY_READ_UNAVAILABLE'}}
}
async function schedulerHealth(request){
 try{
   const response=await request(SCHEDULER,{headers:{'cache-control':'no-store'},signal:AbortSignal.timeout(6000)});
   if(!response.ok)return {reachable:false,http:response.status};
   const s=await response.json();
   return {reachable:true,enabled:s.schedulerEnabled===true,intervalMinutes:Number(s.intervalMinutes)||null,
     controlStatus:s.controlStatus||null,globalPublicationSpacingSeconds:s.globalPublicationSpacingSeconds||null,
     dispatchPolicy:s.dispatchPolicy||null};
 }catch{return {reachable:false,http:null}}
}
export async function aiV2AdminMonitor(env,fetchFn=fetch){
 const [sa,ae,scheduler,verified]=await Promise.all([
   fromR2(env,'SA'),fromR2(env,'AE'),schedulerHealth(fetchFn),verifiedSnapshot(env)
 ]);
 const markets={SA:sa,AE:ae},freshest=[sa,ae].filter(Boolean)
   .sort((a,b)=>Date.parse(b.generatedAt||'')-Date.parse(a.generatedAt||''))[0]||null;
 const statuses=['SA','AE'].map(m=>markets[m]?{market:m,lastOutcome:markets[m].lastOutcome,
   generatedAt:markets[m].generatedAt,selected:markets[m].selected}:{
   market:m,lastOutcome:null,generatedAt:null,selected:null
 });
 const providerGroups={};
 for(const name of ['gemini','groq']){
   const values=[sa,ae].filter(x=>x?.providers?.[name]);
   const chosen=values.sort((x,y)=>Date.parse(y.generatedAt)-Date.parse(x.generatedAt))[0]||null;
   providerGroups[name]=chosen?.providers?.[name]||null;
 }
 const providerValues=Object.values(providerGroups).filter(Boolean);
 const totals=providerValues.reduce((n,x)=>n+Math.max(0,Number(x.total||0)),0);
 const quotaWaiting=providerValues.reduce((n,x)=>n+Math.max(0,Number(x.counts?.quotaWait||0)),0);
 const otherWaiting=providerValues.reduce((n,x)=>n+Math.max(0,Number(x.counts?.providerWait||0)),0);
 const unknown=providerValues.reduce((n,x)=>n+Math.max(0,Number(x.counts?.unverified||0))+
   Math.max(0,Number(x.counts?.notInspected||0))+Math.max(0,Number(x.counts?.eligibleUnverified||0)),0);
 const allWaitingQuota=totals>0&&quotaWaiting===totals&&unknown===0&&otherWaiting===0;
 const latestAt=Date.parse(freshest?.generatedAt||'');
 const telemetryFresh=Number.isFinite(latestAt)&&Date.now()-latestAt<15*60000;
 const status=scheduler.reachable===false?'scheduler-unreachable':
   scheduler.enabled===false?'paused':
   allWaitingQuota?'quota-wait':
   !freshest||!telemetryFresh?'scheduler-active-no-fresh-report':
   ['PAUSED_QUOTA','QUOTA_EXHAUSTED'].includes(freshest?.lastOutcome?.reason)?'quota-wait':
   freshest?.lastOutcome?.reason==='QUEUE_WINDOW_EMPTY'?'queue-no-eligible-topics':
   freshest?.lastOutcome?.status==='LIVE_VERIFIED'?'published-recently':
   'scheduler-active-no-verified-publication';
 return {ok:true,source:'redacted-github-run-r2-and-live-scheduler',
   checkedAt:new Date().toISOString(),status,
   scheduler,markets:statuses,providers:providerGroups,
   latestSelected:freshest?.selected||null,
   lastReportAt:freshest?.generatedAt||null,
   verified:{ledgerAvailable:verified.available===true,lastHour:verified.lastHour||null,
     last24Hours:verified.last24Hours||null,lastArticle:verified.lastArticle||null,
     generatedAt:verified.generatedAt||null,ageMinutes:verified.ageMinutes??null,
     reason:verified.available?null:verified.reason},
   safety:{rawKeysExposed:false,configuredDoesNotMeanValidated:true,
     unknownIsNotAvailable:true,githubRunSuccessIsNotPublished:true,
     quotaStatusMayBeUpToFiveMinutesOld:true,telemetryFresh,
     schedulerRunningDoesNotProveProviderCalled:true,
     verifiedMetricsUnrecognizedWhenSnapshotMissing:true}};
}
