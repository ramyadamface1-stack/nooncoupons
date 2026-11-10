// A failed single-call AI draft is safe to abandon, not retry. Keep the
// checkpoint BLOCKED_REVIEW and try the next distinct topic while the existing
// per-job article-attempt and elapsed-time limits still apply. Any uncertainty
// about provider quota, publication, credentials, site health or network
// outcomes must stop the batch instead of multiplying requests.
export function scheduledBatchAction(status,reason){
  if(status==='LIVE_VERIFIED')return 'PUBLISHED';
  if(status==='BLOCKED'&&reason==='BATCH_CONTENT_INVALID')return 'NEXT_TOPIC';
  return 'STOP';
}
