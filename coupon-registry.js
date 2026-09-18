import {APPROVED_COUPON_CODES,isApprovedCoupon,replaceUnapprovedCouponTokens} from './approved-coupons.js';

const DAY=86400000;
const OWNER_CATALOG_UPDATED_AT='2026-09-18T00:00:00.000Z';
const REVIEW_AFTER_DAYS=14;
const BLOCK_AFTER_DAYS=30;
const CODES=APPROVED_COUPON_CODES;
const REGISTRY_VERSION='owner-approved-nov-v1-strict-copy';

export const COUPON_REGISTRY=Object.freeze(Object.fromEntries(CODES.map(code=>[code,Object.freeze({
  code,
  active:true,
  markets:['SA','AE'],
  evidence:'owner-approved-code-list',
  officialVerified:false,
  catalogUpdatedAt:OWNER_CATALOG_UPDATED_AT,
  claimsPolicy:'no-guaranteed-discount-or-savings-claim'
})])));

export function couponStatus(topic,at=new Date()){
  const code=String(topic?.code||'').toUpperCase(),country=topic?.country==='AE'?'AE':'SA',row=isApprovedCoupon(code)?COUPON_REGISTRY[code]:null;
  if(!row)return {publishAllowed:false,state:'unknown-code',reason:'coupon_not_in_registry',code,country};
  if(!row.active)return {publishAllowed:false,state:'inactive',reason:'coupon_inactive',code,country};
  if(!row.markets.includes(country))return {publishAllowed:false,state:'wrong-market',reason:'coupon_market_not_allowed',code,country};
  const updated=Date.parse(row.catalogUpdatedAt),ageDays=Number.isFinite(updated)?Math.floor((at.getTime()-updated)/DAY):9999;
  const state=ageDays>BLOCK_AFTER_DAYS?'expired-for-new-publishing':ageDays>REVIEW_AFTER_DAYS?'review-due':'current-owner-approved';
  return {
    publishAllowed:ageDays<=BLOCK_AFTER_DAYS,
    state,
    reason:ageDays>BLOCK_AFTER_DAYS?'coupon_registry_stale':null,
    code,country,
    officialVerified:false,
    evidence:row.evidence,
    catalogUpdatedAt:row.catalogUpdatedAt,
    reviewDueAt:new Date(updated+REVIEW_AFTER_DAYS*DAY).toISOString(),
    publishBlockAt:new Date(updated+BLOCK_AFTER_DAYS*DAY).toISOString(),
    claimsPolicy:row.claimsPolicy
  };
}

export function injectCouponFreshness(article,status){
  if(!article?.html||!status)return article;
  const approved=status.code||APPROVED_COUPON_CODES[0];
  article.html=replaceUnapprovedCouponTokens(article.html,approved);
  if(article.title)article.title=replaceUnapprovedCouponTokens(article.title,approved);
  if(article.metaDescription)article.metaDescription=replaceUnapprovedCouponTokens(article.metaDescription,approved);
  if(article.primaryKeyword)article.primaryKeyword=replaceUnapprovedCouponTokens(article.primaryKeyword,approved);
  const date=String(status.catalogUpdatedAt||'').slice(0,10);
  const section=`<section class="coupon-freshness" data-coupon-state="${status.state}"><h2>حالة الكوبون وطريقة التحقق</h2><p>الكود <strong>${approved}</strong> موجود في قائمة الأكواد المعتمدة من مالك الموقع، وآخر تحديث للقائمة كان ${date||'غير محدد'}. هذا لا يعني ضمان قبوله لكل حساب أو سلة؛ شروط نون الحالية وصفحة الدفع هما المرجع النهائي.</p><p>لا ننسب للكود نسبة خصم أو مبلغ توفير ثابت من دون مصدر رسمي. إذا تغيّرت أهلية الحساب أو البائع أو المنتج أو طريقة الدفع، اختبر الكود على نفس السلة وسجّل الإجمالي قبل وبعد التطبيق.</p></section>`;
  article.html=String(article.html).replace(/<section class="sources">/i,section+'<section class="sources">');
  article.couponFreshness=status;
  article.approvedCouponEnforced=true;
  return article;
}

export async function writeCouponFreshnessSnapshot(env,at=new Date()){
  if(!env?.CONTENT_FINAL)return null;
  const rows=[];
  for(const code of CODES){
    for(const country of ['SA','AE'])rows.push(couponStatus({code,country},at));
  }
  const summary={
    version:REGISTRY_VERSION,
    generatedAt:at.toISOString(),
    catalogUpdatedAt:OWNER_CATALOG_UPDATED_AT,
    reviewAfterDays:REVIEW_AFTER_DAYS,
    blockAfterDays:BLOCK_AFTER_DAYS,
    officialVerification:false,
    approvedCodeCopyEnforcement:true,
    publishable:rows.filter(x=>x.publishAllowed).length,
    reviewDue:rows.filter(x=>x.state==='review-due').length,
    blocked:rows.filter(x=>!x.publishAllowed).length,
    rows
  };
  await env.CONTENT_FINAL.put('freshness/coupon-registry-status.json',JSON.stringify(summary),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return summary;
}

export const COUPON_REGISTRY_INFO={version:REGISTRY_VERSION,codes:CODES.length,reviewAfterDays:REVIEW_AFTER_DAYS,blockAfterDays:BLOCK_AFTER_DAYS,catalogUpdatedAt:OWNER_CATALOG_UPDATED_AT,officialVerification:false,approvedCodeCopyEnforcement:true};
