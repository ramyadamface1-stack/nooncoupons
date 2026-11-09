import test from 'node:test';
import assert from 'node:assert/strict';
import {publicEdgePolicyRevision,publicRouteKind,publicEdgeCacheEligible} from '../r2-public-cache-policy.js';
test('invalidate cached pre-consolidation country NOV sitemaps without touching article or archive caches',()=>{
  const sa='/sitemap-coupons-saudi.xml',ae='/sitemap-coupons-uae.xml';
  for(const path of [sa,ae]){
    assert.equal(publicRouteKind(path),'xml');
    assert.equal(publicEdgePolicyRevision(path),'market-coupon-canonical-v3');
    assert.equal(publicEdgeCacheEligible(new Request('https://noondealsnow.com'+path)),true);
    assert.equal(publicEdgeCacheEligible(new Request('https://noondealsnow.com'+path+'?audit=1')),false);
  }
  assert.notEqual(publicEdgePolicyRevision('/sitemap-core.xml'),'market-coupon-canonical-v3');
  assert.notEqual(publicEdgePolicyRevision('/articles/saudi-test'),'market-coupon-canonical-v3');
});
