export const APPROVED_COUPON_CODES=Object.freeze([
  'NOV153','NOV157','NOV161','NOV163','NOV170','NOV174','NOV177','NOV186','NOV188','NOV195'
]);

const APPROVED=new Set(APPROVED_COUPON_CODES);

export function isApprovedCoupon(code){
  return APPROVED.has(String(code||'').trim().toUpperCase());
}

export function normalizeApprovedCoupon(code,fallback='NOV170'){
  const value=String(code||'').trim().toUpperCase();
  return APPROVED.has(value)?value:fallback;
}

export function replaceUnapprovedCouponTokens(text,fallback='NOV170'){
  return String(text??'').replace(/\b(?:OPS\d+|NOV\d+)\b/gi,token=>{
    const value=String(token).toUpperCase();
    return APPROVED.has(value)?value:fallback;
  });
}
