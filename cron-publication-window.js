// A Cloudflare "* * * * *" trigger can arrive BEFORE the previous
// publication slot's rolling 60 second window expires. Do not discard the
// entire minute for clock skew; wait a bounded interval, re-read the SAME
// atomic global Durable Object permit, and NEVER bypass the permit in
// publication-rate-limit.js. This only improves retries, it cannot conjure
// quality-passing content or guarantee 60 articles/hour.
export const PUBLICATION_CRON_MAX_WAIT_MS=54000;
export const PUBLICATION_CRON_MARGIN_MS=150;
export function plannedPublicationWait(slot,{maxWaitMs=PUBLICATION_CRON_MAX_WAIT_MS,marginMs=PUBLICATION_CRON_MARGIN_MS,nowMs=Date.now()}={}){
  if(!slot?.ok)return {ok:false,reason:'global_publication_gate_unavailable'};
  if(slot.eligible===true)return {ok:true,waitMs:0};
  const retry=Number(slot.retryAfterMs);
  const due=Date.parse(String(slot.nextEligibleAt||''));
  const residual=Number.isFinite(retry)&&retry>0?retry:Number.isFinite(due)?Math.max(0,due-nowMs):NaN;
  if(!Number.isFinite(residual)||residual<0)return {ok:false,reason:'global_publication_wait_unknown'};
  const waitMs=Math.ceil(residual+marginMs);
  if(waitMs>maxWaitMs)return {ok:false,reason:'wait_exceeds_cron_safe_window',retryAfterMs:retry,nextEligibleAt:slot.nextEligibleAt};
  return {ok:true,waitMs};
}
export async function awaitPublicationWindow(getStatus,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),maxWaitMs=PUBLICATION_CRON_MAX_WAIT_MS,marginMs=PUBLICATION_CRON_MARGIN_MS}={}){
  const first=await getStatus();
  const plan=plannedPublicationWait(first,{maxWaitMs,marginMs});
  if(!plan.ok)return plan;
  if(plan.waitMs===0)return {ok:true,waitMs:0};
  await sleep(plan.waitMs);
  const verified=await getStatus();
  if(!verified?.ok||verified.eligible!==true)return {ok:false,reason:'publication_gate_still_busy_after_wait',nextEligibleAt:verified?.nextEligibleAt||first.nextEligibleAt};
  return {ok:true,waitMs:plan.waitMs};
}
