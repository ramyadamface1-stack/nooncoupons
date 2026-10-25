import test from 'node:test';
import assert from 'node:assert/strict';
import {pickRescueTopic} from '../generator-core-v2.js';
import {marketLockedArticleTopic} from '../auto-platform.js';
import {isApprovedMarketCoupon} from '../approved-coupons.js';

test('with zero Saudi programmatic output, AI rescue can be pinned to Saudi only',()=>{
  const state={articles:[]};
  for(const attempt of [0,1,12,37,200,456]){
    const sa=pickRescueTopic(state,attempt,'SA');
    assert.ok(sa,'Saudi topic pool should contain valid candidates');
    assert.equal(sa.country,'SA');
    assert.equal(marketLockedArticleTopic(sa).country,'SA');
    assert.ok(isApprovedMarketCoupon(marketLockedArticleTopic(sa).code,'SA'));
    assert.equal(marketLockedArticleTopic(sa).code,sa.code);
  }
});
test('English and ordinary AI candidates remain supported and market locked',()=>{
  const topic=pickRescueTopic({articles:[]},10,'AE');
  assert.ok(topic);
  assert.equal(topic.country,'AE');
  assert.equal(marketLockedArticleTopic(topic).country,'AE');
  assert.ok(isApprovedMarketCoupon(marketLockedArticleTopic(topic).code,'AE'));
  assert.equal(marketLockedArticleTopic(topic).code,topic.code);
});
