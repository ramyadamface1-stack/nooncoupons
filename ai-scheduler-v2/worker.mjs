import config from '../automation/ai-v2/config.json' with {type:'json'};
export function decideTick(config,scheduledTime,actualTime){
  const ms=Number(scheduledTime),now=Number(actualTime);
  if(!Number.isFinite(ms)||ms<0||!Number.isFinite(now)||Math.abs(now-ms)>180000)return {due:false,reason:'CLOCK_SKEW'};
  if(!config.enabled)return {due:false,reason:'SCHEDULER_DISABLED'};
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
async function tick(event,env){
  const scheduled=Number(event?.scheduledTime),started=Date.now(),decision=decideTick(config,scheduled,started);
  let result=decision.reason,dispatchStatus=null;
  try{
    if(!decision.due)return;
    if(!env.GITHUB_DISPATCH_TOKEN){result='DISPATCH_TOKEN_MISSING';return}
    const token=env.GITHUB_DISPATCH_TOKEN;
    // Avoid dispatching a second generation workflow while one is active.
    for(const state of ['in_progress','queued']){
      const url=ROOT+'/runs?branch=main&status='+state+'&per_page=1';
      const check=await fetch(url,{headers:headers(token)});
      if(!check.ok){result='GITHUB_API_UNAVAILABLE';dispatchStatus=check.status;return}
      const data=await check.json();
      if(Number(data.total_count||0)>0){result='WORKFLOW_ALREADY_RUNNING';return}
    }
    const response=await fetch(ROOT+'/dispatches',{
      method:'POST',headers:{...headers(token),'content-type':'application/json'},
      body:JSON.stringify({ref:'main',inputs:{preflight_only:'false',scheduled_ms:String(scheduled)}})
    });
    dispatchStatus=response.status;
    result=response.status===204?'DISPATCH_ACCEPTED':'DISPATCH_REJECTED';
  }catch{result='GITHUB_API_UNAVAILABLE'}
  finally{console.log('AI_V2_SCHEDULER '+JSON.stringify({site:'noondealsnow',result,scheduledTime:scheduled,dispatchStatus,durationMs:Date.now()-started}))}
}
export default {
  scheduled(event,env,ctx){ctx.waitUntil(tick(event,env))},
  fetch(request){
    const path=new URL(request.url).pathname;
    if(path!=='/health')return new Response('Not Found',{status:404});
    return Response.json({ok:true,site:'noondealsnow',schedulerEnabled:config.enabled,intervalMinutes:config.intervalMinutes,source:'single-ai-v2-config',legacyPublisherUntouched:true,noActiveDispatchUntilEnabled:true});
  }
};
