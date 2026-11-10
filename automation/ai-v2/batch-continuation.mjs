// Report only the small, non-secret fields needed for safe batch control.
// In particular, retain an integer HTTP 409 from the native no-write quality
// gate; an unknown/ambiguous response must NEVER look like a confirmed 409.
export function safeBatchReport(status,reason,data={}){
  return {status,reason,
    http:Number.isInteger(data?.http)?data.http:null,
    url:typeof data?.url==='string'?data.url:null};
}

// A failed single-call AI draft is safe to abandon, not retry. Keep the
// checkpoint BLOCKED_REVIEW and try the next distinct topic while the existing
// per-job article-attempt and elapsed-time limits still apply. Any uncertainty
// about provider quota, publication, credentials, site health or network
// outcomes must stop the batch instead of multiplying requests.
export function scheduledBatchAction(status,reason,httpStatus=null){
  if(status==='LIVE_VERIFIED')return 'PUBLISHED';
  if(status==='BLOCKED'&&reason==='BATCH_CONTENT_INVALID')return 'NEXT_TOPIC';
  // The native Worker issues HTTP 409 only after a full quality/semantic gate
  // rejects the article BEFORE the DO slot claim or any article R2 write.
  // Its immutable draft checkpoint is already BLOCKED_REVIEW. Continuing to
  // the next distinct topic is safe, but never weaken the quality threshold.
  if(status==='BLOCKED'&&reason==='NATIVE_QUALITY_BLOCKED'&&httpStatus===409)return 'NEXT_TOPIC';
  return 'STOP';
}
