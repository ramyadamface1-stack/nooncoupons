// Only retry a *confirmed* native HTTP 409 with an explicit global DO
// publication permit timestamp (up to 70 seconds for 1-minute cadence). Other 409s, HTTP uncertainties and network
// timeouts never authorize another publish POST.
export function confirmedSlotRetryDelay({httpStatus,reason,nextEligibleAt}={},nowMs=Date.now()){
  if(httpStatus!==409||reason!=='GLOBAL_PUBLICATION_SLOT_NOT_DUE')return null;
  const due=Date.parse(String(nextEligibleAt||''));
  if(!Number.isFinite(due))return null;
  const wait=Math.max(0,Math.ceil(due-nowMs+300));
  return wait<=70000?wait:null;
}

// A competing market can win the next DO minute while the other runner waits.
// Retry at most three additional times ONLY after an acknowledged no-write
// HTTP 409 with the exact nextEligibleAt. This never calls Gemini/Groq and
// never retries an ambiguous native POST (5xx/network timeout).
export const MAX_CONFIRMED_DO_SLOT_RETRIES=3;
export async function retryConfirmedNoWriteSlot({initial,send,checkpointReady,checkpointSent,
  pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now}={}){
 if(!initial||typeof send!=='function'||typeof checkpointReady!=='function'||
    typeof checkpointSent!=='function'||typeof pause!=='function'||typeof now!=='function')
   throw Error('CONFIRMED_SLOT_RETRY_CONTRACT_INVALID');
 let {response,payload}=initial,retries=0;
 for(;retries<MAX_CONFIRMED_DO_SLOT_RETRIES;retries++){
  const waitMs=confirmedSlotRetryDelay({httpStatus:response?.status,
    reason:payload?.reason,nextEligibleAt:payload?.nextEligibleAt},Number(now()));
  if(waitMs===null)break;
  // Persist non-billed PREPARED state BEFORE any wait; a crash cannot
  // re-send an unknown request. Persist the request boundary BEFORE POST.
  await checkpointReady({nextEligibleAt:payload.nextEligibleAt,waitMs,attempt:retries+1});
  if(waitMs>0)await pause(waitMs);
  await checkpointSent({attempt:retries+1});
  ({response,payload}=await send());
 }
 return {response,payload,retries};
}
