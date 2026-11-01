import config from '../automation/ai-v2/config.json' with {type:'json'};
export function decideTick(config,scheduledTime,actualTime){
  const ms=Number(scheduledTime),now=Number(actualTime);
  if(!Number.isFinite(ms)||ms<0||!Number.isFinite(now)||Math.abs(now-ms)>180000)return {due:false,reason:'CLOCK_SKEW'};
  // A bounded ONE-MINUTE preflight dispatch can prove real Cron -> GitHub delivery
  // while the article generator and publishing bridge remain disabled.
  const diag=config.schedulerDiagnostic;
  if(!config.enabled){
    if(diag?.preflightOnly===true&&diag?.maxAcceptedDispatches===1&&
      Number.isFinite(Date.parse(diag.fromUtc))&&Number.isFinite(Date.parse(diag.untilUtc))&&
      ms>=Date.parse(diag.fromUtc)&&ms<=Date.parse(diag.untilUtc)&&ms%60000===0)
      return {due:true,reason:'DIAGNOSTIC_PREFLIGHT_DUE',preflightOnly:true};
    return {due:false,reason:'SCHEDULER_DISABLED'};
  }
  const interval=Number(config.intervalMinutes),minute=Math.floor(ms/60000);
  if(![1,5,10,15,30,60].includes(interval))return {due:false,reason:'INVALID_INTERVAL'};
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
    // Explicitly serialize per-site Jobs in addition to GitHub concurrency.
    for(const status of ['in_progress','queued']){
      const response=await fetchFn(ROOT+'/runs?branch=main&status='+status+'&per_page=1',{headers:requestHeaders});
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
async function tick(event,env){
  return dispatchDue({scheduledTime:event?.scheduledTime,token:env.GITHUB_DISPATCH_TOKEN});
}

export default {
  scheduled(event,env,ctx){ctx.waitUntil(tick(event,env))},
  fetch(request){
    const path=new URL(request.url).pathname;
    if(path!=='/health')return new Response('Not Found',{status:404});
    return Response.json({ok:true,site:'noondealsnow',schedulerEnabled:config.enabled,intervalMinutes:config.intervalMinutes,source:'single-ai-v2-config',legacyPublisherUntouched:true,noActiveDispatchUntilEnabled:true,publicationBridgeVerified:false,diagnosticWindow:config.schedulerDiagnostic?{from:config.schedulerDiagnostic.fromUtc,until:config.schedulerDiagnostic.untilUtc}:null,diagnosticPreflightOnly:true});
  }
};
