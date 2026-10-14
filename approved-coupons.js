export const APPROVED_COUPON_CODES=Object.freeze([
  'NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161'
]);

// Sales-weighted from the user's Noon export, restricted strictly to codes currently
// visible on the NoonDealsNow homepage. We intentionally cap the strongest code
// instead of mirroring raw share 1:1 so the site keeps testing the other live codes.
export const PRIMARY_COUPON_BY_MARKET=Object.freeze({SA:'NOV170',AE:'NOV188'});
const SALES_WEIGHTED_BY_MARKET=Object.freeze({
  SA:Object.freeze([
    ['NOV170',55],['NOV174',9],['NOV177',8],['NOV195',8],['NOV188',5],
    ['NOV157',4],['NOV163',4],['NOV161',3],['NOV153',2],['NOV186',2]
  ]),
  AE:Object.freeze([
    ['NOV188',30],['NOV195',20],['NOV186',18],['NOV157',12],['NOV170',8],
    ['NOV174',3],['NOV177',3],['NOV163',2],['NOV153',2],['NOV161',2]
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
  primaryByMarket:PRIMARY_COUPON_BY_MARKET,
  saPrimaryShareCapPct:55,
  principle:'sales-weighted-but-diversified'
});
