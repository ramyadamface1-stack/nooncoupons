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
