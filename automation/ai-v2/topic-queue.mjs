// Exactly one zero-provider editorial rescue for known repaired Saudi gates.
// Fail closed on unrecognized native diagnostics or malformed checkpoints.
export const SA_SAFE_RECOVERY_REVISION='sa-title-and-depth-v1';
export function safeSaudiDeterministicRecovery(checkpoint,topic){
 if(topic?.country!=='SA'||checkpoint?.state!=='BLOCKED_REVIEW'||
    checkpoint?.deterministicRecoveryRevision===SA_SAFE_RECOVERY_REVISION||
    checkpoint?.sectionIndex!==5||checkpoint?.sections?.length!==5||
    !checkpoint.sections.every(x=>typeof x?.html==='string'&&x.html.length>0))return false;
 if(checkpoint.errorCategory==='WORD_WINDOW'){
   const preview=checkpoint.qualityPreview;
   return Array.isArray(preview?.violations)&&preview.violations.length===1&&
     preview.violations[0]==='WORD_WINDOW'&&Number(preview.wordCount)>=1300&&Number(preview.wordCount)<1500;
 }
 if(checkpoint.errorCategory!=='NATIVE_QUALITY_BLOCKED')return false;
 const d=checkpoint.nativeGateDiagnostics;
 return Array.isArray(d?.p0)&&d.p0.length===1&&
   ['title_avoids_literal_coupon_code','coupon_lock'].includes(d.p0[0])&&
   Array.isArray(d.failed)&&d.failed.length===1&&d.failed[0]===d.p0[0]&&
   Array.isArray(d.schemas)&&d.schemas.length===0&&
   Array.isArray(d.duplicates)&&d.duplicates.length===0&&
   Array.isArray(d.indexation)&&d.indexation.length===0;
}

// Fail closed on unfinished market rendering. Never create a paid provider
// request for a country whose native publish-quality renderer is not ready.
export const READY_NATIVE_RENDERERS=Object.freeze(['AE','SA']);
export function publicationReadyTopic(topic,markets=READY_NATIVE_RENDERERS){
 return Boolean(topic&&markets.includes(topic.country)&&Array.isArray(topic.sections)&&topic.sections.length===5&&
  typeof topic.slug==='string'&&/^[a-z0-9-]{16,120}$/.test(topic.slug));
}
export function resumableCheckpoint(checkpoint,{savedOnly=false,manualGroqResume=false,manualIncompleteRetry=false,nativeGateRepair=false,autoSafeSaudiRecovery=false,topic=null}={}){
 const state=checkpoint?.state;
 if(!checkpoint)return true;
 // An uncertain publish has already crossed the irreversible HTTP boundary.
 // Quarantine it for independent reconciliation: never auto-publish it again
 // and never let it monopolize the global queue cursor.
 if(['LIVE_VERIFIED','QUALITY_PASSED','COMMITTED','FAILED_FINAL','UNKNOWN_PUBLICATION_OUTCOME'].includes(state))return false;
 // Resume only a definitive HTTP 429 with another healthy free key/provider.
 // Ambiguous responses remain quarantined; never risk duplicate charges.
 if(state==='PAUSED_QUOTA')return manualGroqResume||(
  checkpoint.errorCategory==='QUOTA'&&Number(checkpoint.lastRequestStatus)===429&&
  Number.isInteger(checkpoint.sectionIndex)&&checkpoint.sectionIndex>=0&&checkpoint.sectionIndex<5&&
  checkpoint.sections?.length===checkpoint.sectionIndex);
 if(state==='BLOCKED_REVIEW')
  return (autoSafeSaudiRecovery&&safeSaudiDeterministicRecovery(checkpoint,topic))||
   (manualIncompleteRetry&&manualGroqResume&&checkpoint.errorCategory==='INCOMPLETE_RESPONSE')||
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

/** Hold the current topic until the next tick has observed its terminal
 * checkpoint. Native publication slot delays therefore retry without new AI
 * calls, while LIVE_VERIFIED/blocked states advance on the following tick. */
export function queueCursorAfterScan(total,lastChecked,wasSelected){
 return wasSelected?lastChecked:nextQueueCursor(total,lastChecked);
}
