import {isApprovedMarketCoupon} from './approved-coupons.js';
import {staleCurrentClaims} from './article-temporal-freshness.js';
import {auditSeoArticle,auditEnglishSeoArticle,preAuditSemanticGate} from './quality-audit.js';
import {loadCluster,preflightGlobalGate,globalGate} from './quality-index.js';
import {validateStructuredData} from './schema-validator.js';
import {evaluateIndexation} from './indexation-gate.js';
import {couponStatus} from './coupon-registry.js';
import {getPublicationSlotStatus,claimPublicationSlot} from './publication-rate-limit.js';
import {recordAiV2Publication} from './ai-v2-publication-ledger.js';
import {normalizeAttribution} from './automation/ai-v2/attribution.mjs';

// Protected by the existing Cloudflare-authenticated /api/internal/ route.
// This bridge NEVER accepts a fragment as a live article or reduces any
// quality, freshness, originality, coupon, or global publishing standards.
const rules={SA:{code:'NOV170',lang:'ar-SA'},AE:{code:'NOV188',lang:'en-AE'}};
const reject=(reason,extra={})=>({ok:false,reason,...extra});
const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(v=>v.toString(16).padStart(2,'0')).join('');
// Reuse the complete original quality dataset for 120s within one isolate.
// This is NOT the smaller public listing: full signatures and category
// metadata remain available for global/semantic uniqueness checks.
let qualityFeedCache=null,qualityFeedLoading=null;
export async function readFullNativeQualityFeed(env,atMs=Date.now()){
 if(qualityFeedCache&&atMs-qualityFeedCache.at<120000)return qualityFeedCache.articles;
 if(qualityFeedLoading)return qualityFeedLoading;
 qualityFeedLoading=(async()=>{
   // The verified new-account projection retains every uniqueness, signature,
   // owner/intent, category, and blueprint field used by the native gates.
   // A source ETag mismatch MUST fall back to the complete original dataset.
   // This never silently weakens novelty checks when bulk/latest.json changes.
   try{
     const source=await env.CONTENT_FINAL.head?.('bulk/latest.json');
     if(source?.etag){
       const slim=await env.CONTENT_FINAL.get('_ops/ai-v2-native-quality-index-v1.json');
       if(slim){
         const data=await slim.json();
         if(data?.version===1&&data.sourceKey==='bulk/latest.json'&&
            data.sourceEtag===source.etag&&Number.isInteger(data.sourceCount)&&
            Array.isArray(data.articles)&&data.sourceCount===data.articles.length){
           qualityFeedCache={at:Date.now(),articles:data.articles};
           return qualityFeedCache.articles;
         }
       }
     }
   }catch{}
   // Fail closed on missing/stale projection: original full quality set wins.
   const feed=await env.CONTENT_FINAL.get('bulk/latest.json');
   if(!feed)throw Error('NATIVE_QUALITY_SOURCE_MISSING');
   const payload=await feed.json();
   if(!payload||!Array.isArray(payload.articles))throw Error('NATIVE_QUALITY_SOURCE_INVALID');
   qualityFeedCache={at:Date.now(),articles:payload.articles};
   return qualityFeedCache.articles;
 })();
 try{return await qualityFeedLoading}finally{qualityFeedLoading=null}
}
export function validateAiV2NativePayload(payload){
 const {article,topic,checkpoint}=payload||{},rule=rules[topic?.country];
 if(!rule||!article||!checkpoint)return reject('INCOMPLETE_OR_WRONG_MARKET');
 if(topic.code!==rule.code||article.coupon!==rule.code||!isApprovedMarketCoupon(rule.code,topic.country))return reject('INVALID_MARKET_COUPON');
 if(topic.language!==rule.lang||article.country!==topic.country)return reject('INVALID_LANGUAGE');
 if(checkpoint.state!=='PREPARED_FOR_NATIVE_AUDIT'||!/[a-f0-9]{24}/.test(String(checkpoint.articleId||'')))return reject('CHECKPOINT_NOT_APPROVED');
 if(checkpoint.attribution!=null&&!normalizeAttribution(checkpoint.attribution))return reject('INVALID_PROVIDER_ATTRIBUTION');
 if(typeof article.slug!=='string'||!/^[a-z0-9-]{16,120}$/.test(article.slug)||article.slug!==topic.slug||article.slug.includes('--'))return reject('INVALID_SLUG');
 if(!article.title||!article.primaryKeyword||!article.metaDescription)return reject('INCOMPLETE_SEO');
 const html=article.html;
 if(typeof html!=='string'||html.length<4000||html.length>240000)return reject('INVALID_HTML_SIZE');
 if(staleCurrentClaims(html).length)return reject('STALE_CURRENT_SEASON_CLAIM');
 // JSON-LD is permitted; executable scripts and event handlers are rejected.
 const noSchema=html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script\s*>/gi,'');
 if(/<\s*(?:script|iframe|form|object|embed|style|svg|base)\b|\son[a-z]+\s*=|javascript\s*:/i.test(noSchema))return reject('UNSAFE_MARKUP');
 if(!/<article\b/i.test(html)||!/<\/article\s*>/i.test(html)||!/<h1\b/i.test(html))return reject('INCOMPLETE_ARTICLE');
 if(!html.includes(rule.code)||!/https:\/\/www\.noon\.com\//i.test(html))return reject('COUPON_OR_OFFICIAL_STORE_MISSING');
 return {ok:true};
}
export async function publishAiV2NativeArticle(env,payload){
 const shape=validateAiV2NativePayload(payload);
 if(!shape.ok)return shape;
 if(!env?.CONTENT_FINAL||!env?.GENERATOR_CONTROL)return reject('NATIVE_BINDINGS_MISSING');
 const {topic,article,checkpoint}=payload,expected=String(checkpoint.contentHash||''),digest=await hash(article.html);
 if(!/^[a-f0-9]{64}$/.test(expected)||expected!==digest)return reject('CHECKPOINT_HASH_MISMATCH');
 let recent,cluster;
 try{
  const originals=await readFullNativeQualityFeed(env);
  cluster=await loadCluster(env,topic,new Map());
  recent=[...originals,...(cluster.entries||[])];
 }catch{return reject('QUALITY_INDEX_UNAVAILABLE')}
 // The two global gates inspect the identical full native quality dataset.
 // Share one container so quality-index.js can reuse its WeakMap CPU index
 // instead of rebuilding all slug, keyword, intent and bucket sets twice.
 // This does not reduce the dataset or change any uniqueness thresholds.
 const recentIndex={entries:recent};
 const pre=preflightGlobalGate({...topic,kw:article.primaryKeyword},recentIndex);
 if(!pre.pass)return reject('DUPLICATE_INTENT',{violations:pre.reasons});
 const coupon=couponStatus(topic);
 if(!coupon.publishAllowed)return reject('COUPON_FRESHNESS_BLOCK',{detail:coupon.reason});
 const schema=validateStructuredData(article);
 const auditRecent=recent.slice(0,300); // Native full cluster still checks intent/slug collisions.
 const preSemantic=preAuditSemanticGate(article,auditRecent);
 const audit=topic.country==='SA'?
  auditSeoArticle(article,topic,{minWords:1500,threshold:95,recent:auditRecent,semanticRecent:auditRecent,semanticPreflight:preSemantic}):
  auditEnglishSeoArticle(article,topic,{threshold:95,recent:auditRecent});
 const global=globalGate(article,topic,audit,recentIndex);
 const indexation=evaluateIndexation(article,topic,{globalGate:global,contextualLinks:(article.contextualLinks||[]).length,clusterSize:cluster.entries.length,schemaGate:schema,coupon});
 if(!schema.pass||!audit.productionReady||audit.score<95||!global.pass||!indexation.indexable){
  return reject('NATIVE_QUALITY_BLOCKED',{diagnostics:{score:audit.score,words:audit.wordCount,p0:audit.p0,failed:audit.failed,schemas:schema.errors,duplicates:global.reasons,indexation:indexation.reasons}});
 }
 const key='articles/'+article.slug+'.html';
 let old;try{old=await env.CONTENT_FINAL.head(key)}catch{return reject('DUPLICATE_CHECK_UNAVAILABLE')}
 if(old)return reject('ARTICLE_ALREADY_PUBLISHED');
 const status=await getPublicationSlotStatus(env,{aiV2:true});
 if(!status.ok||status.eligible===false)return reject('GLOBAL_PUBLICATION_SLOT_NOT_DUE',{nextEligibleAt:status.nextEligibleAt||null});
 const permit=await claimPublicationSlot(env,topic.country,'ai-v2-native');
 if(!permit.ok)return reject('GLOBAL_PUBLICATION_SLOT_NOT_GRANTED');
 const at=new Date().toISOString();
 const attribution=checkpoint.attribution?normalizeAttribution(checkpoint.attribution):null;
 try{
  const saved=await env.CONTENT_FINAL.put(key,article.html,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'text/html; charset=utf-8'},
   customMetadata:{status:'published',t:encodeURIComponent(article.title).slice(0,900),m:encodeURIComponent(article.metaDescription).slice(0,900),
    c:topic.country,cp:article.coupon,q:String(audit.score),w:String(audit.wordCount),at,p:'ai-v2-native',
     ...(attribution?{aiAttribution:JSON.stringify(attribution)}:{})}});
  if(!saved)return reject('ARTICLE_ALREADY_EXISTS_AFTER_PERMIT');
 }catch{return reject('ARTICLE_WRITE_OUTCOME_UNKNOWN',{articleId:checkpoint.articleId})}
 let ledgerResult;
 try{ledgerResult=await recordAiV2Publication(env,{slug:article.slug,country:topic.country,publishedAt:at,attribution,
  title:article.title,metaDescription:article.metaDescription,quality:audit.score,wordCount:audit.wordCount})}
 catch{ledgerResult={ok:false,reason:'LEDGER_UNAVAILABLE'}}
 // A durable acknowledgement is not proof that the public URL renders.
 return {ok:true,stored:true,state:'STORED_AWAITING_LIVE_VERIFICATION',articleId:checkpoint.articleId,slug:article.slug,
  url:'https://noondealsnow.com/articles/'+encodeURIComponent(article.slug),contentHash:digest,quality:audit.score,ledgerRecorded:ledgerResult.ok===true,ledgerReason:ledgerResult.ok?null:ledgerResult.reason};
}
