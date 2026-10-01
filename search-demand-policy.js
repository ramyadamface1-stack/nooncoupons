const norm=s=>String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();

const HUB_LIKE_INTENTS=new Set(['coupon','timing','question','eligibility','howto']);
const GSC_SUPPORTED_CATEGORY_KEYS=new Set(['mobiles','grocery','computers','automotive']);

function marketKey(topic={}){
  if(topic.market==='uae'||topic.country==='AE')return 'uae';
  return 'saudi';
}

function genericCouponOwner(topic={}){
  return marketKey(topic)==='uae'?'/uae/noon-coupon-code':'/saudi-arabia/noon-coupon-code';
}

function categoryOwner(topic={}){
  const key=String(topic.categoryKey||'').trim();
  return key?('/'+marketKey(topic)+'/category/'+key):genericCouponOwner(topic);
}

export function searchDemandEvidence(topic={}){
  const kw=norm(topic.kw||topic.title||'');
  const key=String(topic.categoryKey||'');
  const measured=
    /noon coupon|noon code|كود خصم نون|كوبون نون|اكواد خصم نون/.test(kw) ||
    (key==='grocery'&&/grocery|بقال/.test(kw)) ||
    (key==='mobiles'&&/mobile|جوال/.test(kw)) ||
    (key==='automotive'&&/car|سيار/.test(kw)) ||
    (key==='computers'&&/laptop|computer|لابتوب|كمبيوتر/.test(kw));
  return {
    source:measured?'gsc-observed-or-cluster-supported':'editorial-unmeasured',
    measured,
    categorySupported:GSC_SUPPORTED_CATEGORY_KEYS.has(key)
  };
}

export function evaluateSearchDemandPolicy(topic={}){
  const evidence=searchDemandEvidence(topic);
  const intent=String(topic.intent||topic.searchIntentFamily||'');
  const specific=Boolean(topic.brandKey||topic.modelKey||topic.comparisonKey||['brand','model','product-intent'].includes(String(topic.catalogLevel||'')));
  if(specific)return {createStandalone:true,action:'create',reason:'specific-entity-intent',ownerPath:null,evidence};

  if(intent==='returns'){
    return {createStandalone:false,action:'route-existing',reason:'returns-owned-by-refund-guide',ownerPath:'/guide/noon-refund-credit',evidence};
  }
  if(intent==='howto'){
    return {createStandalone:false,action:'route-existing',reason:'howto-owned-by-guide',ownerPath:'/guide/how-to-use-noon-coupon',evidence};
  }
  if(HUB_LIKE_INTENTS.has(intent)){
    return {createStandalone:false,action:'route-existing',reason:'hub-or-category-owned-intent',ownerPath:topic.categoryKey?categoryOwner(topic):genericCouponOwner(topic),evidence};
  }

  return {createStandalone:true,action:'create',reason:evidence.categorySupported?'supported-category-independent-intent':'independent-intent-quality-gated',ownerPath:null,evidence};
}

export const SEARCH_DEMAND_POLICY_INFO=Object.freeze({
  version:2,
  model:'demand-aware-intent-owner-v1',
  sourceWindow:'GSC 2026-08-29..2026-09-25 + uploaded 1000-keyword editorial bank',
  principles:['one-intent-one-owner','measured-demand-over-artificial-variation','route-hub-intents-to-existing-pages','specific-entity-pages-still-require-quality-gates'],
  observedCategories:[...GSC_SUPPORTED_CATEGORY_KEYS],
  canonicalCouponOwners:{SA:'/saudi-arabia/noon-coupon-code',AE:'/uae/noon-coupon-code'},
  howToOwner:'/guide/how-to-use-noon-coupon',
  refundOwner:'/guide/noon-refund-credit'
});
