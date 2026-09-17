export const APPROVED_COUPON_CODES=Object.freeze([
  'NOV153','NOV157','NOV161','NOV163','NOV170','NOV174','NOV177','NOV186','NOV188','NOV195'
]);

export const LEGACY_COUPON_MAP=Object.freeze({
  OPS32:'NOV170',OPS56:'NOV188',OPS47:'NOV174',OPS48:'NOV157',
  OPS43:'NOV177',OPS41:'NOV186',OPS38:'NOV163',OPS58:'NOV153'
});

const APPROVED=new Set(APPROVED_COUPON_CODES);

export function isApprovedCoupon(code){
  return APPROVED.has(String(code||'').trim().toUpperCase());
}

export function normalizeApprovedCoupon(code,fallback='NOV170'){
  const value=String(code||'').trim().toUpperCase();
  if(APPROVED.has(value))return value;
  if(LEGACY_COUPON_MAP[value])return LEGACY_COUPON_MAP[value];
  return fallback;
}

export function replaceUnapprovedCouponTokens(text,fallback='NOV170'){
  return String(text??'').replace(/\b(?:OPS\d+|NOV\d+)\b/gi,token=>normalizeApprovedCoupon(token,fallback));
}
