import assert from 'node:assert/strict';
import {evaluateSearchDemandPolicy,searchDemandEvidence,SEARCH_DEMAND_POLICY_INFO} from './search-demand-policy.js';

const saCategory=evaluateSearchDemandPolicy({country:'SA',market:'saudi',categoryKey:'mobiles',intent:'coupon',kw:'كود خصم نون السعودية للجوالات'});
assert.equal(saCategory.createStandalone,false);
assert.equal(saCategory.ownerPath,'/saudi/category/mobiles');

const uaeCategory=evaluateSearchDemandPolicy({country:'AE',market:'uae',categoryKey:'grocery',intent:'eligibility',kw:'Noon grocery coupon eligibility UAE'});
assert.equal(uaeCategory.createStandalone,false);
assert.equal(uaeCategory.ownerPath,'/uae/category/grocery');

const howto=evaluateSearchDemandPolicy({country:'SA',market:'saudi',categoryKey:'mobiles',intent:'howto',kw:'كيفية استخدام كود خصم نون'});
assert.equal(howto.createStandalone,false);
assert.equal(howto.ownerPath,'/guide/how-to-use-noon-coupon');

const product=evaluateSearchDemandPolicy({country:'SA',market:'saudi',categoryKey:'mobiles',brandKey:'apple',modelKey:'iphone',intent:'finalprice',kw:'سعر iPhone النهائي على نون السعودية'});
assert.equal(product.createStandalone,true);
assert.equal(product.reason,'specific-entity-intent');

const measured=searchDemandEvidence({categoryKey:'grocery',kw:'noon grocery code'});
assert.equal(measured.measured,true);
assert.equal(measured.categorySupported,true);

assert.equal(SEARCH_DEMAND_POLICY_INFO.canonicalCouponOwners.SA,'/saudi-arabia/noon-coupon-code');
assert.equal(SEARCH_DEMAND_POLICY_INFO.canonicalCouponOwners.AE,'/uae/noon-coupon-code');

console.log(JSON.stringify({ok:true,version:SEARCH_DEMAND_POLICY_INFO.version,cases:5}));
