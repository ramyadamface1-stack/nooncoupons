import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceUnapprovedCouponTokens} from '../approved-coupons.js';
test('preserve case-sensitive article URL slugs with already-approved coupon names',()=>{
 const link='https://noondealsnow.com/articles/uae-jbl-speakers-waterproof-battery-nov188-2026';
 assert.equal(replaceUnapprovedCouponTokens(link,'NOV188'),link);
 assert.equal(replaceUnapprovedCouponTokens('uae-apple-audio-nov188-2026'),'uae-apple-audio-nov188-2026');
});
test('replace non-approved visible coupon text without losing brand policy',()=>{
 const unapprovedFixture = ['OPS', '777'].join('');
 assert.equal(replaceUnapprovedCouponTokens(`Use ${unapprovedFixture} at checkout`,'NOV188'),'Use NOV188 at checkout');
 assert.equal(replaceUnapprovedCouponTokens('Use NOV188 at checkout','NOV170'),'Use NOV188 at checkout');
});
