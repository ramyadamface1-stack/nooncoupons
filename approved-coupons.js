export const APPROVED_COUPON_CODES=Object.freeze([
  'OPS32','OPS56','OPS47','OPS48','OPS43','OPS41','OPS38','OPS58'
]);

const APPROVED=new Set(APPROVED_COUPON_CODES);

export function isApprovedCoupon(code){
  return APPROVED.has(String(code||'').trim().toUpperCase());
}

export function normalizeApprovedCoupon(code,fallback='OPS32'){
  const value=String(code||'').trim().toUpperCase();
  return APPROVED.has(value)?value:fallback;
}

export function replaceUnapprovedCouponTokens(text,fallback='OPS32'){
  return String(text??'').replace(/\b(?:OPS\d+|NOV\d+)\b/gi,token=>normalizeApprovedCoupon(token,fallback));
}
