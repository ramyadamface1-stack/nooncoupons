export const APPROVED_COUPON_CODES=Object.freeze([
  'NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161'
]);

export const LEGACY_COUPON_MAP=Object.freeze({
  OPS32:'NOV170',
  OPS56:'NOV188',
  OPS47:'NOV174',
  OPS48:'NOV157',
  OPS43:'NOV177',
  OPS41:'NOV186',
  OPS38:'NOV163',
  OPS58:'NOV153'
});

const APPROVED=new Set(APPROVED_COUPON_CODES);

export function isApprovedCoupon(code){
  return APPROVED.has(String(code||'').trim().toUpperCase());
}

export function normalizeApprovedCoupon(code,fallback='NOV170'){
  const value=String(code||'').trim().toUpperCase();
  if(APPROVED.has(value))return value;
  const mapped=LEGACY_COUPON_MAP[value];
  if(mapped)return mapped;
  const safeFallback=String(fallback||APPROVED_COUPON_CODES[0]).trim().toUpperCase();
  return APPROVED.has(safeFallback)?safeFallback:APPROVED_COUPON_CODES[0];
}

export function replaceUnapprovedCouponTokens(text,fallback='NOV170'){
  return String(text??'').replace(/\b(?:OPS\d+|NOV\d+)\b/gi,token=>normalizeApprovedCoupon(token,fallback));
}
