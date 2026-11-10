import {couponCodeCandidates} from '../../quality-audit.js';
// One zero-provider rescue for saved Saudi technical buyers' drafts falsely
// blocked on FAT32, EXT4, AX3000, CAT8 or RJ45 hardware-spec tokens.
// No AI call and never accepts a genuine extra coupon such as NOV188.
export const SA_FILESYSTEM_RECOVERY_REVISION='sa-ssd-filesystem-coupon-v1';
export function safeSaudiFilesystemRecovery(checkpoint,topic){
 const category=String(topic?.category||''),brand=String(topic?.brand||'');
 const isSsd=/SSD|أقراص/i.test(category);
 const asusRouter=/(?:asus|أسوس)/i.test(brand)&&/(?:راوتر|router|wi.?fi|واي فاي)/i.test(category);
 const isUsbDock=/(?:USB|موزعات|dock)/i.test(category);
 if(topic?.country!=='SA'||checkpoint?.state!=='BLOCKED_REVIEW'||
    checkpoint.errorCategory!=='NATIVE_QUALITY_BLOCKED'||
    checkpoint.filesystemRecoveryRevision===SA_FILESYSTEM_RECOVERY_REVISION||
    !(isSsd||asusRouter||isUsbDock)||
    checkpoint.sectionIndex!==5||checkpoint.sections?.length!==5||
    !checkpoint.sections.every(s=>typeof s?.html==='string'&&s.html.length>0))return false;
 const d=checkpoint.nativeGateDiagnostics;
 if(!Array.isArray(d?.p0)||d.p0.length!==1||d.p0[0]!=='coupon_lock'||
    !Array.isArray(d.failed)||d.failed.length!==1||d.failed[0]!=='coupon_lock'||
    d.schemas?.length||d.duplicates?.length||d.indexation?.length)return false;
 const html=String(checkpoint.nativeArticle?.html||'');
 if(!html||!((isSsd&&/\b(?:FAT32|EXT4)\b/.test(html))||(asusRouter&&/\bAX3000\b/.test(html))||(isUsbDock&&/\b(?:RJ45|CAT8)\b/.test(html))))return false;
 const plain=html.replace(/<script\b[\s\S]*?<\/script>/gi,' ')
   .replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
   .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 const codes=couponCodeCandidates(plain,checkpoint.nativeTopic||topic);
 return codes.length===1&&codes[0]==='NOV170';
}

// Exactly one zero-provider editorial rescue for known repaired Saudi gates.
// Fail closed on unrecognized native diagnostics or malformed checkpoints.
export const SA_SAFE_RECOVERY_REVISION='sa-title-and-index-checklist-v3';
export const AE_SAFE_RECOVERY_REVISION='ae-depth-recovery-20261103-v1';
export function safeEnglishDeterministicRecovery(checkpoint,topic){
 const preview=checkpoint?.qualityPreview;
 return topic?.country==='AE'&&checkpoint?.state==='BLOCKED_REVIEW'&&
  checkpoint?.deterministicRecoveryRevision!==AE_SAFE_RECOVERY_REVISION&&
  checkpoint?.errorCategory==='WORD_WINDOW'&&checkpoint?.sectionIndex===5&&
  checkpoint?.sections?.length===5&&checkpoint.sections.every(s=>typeof s?.html==='string'&&s.html.length>0)&&
  Array.isArray(preview?.violations)&&preview.violations.length===1&&preview.violations[0]==='WORD_WINDOW'&&
  Number(preview.wordCount)>=1200&&Number(preview.wordCount)<1500;
}

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
 const safeIndexRepair=Array.isArray(d?.p0)&&d.p0.length===0&&
   Array.isArray(d?.failed)&&d.failed.every(x=>x==='lists')&&
   Array.isArray(d?.schemas)&&d.schemas.length===0&&
   Array.isArray(d?.duplicates)&&d.duplicates.length===0&&
   Array.isArray(d?.indexation)&&d.indexation.length>0&&
   d.indexation.every(x=>x==='indexation_value_below_threshold');
 if(safeIndexRepair)return true;
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
export function resumableCheckpoint(checkpoint,{savedOnly=false,manualGroqResume=false,manualIncompleteRetry=false,nativeGateRepair=false,autoSafeSaudiRecovery=false,autoSafeSaudiFilesystemRecovery=false,autoSafeEnglishRecovery=false,autoReadOnlyReconcile=false,nowMs=Date.now(),topic=null}={}){
 const state=checkpoint?.state;
 if(!checkpoint)return true;
 // A 5xx/network error from a public GET does NOT determine whether an
 // earlier POST wrote the article. Permit up to three delayed GET-only
 // reconciliations *only* when the preceding read attempts were transient.
 // Definitive 404, 200 with wrong coupon, 429 or prior legacy one-off
 // reconciliation remain quarantined; never replay POST or call a provider.
 if(state==='UNKNOWN_PUBLICATION_OUTCOME'){
  const last=Date.parse(String(checkpoint.lastPublicVerificationAt||checkpoint.updatedAt||''));
  const attempts=Number(checkpoint.publicationReconciliationAttempts);
  const first=!checkpoint.publicationReconciliationAttemptedAt;
  const transientFollowup=checkpoint.publicationReconciliationTransient===true&&
   Number.isInteger(attempts)&&attempts>=1&&attempts<3;
  return autoReadOnlyReconcile===true&&(first||transientFollowup)&&
   Number.isFinite(last)&&Number.isFinite(nowMs)&&nowMs-last>=15*60000;
 }
 if(['LIVE_VERIFIED','QUALITY_PASSED','COMMITTED','FAILED_FINAL'].includes(state))return false;
 // Resume only a definitive HTTP 429 with another healthy free key/provider.
 // Ambiguous responses remain quarantined; never risk duplicate charges.
 if(state==='PAUSED_QUOTA'||state==='PAUSED_PROVIDER')return manualGroqResume||(
  ((checkpoint.errorCategory==='QUOTA'&&Number(checkpoint.lastRequestStatus)===429)||
   (state==='PAUSED_PROVIDER'&&(
    (checkpoint.errorCategory==='PROVIDER_TEMPORARY'&&[500,502,503,504].includes(Number(checkpoint.lastRequestStatus)))||
    (checkpoint.errorCategory==='INVALID_KEY'&&Number(checkpoint.lastRequestStatus)===401)||
    (checkpoint.errorCategory==='PROVIDER_PERMISSION'&&Number(checkpoint.lastRequestStatus)===403)
   )))&&
  Number.isInteger(checkpoint.sectionIndex)&&checkpoint.sectionIndex>=0&&checkpoint.sectionIndex<5&&
  checkpoint.sections?.length===checkpoint.sectionIndex);
 if(state==='BLOCKED_REVIEW')
  return (checkpoint.errorCategory==='PROVIDER_TEMPORARY'&&
   [500,502,503,504].includes(Number(checkpoint.lastRequestStatus))&&
   Number.isInteger(checkpoint.sectionIndex)&&checkpoint.sectionIndex>=0&&checkpoint.sectionIndex<5&&
   checkpoint.sections?.length===checkpoint.sectionIndex)||
   (autoSafeSaudiRecovery&&safeSaudiDeterministicRecovery(checkpoint,topic))||
   (autoSafeSaudiFilesystemRecovery&&safeSaudiFilesystemRecovery(checkpoint,topic))||
   (autoSafeEnglishRecovery&&safeEnglishDeterministicRecovery(checkpoint,topic))||
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
export const QUEUE_SCAN_LIMIT=24;
// Use the same R2 read budget for *eligible market* topics instead of spending
// half the window on the other market. Scanning local metadata costs no R2
// requests; checkpoint reads remain capped at 24 per market invocation.
export function marketQueueScanWindow(topics,market,cursor,limit=QUEUE_SCAN_LIMIT){
 if(!Array.isArray(topics)||!['SA','AE'].includes(market))throw Error('INVALID_MARKET_QUEUE');
 if(!Number.isInteger(limit)||limit<1||limit>QUEUE_SCAN_LIMIT)throw Error('INVALID_QUEUE_SCAN_LIMIT');
 if(topics.length===0)return [];
 const start=Number.isSafeInteger(cursor)&&cursor>=0?cursor%topics.length:Math.min(20,topics.length-1);
 const positions=[];
 for(let offset=0;offset<topics.length&&positions.length<limit;offset++){
  const position=(start+offset)%topics.length;
  if(topics[position]?.country===market)positions.push(position);
 }
 return positions;
}
// Bridge a stale legacy-only scan to the start of an appended editorial bank.
// Keep every original index stable and let the persisted cursor resume on the
// exact newly selected topic; never rescan the whole R2 corpus in one tick.
export function queueExpansionBridgeWindow(total,originalCount,firstWindow,limit=8){
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(originalCount)||
    originalCount<1||originalCount>=total||!Array.isArray(firstWindow)||!firstWindow.length||
    firstWindow.some(i=>!Number.isSafeInteger(i)||i<0||i>=originalCount)||
    !Number.isInteger(limit)||limit<1||limit>8)return [];
 return Array.from({length:Math.min(limit,total-originalCount)},(_,i)=>originalCount+i);
}
// When previous append-only waves are already checkpointed, reserve a small
// rotating read window for the latest reviewed wave, WITHOUT resetting the
// historic per-market cursor or re-requesting any provider responses.
// The rotation is derived from the persisted legacy cursor's first position:
// no additional R2 cursor write is needed. Never scans >limit extra checkpoints.
export function queueRotatingFreshWaveWindow(total,freshStart,firstWindow,limit=4){
 if(!Number.isSafeInteger(total)||total<2||
    !Number.isSafeInteger(freshStart)||freshStart<1||freshStart>=total||
    !Array.isArray(firstWindow)||!firstWindow.length||
    firstWindow.some(x=>!Number.isSafeInteger(x)||x<0||x>=total)||
    !Number.isInteger(limit)||limit<1||limit>4)return [];
 if(firstWindow[0]>=freshStart)return []; // Already scanning this wave normally.
 const remaining=total-freshStart,seed=Math.floor(firstWindow[0]/QUEUE_SCAN_LIMIT);
 return Array.from({length:Math.min(limit,remaining)},(_,i)=>freshStart+(seed+i)%remaining);
}

export function queueScanWindow(total,cursor,limit=QUEUE_SCAN_LIMIT){
 if(!Number.isInteger(total)||total<1)return [];
 if(!Number.isInteger(limit)||limit<1||limit>24)throw Error('INVALID_QUEUE_SCAN_LIMIT');
 const start=Number.isSafeInteger(cursor)&&cursor>=0?cursor%total:Math.min(20,total-1);
 return Array.from({length:Math.min(total,limit)},(_,i)=>(start+i)%total);
}
export const PROVIDER_YIELD_REASONS=Object.freeze(['ALL_FREE_PROVIDERS_IN_COOLDOWN','CALL_BUDGET_LIMIT','NO_FREE_PROVIDER_AVAILABLE']);
export function pausedProviderNextCursor(total,lastChecked,reason){
 if(!PROVIDER_YIELD_REASONS.includes(reason))throw Error('UNSAFE_QUEUE_YIELD_REASON');
 return nextQueueCursor(total,lastChecked);
}
export function nextQueueCursor(total,lastChecked){
 if(!Number.isInteger(total)||total<1||!Number.isSafeInteger(lastChecked)||lastChecked<0||lastChecked>=total)
  throw Error('INVALID_QUEUE_CURSOR');
 return (lastChecked+1)%total;
}

/** Hold the current topic until the next tick has observed its terminal
 * checkpoint. Native publication slot delays therefore retry without new AI
 * calls, while LIVE_VERIFIED/blocked states advance on the following tick. */
/**
 * Supplemental bridge/fresh-wave probes must not consume unvisited positions
 * from the durable primary queue when all sampled checkpoints are terminal.
 * A selected topic (including a supplemental candidate) remains pinned until
 * its checkpoint is inspected on a subsequent run.
 */
export function queueCursorAnchorForScan(primaryPositions,lastChecked,wasSelected){
 if(!Array.isArray(primaryPositions)||!primaryPositions.length)throw Error('INVALID_PRIMARY_SCAN_WINDOW');
 if(!Number.isSafeInteger(lastChecked)||lastChecked<0)throw Error('INVALID_LAST_CHECKED_POSITION');
 const finalPrimary=primaryPositions[primaryPositions.length-1];
 if(!Number.isSafeInteger(finalPrimary)||finalPrimary<0)throw Error('INVALID_PRIMARY_SCAN_WINDOW');
 return wasSelected?lastChecked:finalPrimary;
}
export function queueCursorAfterScan(total,lastChecked,wasSelected){
 return wasSelected?lastChecked:nextQueueCursor(total,lastChecked);
}
