export const APPROVED_COUPON_CODES=Object.freeze([
  'NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161'
]);

// Sales-weighted from the user's Noon export, restricted strictly to codes currently
// visible on the NoonDealsNow homepage. We intentionally cap the strongest code
// instead of mirroring raw share 1:1 so the site keeps testing the other live codes.
export const HOMEPAGE_COUPONS_BY_MARKET=Object.freeze({
  SA:Object.freeze(['NOV170','NOV174','NOV177','NOV163','NOV195']),
  AE:Object.freeze(['NOV188','NOV157','NOV186','NOV153','NOV161'])
});
export const PRIMARY_COUPON_BY_MARKET=Object.freeze({SA:'NOV170',AE:'NOV188'});
const SALES_WEIGHTED_BY_MARKET=Object.freeze({
  // Revenue + order evidence from the user's export, restricted to homepage codes
  // and locked to the market shown on the homepage.
  SA:Object.freeze([
    ['NOV170',60],['NOV195',15],['NOV177',10],['NOV174',10],['NOV163',5]
  ]),
  AE:Object.freeze([
    ['NOV188',40],['NOV157',28],['NOV161',23],['NOV153',7],['NOV186',2]
  ])
});

const APPROVED=new Set(APPROVED_COUPON_CODES);

export function isApprovedCoupon(code){
  return APPROVED.has(String(code||'').trim().toUpperCase());
}

export function normalizeApprovedCoupon(code,fallback='NOV170'){
  const value=String(code||'').trim().toUpperCase();
  if(APPROVED.has(value))return value;
  const safeFallback=String(fallback||APPROVED_COUPON_CODES[0]).trim().toUpperCase();
  return APPROVED.has(safeFallback)?safeFallback:APPROVED_COUPON_CODES[0];
}

// Market eligibility is stricter than the global allowlist: no cross-market coupons.
export function isApprovedMarketCoupon(code,country='SA'){
  const market=String(country||'SA').toUpperCase()==='AE'?'AE':'SA';
  return HOMEPAGE_COUPONS_BY_MARKET[market].includes(String(code||'').trim().toUpperCase());
}
export function normalizeMarketCoupon(code,country='SA'){
  const market=String(country||'SA').toUpperCase()==='AE'?'AE':'SA';
  const value=String(code||'').trim().toUpperCase();
  return isApprovedMarketCoupon(value,market)?value:PRIMARY_COUPON_BY_MARKET[market];
}
export function replaceWrongMarketCouponTokens(text,country='SA'){
  return String(text??'').replace(/\b(?:OPS\d+|NOV\d+)\b/gi,code=>normalizeMarketCoupon(code,country));
}

export function salesWeightedCoupon(seed=0,country='SA'){
  const market=String(country||'SA').toUpperCase()==='AE'?'AE':'SA',rows=SALES_WEIGHTED_BY_MARKET[market];
  const total=rows.reduce((n,[,w])=>n+w,0),slot=Math.abs(Math.trunc(Number(seed)||0))%Math.max(1,total);
  let cursor=0;
  for(const [code,weight] of rows){cursor+=weight;if(slot<cursor)return code}
  return PRIMARY_COUPON_BY_MARKET[market];
}

export function replaceUnapprovedCouponTokens(text,fallback='NOV170'){
  return String(text??'').replace(/\b(?:OPS\d+|NOV\d+)\b/gi,token=>normalizeApprovedCoupon(token,fallback));
}

export const COUPON_SALES_POLICY_INFO=Object.freeze({
  version:1,
  source:'user-sales-export-homepage-codes-only',
  homepageCodes:[...APPROVED_COUPON_CODES],
  homepageCodesByMarket:HOMEPAGE_COUPONS_BY_MARKET,
  primaryByMarket:PRIMARY_COUPON_BY_MARKET,
  saPrimaryShareCapPct:60,
  marketLocked:true,
  principle:'sales-weighted-market-locked-but-diversified'
});
