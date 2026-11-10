import config from '../automation/ai-v2/config.json' with {type:'json'};
// Live activation remains controlled by the existing Cloudflare runtime secret.
export function decideTick(config,scheduledTime,actualTime){
  const ms=Number(scheduledTime),now=Number(actualTime);
  if(!Number.isFinite(ms)||ms<0||!Number.isFinite(now)||Math.abs(now-ms)>180000)return {due:false,reason:'CLOCK_SKEW'};
  // A bounded ONE-MINUTE preflight dispatch can prove real Cron -> GitHub delivery
  // while the article generator and publishing bridge remain disabled.
  const diag=config.schedulerDiagnostic;
  if(!config.enabled){
    if(diag?.preflightOnly===true&&diag?.maxAcceptedDispatches===1&&
      Number.isFinite(Date.parse(diag.fromUtc))&&Number.isFinite(Date.parse(diag.untilUtc))&&
      Math.floor(ms/60000)*60000>=Date.parse(diag.fromUtc)&&Math.floor(ms/60000)*60000<=Date.parse(diag.untilUtc))
      return {due:true,reason:'DIAGNOSTIC_PREFLIGHT_DUE',preflightOnly:true};
    return {due:false,reason:'SCHEDULER_DISABLED'};
  }
  const interval=Number(config.intervalMinutes),minute=Math.floor(ms/60000);
  if(![...Array.from({length:15},(_,i)=>i+1),30,60].includes(interval))return {due:false,reason:'INVALID_INTERVAL'};
  if(minute%interval!==0)return {due:false,reason:'INTERVAL_NOT_ELAPSED'};
  return {due:true,reason:'DUE'};
}
const ROOT='https://api.github.com/repos/ramyadamface1-stack/nooncoupons/actions/workflows/noondealsnow-ai-v2.yml';
const headers=token=>({
  'Authorization':'Bearer '+token,
  'Accept':'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',
  'User-Agent':'NoonDealsNow-AI-V2-Scheduler'
});
export function githubHttpStatus(status){
  if(status===401)return 'GITHUB_TOKEN_INVALID_OR_EXPIRED';
  if(status===403)return 'GITHUB_TOKEN_FORBIDDEN';
  if(status===404)return 'GITHUB_WORKFLOW_NOT_FOUND_OR_UNAUTHORIZED';
  return 'GITHUB_API_UNAVAILABLE';
}
// The outcome describes ONLY a scheduled dispatch attempt, never publication.
// An injected fetch implementation enables token-free, zero-AI regression tests.
export async function dispatchDue({config:cfg=config,scheduledTime,actualTime=Date.now(),token,fetchFn=fetch,logger=console.log}={}){
  const started=Number(actualTime),scheduled=Number(scheduledTime);
  const decision=decideTick(cfg,scheduled,started);
  let reason=decision.reason,dispatchHttpStatus=null;
  try{
    if(!decision.due)return {dispatched:false,reason};
    if(!token){reason='DISPATCH_TOKEN_MISSING';return {dispatched:false,reason}}
    const requestHeaders=headers(token);
    // Production dispatches every UTC minute, even while the preceding market
    // runners finish. Each GitHub matrix market job now has its own serialized
    // concurrency group; the native R2-backed 30s publication lease remains global.
    // Keep the historical in-progress guard for disabled diagnostic preflights.
    const activeMarketRunners=cfg.enabled===true&&cfg.publicationMode==='live_verified'&&
      cfg.safety?.noAutomaticPublishUntilLiveBridgeVerified===false;
    // Each GitHub concurrency group permits one running and only one pending
    // job. Frequent dispatches can replace pending SA/AE jobs even when
    // cancel-in-progress=false. Cron stays every minute, but dispatches only
    // when the prior production workflow has finished.
    if(activeMarketRunners){
      const response=await fetchFn(ROOT+'/runs?branch=main&event=workflow_dispatch&per_page=12',{headers:requestHeaders});
      if(!response.ok){
        dispatchHttpStatus=response.status;reason=githubHttpStatus(response.status);
        return {dispatched:false,reason,dispatchHttpStatus};
      }
      const data=await response.json();
      if(!Array.isArray(data?.workflow_runs)){
        reason='GITHUB_API_INVALID_RESPONSE';return {dispatched:false,reason};
      }
      if(data.workflow_runs.some(run=>['queued','pending','in_progress','waiting','requested'].includes(run?.status))){
        reason='PUBLISHER_BUSY_SKIP_DISPATCH';return {dispatched:false,reason};
      }
    }
    if(!activeMarketRunners)for(const status of ['in_progress','queued']){
      const response=await fetchFn(ROOT+'/runs?branch=main&event=workflow_dispatch&status='+status+'&per_page=1',{headers:requestHeaders});
      if(!response.ok){
        dispatchHttpStatus=response.status;reason=githubHttpStatus(response.status);
        return {dispatched:false,reason,dispatchHttpStatus};
      }
      const data=await response.json();
      if(!Number.isInteger(data?.total_count)||data.total_count<0){
        reason='GITHUB_API_INVALID_RESPONSE';return {dispatched:false,reason};
      }
      if(data.total_count>0){reason='WORKFLOW_ALREADY_RUNNING';return {dispatched:false,reason}}
    }
    // Diagnostic mode is bounded by one accepted Workflow Dispatch.
    // Check GitHub's actual workflow_dispatch events; never retry after
    // the first received event even if the publishing bridge is offline.
    if(decision.preflightOnly===true){
      const response=await fetchFn(ROOT+'/runs?branch=main&event=workflow_dispatch&per_page=5',{headers:requestHeaders});
      if(!response.ok){dispatchHttpStatus=response.status;reason=githubHttpStatus(response.status);return {dispatched:false,reason,dispatchHttpStatus}}
      const body=await response.json();
      if(!Array.isArray(body?.workflow_runs)){reason='GITHUB_API_INVALID_RESPONSE';return {dispatched:false,reason}}
      const start=Date.parse(cfg.schedulerDiagnostic?.fromUtc||'');
      if(body.workflow_runs.some(run=>run?.event==='workflow_dispatch'&&Date.parse(run.created_at)>=start)){
        reason='DIAGNOSTIC_ALREADY_RECEIVED';return {dispatched:false,reason};
      }
    }
    const response=await fetchFn(ROOT+'/dispatches',{
      method:'POST',
      headers:{...requestHeaders,'content-type':'application/json'},
      body:JSON.stringify({ref:'main',inputs:{preflight_only:(decision.preflightOnly===true||cfg.publicationMode!=='live_verified'||cfg.safety?.noAutomaticPublishUntilLiveBridgeVerified!==false)?'true':'false',scheduled_ms:String(scheduled),verify_gemini_metadata:'false'}})
    });
    dispatchHttpStatus=response.status;
    reason=response.status===204?'DISPATCH_ACCEPTED':githubHttpStatus(response.status);
    return {dispatched:response.status===204,reason,dispatchHttpStatus};
  }catch{
    reason='GITHUB_API_UNAVAILABLE';
    return {dispatched:false,reason};
  }finally{
    logger('AI_V2_SCHEDULER '+JSON.stringify({site:'noondealsnow',reason,scheduledTime:scheduled,dispatchHttpStatus,durationMs:Math.max(0,Date.now()-started)}));
  }
}
// Production activation requires a dedicated secret and independently
// verified live publishing. The checked-in config remains INERT by default.
export function effectiveRuntimeConfig(cfg,env){
  if(env?.AI_V2_RUNTIME_ENABLED!=='true')return cfg;
  if(cfg.enabled!==false||cfg.publicationMode!=='checkpoint_only'||cfg.safety?.keepLegacyCron!==true||
     Number(cfg.intervalMinutes)!==1||cfg.safety?.noAutomaticPublishUntilLiveBridgeVerified!==true)return cfg;
  return {...cfg,enabled:true,publicationMode:'live_verified',
    safety:{...cfg.safety,noAutomaticPublishUntilLiveBridgeVerified:false}};
}
// Site admin's non-secret settings are stored in an existing Durable Object.
// Treat absent/malformed settings as disabled: never dispatch the publisher
// when the operator's latest pause/interval choice cannot be verified.
export async function managedRuntimeConfig(cfg,env,fetchFn=fetch){
  const active=effectiveRuntimeConfig(cfg,env);
  if(!active.enabled)return {...active,controlStatus:'ACTIVATION_NOT_ENABLED'};
  try{
    const res=await fetchFn('https://noondealsnow.com/api/ai-v2-control-policy',{
      headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(6000)});
    if(!res.ok)return {...active,enabled:false,controlStatus:'POLICY_HTTP_'+res.status};
    const policy=await res.json();
    if(policy?.ok!==true||typeof policy.enabled!=='boolean'||
      ![...Array.from({length:15},(_,i)=>i+1),30,60].includes(policy.intervalMinutes))
      return {...active,enabled:false,controlStatus:'POLICY_INVALID'};
    return {...active,enabled:policy.enabled,intervalMinutes:policy.intervalMinutes,controlStatus:'POLICY_VERIFIED'};
  }catch{return {...active,enabled:false,controlStatus:'POLICY_UNAVAILABLE'}}
}
export async function probeProductionCapacity(fetchFn=fetch){
  try{
    const response=await fetchFn('https://noondealsnow.com/api/health',{
      headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(8000)
    });
    if(response.status===429){
      const body=(await response.text()).slice(0,2000);
      return {allowed:false,reason:/\b1027\b|plan limits|temporarily rate limited/i.test(body)
        ?'CLOUDFLARE_1027_DAILY_LIMIT':'SITE_RATE_LIMITED'};
    }
    return {allowed:true,verified:response.ok};
  }catch{return {allowed:true,verified:false}}
}
async function tick(event,env){
  const active=await managedRuntimeConfig(config,env);
  if(active.enabled){
    const capacity=await probeProductionCapacity();
    if(!capacity.allowed){
      console.log('AI_V2_SCHEDULER '+JSON.stringify({site:'noondealsnow',reason:capacity.reason,
        scheduledTime:event?.scheduledTime,dispatched:false}));
      return {dispatched:false,reason:capacity.reason};
    }
  }
  return dispatchDue({config:active,
    scheduledTime:event?.scheduledTime,token:env.GITHUB_DISPATCH_TOKEN});
}

// Only a named Cloudflare Service Binding entrypoint can invoke this helper.
// The public HTTP handler below is read-only /health and exposes NO dispatch API.
// Authorization + origin checks happen in the calling site's Admin Worker.
export async function adminManualDispatch(env,{readConfig=managedRuntimeConfig,
  checkCapacity=probeProductionCapacity,send=dispatchDue,clock=Date.now}={}){
  const active=await readConfig(config,env);
  if(active.controlStatus!=='POLICY_VERIFIED')
    return {ok:false,dispatched:false,reason:'SCHEDULER_POLICY_UNVERIFIED',
      controlStatus:active.controlStatus||'UNKNOWN'};
  if(!active.enabled)return {ok:false,dispatched:false,reason:'SCHEDULER_PAUSED'};
  if(!env?.GITHUB_DISPATCH_TOKEN)return {ok:false,dispatched:false,reason:'DISPATCH_SECRET_MISSING'};
  const capacity=await checkCapacity();
  if(!capacity.allowed)return {ok:false,dispatched:false,reason:capacity.reason||'PRODUCTION_UNAVAILABLE'};
  const now=Number(clock());
  // The operator is asking for a one-off attempt, not for an interval tick.
  // Keep the REAL schedule unchanged and bypass only the minute-modulo check.
  const result=await send({config:{...active,intervalMinutes:1},scheduledTime:now,
    actualTime:now,token:env.GITHUB_DISPATCH_TOKEN,logger:()=>{}});
  return {ok:result.dispatched===true,dispatched:result.dispatched===true,
    reason:result.reason||'DISPATCH_FAILED',dispatchHttpStatus:result.dispatchHttpStatus??null,
    acceptedRunNotPublication:true};
}
export default {
  scheduled(event,env,ctx){ctx.waitUntil(tick(event,env))},
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path!=='/health')return new Response('Not Found',{status:404});
    const active=await managedRuntimeConfig(config,env);
    return Response.json({ok:true,site:'noondealsnow',schedulerEnabled:active.enabled,
      intervalMinutes:active.intervalMinutes,source:'admin-do-policy-plus-explicit-runtime-secret',
      controlStatus:active.controlStatus,
      dispatchPolicy:'one-cron-tick-per-minute-parallel-markets-global-atomic-publish',
      globalPublicationSpacingSeconds:30,
      legacyPublisherUntouched:true,noActiveDispatchUntilEnabled:!active.enabled,
      publicationBridgeVerified:active.enabled,freeOnly:true,verifiedMarkets:['SA','AE'],
      diagnosticWindow:config.schedulerDiagnostic?{from:config.schedulerDiagnostic.fromUtc,until:config.schedulerDiagnostic.untilUtc}:null,
      diagnosticPreflightOnly:!active.enabled});
  }
};
