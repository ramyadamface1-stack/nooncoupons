// One global publication permit per 30-second rolling interval (100/hour capacity), shared by
// Arabic/English generation, cron, manual publishing and scheduled articles.
// Fail closed if Durable Objects cannot confirm the allowance.
export const GLOBAL_PUBLICATION_SPACING_MS=30000;
export const GLOBAL_PUBLICATION_MAX_PER_MINUTE=2;
export const GLOBAL_PUBLICATION_POLICY='one-article-every-30-seconds-global-v3';
async function callPublicationGate(env,method,source,market){
  if(!env?.GENERATOR_CONTROL)return {ok:false,error:'publication_control_missing',throttled:true};
  try{
    const id=env.GENERATOR_CONTROL.idFromName('primary');
    const response=await env.GENERATOR_CONTROL.get(id).fetch('https://generator.internal/publication-slot',{
      method,
      ...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify({source:String(source||'unknown').slice(0,70),market:String(market||'SA').slice(0,8)})}:{})
    });
    let data={};try{data=await response.json()}catch{}
    if(response.status===429)return {...data,ok:false,throttled:true,confirmedNoWrite:method==='POST'};
    if(!response.ok||data.ok!==true)return {ok:false,throttled:true,error:data.error||'publication_control_failed'};
    return data;
  }catch(e){return {ok:false,throttled:true,error:'publication_control_unavailable',detail:String(e?.message||e).slice(0,100)}}
}
export async function claimPublicationSlot(env,market,source){return callPublicationGate(env,'POST',source,market)}
// AI V2 reads its own stronger publication window; legacy generators retain
// their original 30-second global gate and are unaffected by site admin cadence.
export async function getPublicationSlotStatus(env,{aiV2=false}={}){
  const status=await callPublicationGate(env,'GET','','');
  if(!aiV2||!status.ok)return status;
  if(typeof status.aiV2Eligible!=='boolean')return {ok:false,error:'ai_v2_publication_policy_unavailable',throttled:true};
  return {...status,eligible:status.aiV2Eligible,
    nextEligibleAt:status.aiV2NextEligibleAt,retryAfterMs:status.aiV2RetryAfterMs};
}
