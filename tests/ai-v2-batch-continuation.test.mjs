import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledBatchAction} from '../automation/ai-v2/batch-continuation.mjs';

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
