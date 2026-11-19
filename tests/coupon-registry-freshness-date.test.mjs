import test from 'node:test';
import assert from 'node:assert/strict';
import {couponStatus,COUPON_REGISTRY,COUPON_REGISTRY_INFO} from '../coupon-registry.js';
import {APPROVED_COUPON_CODES,HOMEPAGE_COUPONS_BY_MARKET,salesWeightedCoupon} from '../approved-coupons.js';

test('Nov 19 owner reconfirmation keeps the ten market-approved codes without claiming merchant verification',()=>{
  assert.equal(COUPON_REGISTRY_INFO.catalogUpdatedAt,'2026-11-19T09:57:34.000Z');
  assert.equal(COUPON_REGISTRY_INFO.blockAfterDays,30);
  assert.equal(COUPON_REGISTRY_INFO.reviewAfterDays,14);
  const at=new Date('2026-10-21T16:45:00.000Z');
  const seen=new Set();
  for(const country of ['SA','AE']){
    for(const code of HOMEPAGE_COUPONS_BY_MARKET[country]){
      const row=couponStatus({country,code},at);
      assert.equal(row.publishAllowed,true,JSON.stringify(row));
      assert.equal(row.state,'current-owner-approved');
      assert.equal(row.officialVerified,false);
      assert.equal(row.code,code);
      seen.add(code);
    }
  }
  assert.equal(seen.size,APPROVED_COUPON_CODES.length);
});
test('wrong-market codes, unknown codes and false discount claims remain blocked',()=>{
  const at=new Date('2026-10-21T16:45:00.000Z');
  assert.equal(couponStatus({country:'AE',code:'NOV170'},at).publishAllowed,false);
  assert.equal(couponStatus({country:'SA',code:'NOV188'},at).publishAllowed,false);
  assert.equal(couponStatus({country:'SA',code:'RAMY25'},at).publishAllowed,false);
  assert.equal(couponStatus({country:'AE',code:'NOV999'},at).reason,'coupon_not_in_registry');
  assert.equal(COUPON_REGISTRY.NOV170.claimsPolicy,'no-guaranteed-discount-or-savings-claim');
});
test('owner-confirmed codes are publishable Nov 19, but the future 30-day cutoff still holds',()=>{
  const confirmed=new Date('2026-11-19T10:00:00.000Z');
  for(const country of ['SA','AE'])for(const code of HOMEPAGE_COUPONS_BY_MARKET[country]){
    const row=couponStatus({country,code},confirmed);
    assert.equal(row.publishAllowed,true,JSON.stringify(row));
    assert.equal(row.officialVerified,false);
  }
  const stale=new Date('2026-12-20T10:00:00.000Z');
  for(const country of ['SA','AE'])for(const code of HOMEPAGE_COUPONS_BY_MARKET[country]){
    const row=couponStatus({country,code},stale);
    assert.equal(row.publishAllowed,false,JSON.stringify(row));
    assert.equal(row.reason,'coupon_registry_stale');
  }
  const dayBefore=new Date('2026-12-19T09:57:33.000Z');
  const deadline=new Date('2026-12-19T09:57:34.000Z');
  assert.equal(couponStatus({country:'SA',code:'NOV170'},dayBefore).publishAllowed,true);
  assert.equal(couponStatus({country:'SA',code:'NOV170'},deadline).publishAllowed,false);
  assert.equal(couponStatus({country:'SA',code:'NOV170'},new Date('2026-12-03T09:57:34.000Z')).state,'review-due');
});
test('sales-weighted generator only selects owner-listed coupons matching country for 1000 seeds',()=>{
  for(const country of ['SA','AE']){
    const allowed=new Set(HOMEPAGE_COUPONS_BY_MARKET[country]);
    for(let i=0;i<1000;i++){
      const c=salesWeightedCoupon(i,country);
      assert.ok(allowed.has(c));
      assert.equal(couponStatus({code:c,country},new Date('2026-10-21T16:45:00.000Z')).publishAllowed,true);
    }
  }
});
