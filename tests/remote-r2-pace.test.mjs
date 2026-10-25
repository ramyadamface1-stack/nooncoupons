import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyPaceSnapshot} from '../auto-platform.js';

const common={BULK_DAILY_TARGET:'19200',BULK_DAILY_PACE_MODE:'true',BULK_PACE_MAX_ROUNDS:'8',
  GLOBAL_PUBLISH_MIN_INTERVAL_SECONDS:'60',GLOBAL_PUBLISH_MAX_PER_MINUTE:'1'};
test('remote R2 rescue with one global slot cannot perform 8 costly bulk rounds',()=>{
  const pace=dailyPaceSnapshot({...common,REMOTE_EXISTING_R2_ENABLED:'true'}, {bulkPublishedToday:0});
  assert.equal(pace.rounds,1);
  assert.equal(pace.subrequestProtected,true);
  assert.equal(pace.behind,true);
});
test('normal single-round fallback and existing non-remote schedule remain valid',()=>{
  const ordinary=dailyPaceSnapshot({...common,REMOTE_EXISTING_R2_ENABLED:'false'}, {bulkPublishedToday:0});
  assert.equal(ordinary.subrequestProtected,false);
  assert.ok(ordinary.rounds>=1&&ordinary.rounds<=8);
  const high=dailyPaceSnapshot({...common,REMOTE_EXISTING_R2_ENABLED:'true'}, {bulkPublishedToday:999999});
  assert.equal(high.rounds,1);
  assert.equal(high.behind,false);
});
test('remote per-minute guard does not pretend to apply if publication gate is explicitly multi-article',()=>{
  const pace=dailyPaceSnapshot({...common,REMOTE_EXISTING_R2_ENABLED:'true',GLOBAL_PUBLISH_MAX_PER_MINUTE:'2'}, {bulkPublishedToday:0});
  assert.equal(pace.subrequestProtected,false);
});
