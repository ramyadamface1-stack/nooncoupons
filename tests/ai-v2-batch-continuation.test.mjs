import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledBatchAction,safeBatchReport} from '../automation/ai-v2/batch-continuation.mjs';
import {readFileSync} from 'node:fs';

test('a verified article counts toward the bounded market batch',()=>{
  assert.equal(scheduledBatchAction('LIVE_VERIFIED','NATIVE_QUALITY_AND_PUBLIC_URL_VERIFIED'),'PUBLISHED');
});
test('only a definitive invalid content draft may yield the next distinct topic',()=>{
  assert.equal(scheduledBatchAction('BLOCKED','BATCH_CONTENT_INVALID'),'NEXT_TOPIC');
  for(const reason of ['PUBLISH_5XX_OUTCOME_QUARANTINED','PUBLISH_HTTP_OUTCOME_UNKNOWN',
    'UNKNOWN_REQUEST_OUTCOME','GLOBAL_PUBLICATION_SLOT_NOT_DUE','SITE_RATE_LIMITED',
    'QUOTA_EXHAUSTED','BATCH_CONTENT_THIN','NATIVE_QUALITY_BLOCKED']){
    assert.equal(scheduledBatchAction('BLOCKED',reason),'STOP',reason);
  }
});
test('quota/provider/site-health and unverified publication stop rather than retrying',()=>{
  for(const status of ['SKIPPED','CHECKPOINTED','PREFLIGHT','DRAFT_SAVED','PAUSED_QUOTA','']){
    assert.equal(scheduledBatchAction(status,'BATCH_CONTENT_INVALID'),'STOP',status);
  }
});

test('native quality rejection may skip to a distinct topic only after definite no-write HTTP 409',()=>{
 assert.equal(scheduledBatchAction('BLOCKED','NATIVE_QUALITY_BLOCKED',409),'NEXT_TOPIC');
 for(const status of [200,400,403,429,500,503,null]){
  assert.equal(scheduledBatchAction('BLOCKED','NATIVE_QUALITY_BLOCKED',status),'STOP');
 }
 assert.equal(scheduledBatchAction('CHECKPOINTED','NATIVE_QUALITY_BLOCKED',409),'STOP');
 assert.equal(scheduledBatchAction('BLOCKED','PUBLISH_5XX_OUTCOME_QUARANTINED',409),'STOP');
});

test('native 409 reaches batch continuation via a redacted, numeric result',()=>{
 const definitive=safeBatchReport('BLOCKED','NATIVE_QUALITY_BLOCKED',
  {http:409,articleId:'private-article',secret:'never-log',url:null});
 assert.deepEqual(definitive,{status:'BLOCKED',reason:'NATIVE_QUALITY_BLOCKED',http:409,url:null});
 assert.equal(scheduledBatchAction(definitive.status,definitive.reason,definitive.http),'NEXT_TOPIC');
 for(const http of [undefined,null,400,429,500,503,'409']){
  const ambiguous=safeBatchReport('BLOCKED','NATIVE_QUALITY_BLOCKED',{http});
  assert.equal(scheduledBatchAction(ambiguous.status,ambiguous.reason,ambiguous.http),'STOP',String(http));
 }
 const uncertain=safeBatchReport('BLOCKED','UNKNOWN_REQUEST_OUTCOME',{http:409});
 assert.equal(scheduledBatchAction(uncertain.status,uncertain.reason,uncertain.http),'STOP');
 const src=readFileSync(new URL('../automation/ai-v2/run.mjs',import.meta.url),'utf8');
 assert.match(src,/lastSafeReport=safeBatchReport\(status,reason,data\)/);
 assert.match(src,/scheduledBatchAction\(lastReportStatus,lastSafeReport\?\.reason,lastSafeReport\?\.http\)/);
});
