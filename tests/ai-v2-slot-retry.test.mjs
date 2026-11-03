import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedSlotRetryDelay} from '../automation/ai-v2/slot-retry.mjs';
const now=Date.parse('2026-11-03T13:55:00Z');
test('only a confirmed 409 rate-slot rejection may be retried once at its due time',()=>{
  assert.equal(confirmedSlotRetryDelay({httpStatus:409,reason:'GLOBAL_PUBLICATION_SLOT_NOT_DUE',nextEligibleAt:'2026-11-03T13:55:12Z'},now),12300);
  assert.equal(confirmedSlotRetryDelay({httpStatus:409,reason:'GLOBAL_PUBLICATION_SLOT_NOT_DUE',nextEligibleAt:'2026-11-03T13:54:59Z'},now),0);
});
test('uncertain writes, ordinary errors, stale and excessive waits cannot retry',()=>{
  for(const x of [
    {httpStatus:503,reason:'GLOBAL_PUBLICATION_SLOT_NOT_DUE',nextEligibleAt:'2026-11-03T13:55:12Z'},
    {httpStatus:409,reason:'ARTICLE_ALREADY_PUBLISHED',nextEligibleAt:'2026-11-03T13:55:12Z'},
    {httpStatus:409,reason:'GLOBAL_PUBLICATION_SLOT_NOT_DUE',nextEligibleAt:null},
    {httpStatus:409,reason:'GLOBAL_PUBLICATION_SLOT_NOT_DUE',nextEligibleAt:'2026-11-03T13:56:00Z'}
  ])assert.equal(confirmedSlotRetryDelay(x,now),null);
});
