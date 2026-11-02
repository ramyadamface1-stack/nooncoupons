// Fail closed on unfinished market rendering. Never create a paid provider
// request for a country whose native publish-quality renderer is not ready.
export const READY_NATIVE_RENDERERS=Object.freeze(['AE','SA']);
export function publicationReadyTopic(topic,markets=READY_NATIVE_RENDERERS){
 return Boolean(topic&&markets.includes(topic.country)&&Array.isArray(topic.sections)&&topic.sections.length===5&&
  typeof topic.slug==='string'&&/^[a-z0-9-]{16,120}$/.test(topic.slug));
}
export function resumableCheckpoint(checkpoint,{savedOnly=false,manualGroqResume=false,manualIncompleteRetry=false,nativeGateRepair=false}={}){
 const state=checkpoint?.state;
 if(!checkpoint)return true;
 if(['LIVE_VERIFIED','QUALITY_PASSED','COMMITTED','FAILED_FINAL'].includes(state))return false;
 if(state==='PAUSED_QUOTA')return manualGroqResume;
 if(state==='BLOCKED_REVIEW')
  return (manualIncompleteRetry&&manualGroqResume&&checkpoint.errorCategory==='INCOMPLETE_RESPONSE')||
   (savedOnly&&['WORD_WINDOW',...(nativeGateRepair?['NATIVE_QUALITY_BLOCKED']:[])].includes(checkpoint.errorCategory)&&checkpoint.sections?.length===checkpoint.sectionIndex&&checkpoint.sectionIndex===5);
 if(state==='UNKNOWN_REQUEST_OUTCOME')return false;
 // Both ambiguous write and acknowledged stored states must be rechecked
 // through the live URL, never re-sent blindly.
 return true;
}
export function queueInventory(topics){
 return {total:topics.length,renderable:topics.filter(t=>publicationReadyTopic(t)).length,
  pendingMarketRenderer:topics.filter(t=>!publicationReadyTopic(t)).map(t=>t.country)};
}

/** Durable cursor scan with bounded R2 reads per invocation. The first new
 * cycle starts after the previous 20 legacy topics, but wraps around safely. */
export const QUEUE_SCAN_LIMIT=8;
export function queueScanWindow(total,cursor,limit=QUEUE_SCAN_LIMIT){
 if(!Number.isInteger(total)||total<1)return [];
 if(!Number.isInteger(limit)||limit<1||limit>24)throw Error('INVALID_QUEUE_SCAN_LIMIT');
 const start=Number.isSafeInteger(cursor)&&cursor>=0?cursor%total:Math.min(20,total-1);
 return Array.from({length:Math.min(total,limit)},(_,i)=>(start+i)%total);
}
export function nextQueueCursor(total,lastChecked){
 if(!Number.isInteger(total)||total<1||!Number.isSafeInteger(lastChecked)||lastChecked<0||lastChecked>=total)
  throw Error('INVALID_QUEUE_CURSOR');
 return (lastChecked+1)%total;
}
