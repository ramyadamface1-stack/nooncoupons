import {createHash} from 'node:crypto';
import {isApprovedMarketCoupon} from '../../approved-coupons.js';
export const STATES=Object.freeze(['PLANNED','REQUEST_PENDING','REQUEST_SENT','UNKNOWN_REQUEST_OUTCOME','RESPONSE_RECEIVED','DRAFT_SAVED','VALIDATING','REPAIR_PENDING','QUALITY_PASSED','COMMITTED','DEPLOYING','LIVE_VERIFIED','PAUSED_QUOTA','BLOCKED_REVIEW','FAILED_RECOVERABLE','FAILED_FINAL']);
export function stableId(topic){
  const fields=['noondealsnow',topic.country,topic.language,topic.brand,topic.category,topic.topic,topic.coupon,topic.slug];
  if(fields.some(x=>!String(x||'').trim()))throw Error('INCOMPLETE_ARTICLE_IDENTITY');
  return createHash('sha256').update(fields.join('|')).digest('hex').slice(0,24);
}
export function cadence(config,scheduledMs){
  const interval=Number(config.intervalMinutes);
  if(![1,5,10,15,30,60].includes(interval))throw Error('UNSUPPORTED_INTERVAL');
  const min=Math.floor(Number(scheduledMs)/60000);
  if(!Number.isSafeInteger(min)||min<0)return {due:false,reason:'CLOCK_SKEW'};
  if(!config.enabled)return {due:false,reason:'SCHEDULER_DISABLED'};
  if(min%interval!==0)return {due:false,reason:'INTERVAL_NOT_ELAPSED'};
  return {due:true,reason:'DUE',slot:Math.floor(min/interval)};
}
export function validateConfig(config){
  if(config.siteId!=='noondealsnow'||config.repository!=='ramyadamface1-stack/nooncoupons'||config.domain!=='https://noondealsnow.com')throw Error('WRONG_PROJECT');
  if(config.publicationMode!=='checkpoint_only'&&config.publicationMode!=='live_verified')throw Error('INVALID_PUBLICATION_MODE');
  const m=60/Number(config.intervalMinutes);
  if(!Number.isInteger(m)||m!==Number(config.targetPerHour)||m*24!==Number(config.targetPerDay))throw Error('CADENCE_TARGET_MISMATCH');
  if(Number(config.maxConcurrent)!==1)throw Error('UNSAFE_CONCURRENCY');
  if(config.checkpoint?.backend!=='private-r2'||config.checkpoint?.verifyReadBack!==true)throw Error('CHECKPOINT_UNSAFE');
  if(config.limits?.freeOnly!==true||config.limits?.requiresFreeBudgetApproval!==true)throw Error('BUDGET_GUARD_DISABLED');
  if(!isApprovedMarketCoupon(config.siteMarkets?.SA?.coupon,'SA')||!isApprovedMarketCoupon(config.siteMarkets?.AE?.coupon,'AE'))throw Error('CROSS_MARKET_COUPON');
  return true;
}
export function classifyFailure(status,body='',retryAfter=''){
  const code=Number(status),b=String(body).toLowerCase();
  if(code===401)return {category:'INVALID_KEY',retry:false};
  if(code===403)return {category:'PROVIDER_PERMISSION',retry:false,scope:/organi[sz]ation/.test(b)?'organization':'account'};
  if(code===429)return {category:'QUOTA',retry:false,retryAfter:String(retryAfter||'')};
  if(code===400&&/model|not found|unsupported/.test(b))return {category:'INVALID_MODEL',retry:false};
  if(code>=500)return {category:'PROVIDER_TEMPORARY',retry:false};
  return {category:'PROVIDER_ERROR',retry:false};
}
export function assertTopic(topic,config){
  if(!['SA','AE'].includes(topic.country))throw Error('WRONG_COUNTRY');
  const market=config.siteMarkets[topic.country];
  if(topic.language!==market.language||topic.coupon!==market.coupon)throw Error('WRONG_LANGUAGE_OR_COUPON');
  if(!isApprovedMarketCoupon(topic.coupon,topic.country))throw Error('UNAPPROVED_COUPON');
  if(!/^[a-z0-9-]{16,120}$/.test(topic.slug))throw Error('UNSAFE_SLUG');
  if(!topic.brand||!topic.category||!topic.topic)throw Error('INCOMPLETE_TOPIC');
  return stableId(topic);
}
export function normalizeDraft(draft){
  const clean={...draft};
  if(Array.isArray(clean.faq))clean.faq=clean.faq.map(x=>({q:x.q??x.question??'',a:x.a??x.answer??''}));
  return clean;
}
export function wordCount(input){return String(input||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length}
export function qualityPreflight(draft,config){
  const w=wordCount(draft.html),coupon=draft.topic?.coupon;
  const t=String(draft.html||'');
  const violations=[];
  if(w<config.limits.minWords||w>config.limits.maxWords)violations.push('WORD_WINDOW');
  if(!/<h1\b/i.test(t)||!/<h2\b/i.test(t))violations.push('HEADINGS');
  if(/\$\{[^}]+\}|{{[^}]+}}/.test(t))violations.push('PLACEHOLDER');
  const withoutSchema=t.replace(/<script\\b[^>]*type=["']application\\/ld\\+json["'][^>]*>[\\s\\S]*?<\\/script\\s*>/gi,'');
  if(/<script\\b/i.test(withoutSchema))violations.push('SCRIPT_NOT_ALLOWED');
  const codes=[...t.matchAll(/\b(?:NOV|OPS)\d+\b/gi)].map(m=>m[0].toUpperCase());
  if(codes.some(c=>c!==coupon))violations.push('WRONG_COUPON');
  if(!t.includes(coupon))violations.push('COUPON_MISSING');
  return {pass:violations.length===0,wordCount:w,violations,fullNativeQualityAuditRequired:true};
}
export function mayCallProvider({config,freeApproved,checkpointWritable,topicReserved,hasAnyKey}){
  if(!config.enabled)return 'SCHEDULER_DISABLED';
  if(!freeApproved)return 'FREE_BUDGET_NOT_APPROVED';
  if(!checkpointWritable)return 'CHECKPOINT_UNAVAILABLE';
  if(!topicReserved)return 'TOPIC_NOT_RESERVED';
  if(!hasAnyKey)return 'AI_KEYS_MISSING';
  return null;
}
