import test from 'node:test';
import assert from 'node:assert/strict';
import {marketLockedArticleTopic} from '../auto-platform.js';
test('new Emirati generation can never inherit a Saudi-only code',()=>{
  const original={country:'AE',code:'NOV195',kw:'كوبون نون الإمارات'};
  const output=marketLockedArticleTopic(original);
  assert.equal(output.country,'AE');
  assert.equal(output.code,'NOV188');
  assert.equal(original.code,'NOV195');
});
test('new Saudi generation can never inherit Emirati code and respects an approved Saudi code',()=>{
  assert.equal(marketLockedArticleTopic({country:'SA',code:'NOV188'}).code,'NOV170');
  assert.equal(marketLockedArticleTopic({country:'SA',code:'NOV195'}).code,'NOV195');
});
test('existing approved UAE coupon remains available and missing code falls back safely',()=>{
  assert.equal(marketLockedArticleTopic({country:'AE',code:'NOV157'}).code,'NOV157');
  assert.equal(marketLockedArticleTopic({country:'AE'}).code,'NOV188');
  assert.equal(marketLockedArticleTopic(null),null);
});