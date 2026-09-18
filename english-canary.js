import {buildBulkTopic,buildEnglishNativeCandidate,buildEnglishUsefulArticle,BULK_ENGINE_INFO} from './bulk-content-engine.js';
import {auditEnglishSeoArticle} from './quality-audit.js';
import {normalizeApprovedCoupon,isApprovedCoupon,replaceUnapprovedCouponTokens} from './approved-coupons.js';

const STATE_KEY='english-canary/state.json';
const DEFAULT_TARGET=2;
const DEFAULT_CONTROLLED_TOTAL=200;
const MAX_CONTROLLED_TOTAL=1000;
const DEFAULT_DAILY_TARGET=24;
const MAX_DAILY_TARGET=48;
const DEFAULT_MIN_INTERVAL_MINUTES=60;
const DIVERSITY_WINDOW=24;
const PROFILE_DIVERSITY_SLOTS=16;
const PROFILE_MAX_PER_BATCH=3;
const INTENT_MAX_PER_BATCH=5;
const START_CURSOR=760000;
const MAX_SCAN=1500;
const PROFILE_TO_CATEGORY={
  mobile:'mobiles',computing:'computers',audio:'audio',screen:'tvs',beauty:'beauty',
  appliance:'appliances',kitchen:'home-kitchen',home:'home-kitchen',grocery:'grocery',
  kids:'baby-kids',baby:'baby-kids',fitness:'sports',travel:'travel',auto:'automotive',
  office:'school-supplies',pets:'pets'
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=s=>encodeURI(String(s||''));
const now=()=>new Date().toISOString();
const sanitizeMeta=s=>String(s||'').replace(/\bguide\s+guide\b/gi,'guide');
const jsonResponse=(x,status=200)=>new Response(JSON.stringify(x,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const xmlResponse=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}});
const xmlEsc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c');

function targetFromEnv(env){return Math.max(0,Math.min(2,Number(env.ENGLISH_CANARY_TOTAL||DEFAULT_TARGET)||DEFAULT_TARGET))}
function controlledTargetFromEnv(env){const base=targetFromEnv(env),requested=Number(env.ENGLISH_CONTROLLED_TOTAL||DEFAULT_CONTROLLED_TOTAL)||DEFAULT_CONTROLLED_TOTAL;return Math.max(base,Math.min(MAX_CONTROLLED_TOTAL,requested))}
function dailyTargetFromEnv(env){const requested=Number(env.ENGLISH_DAILY_TARGET||DEFAULT_DAILY_TARGET)||DEFAULT_DAILY_TARGET;return Math.max(1,Math.min(MAX_DAILY_TARGET,requested))}
function minIntervalMinutesFromEnv(env){const requested=Number(env.ENGLISH_MIN_INTERVAL_MINUTES||DEFAULT_MIN_INTERVAL_MINUTES)||DEFAULT_MIN_INTERVAL_MINUTES;return Math.max(5,Math.min(1440,requested))}
function cairoDay(ts=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts))}
function publishedToday(records){const day=cairoDay();return (records||[]).filter(r=>r?.createdAt&&cairoDay(r.createdAt)===day).length}
function nextEligibleAt(state,env){const last=Date.parse(state?.lastPublishedAt||'');if(!Number.isFinite(last))return null;return new Date(last+minIntervalMinutesFromEnv(env)*60000).toISOString()}
function emptyState(env){return {version:3,builder:BULK_ENGINE_INFO.englishArticleBuilder,target:targetFromEnv(env),controlledTarget:controlledTargetFromEnv(env),status:'active',controlledStatus:'active',cursor:START_CURSOR,records:[],updatedAt:now()}}
async function readState(env){
  try{const o=await env.CONTENT_FINAL?.get(STATE_KEY);if(!o)return emptyState(env);const s=await o.json();const records=Array.isArray(s.records)?s.records.map(r=>({...r,metaDescription:sanitizeMeta(r?.metaDescription)})):[];return {...emptyState(env),...s,version:3,target:targetFromEnv(env),controlledTarget:controlledTargetFromEnv(env),records}}
  catch{return emptyState(env)}
}
async function writeState(env,state){
  const baseTarget=targetFromEnv(env),controlledTarget=controlledTargetFromEnv(env),n=(state.records||[]).length;
  const clean={...state,version:3,builder:BULK_ENGINE_INFO.englishArticleBuilder,target:baseTarget,controlledTarget,status:n>=baseTarget?'complete':'active',controlledStatus:n>=controlledTarget?'complete':'active',updatedAt:now()};
  await env.CONTENT_FINAL.put(STATE_KEY,JSON.stringify(clean),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return clean;
}
function publicRecord(r){if(!r)return r;const {plain,...safe}=r;return safe}
function recentForAudit(records){return (records||[]).slice(-64).map(r=>({slug:r.slug,primaryKeyword:r.primaryKeyword,signature:r.signature,plain:r.plain||'',blueprint:r.blueprint}))}
function qualityFloor(audit){const values=Object.values(audit?.groups||{}).map(Number).filter(Number.isFinite);return values.length?Math.min(...values):0}
function categoryKeyFor(profileKey){return PROFILE_TO_CATEGORY[profileKey]||null}

async function findCandidate(env,state,slot){
  const desiredCountry=slot%2===0?'SA':'AE',recent=recentForAudit(state.records),threshold=Math.max(95,Number(env.QUALITY_PUBLISH_THRESHOLD||95));
  const history=state.records||[],recentWindow=history.slice(-DIVERSITY_WINDOW),usedProfiles=new Set(history.map(r=>r.profileKey).filter(Boolean)),profileCounts=new Map(),intentCounts=new Map(),usedSlugs=new Set(history.map(r=>r.slug).filter(Boolean)),usedKeywords=new Set(history.map(r=>String(r.primaryKeyword||'').toLowerCase()).filter(Boolean));
  for(const r of recentWindow){if(r.profileKey)profileCounts.set(r.profileKey,(profileCounts.get(r.profileKey)||0)+1);if(r.intent)intentCounts.set(r.intent,(intentCounts.get(r.intent)||0)+1)}
  let cursor=Math.max(START_CURSOR,Number(state.cursor||START_CURSOR));
  for(let tries=0;tries<MAX_SCAN;tries++,cursor++){
    const topic=buildBulkTopic(cursor);
    if(topic.country!==desiredCountry)continue;
    const categoryKey=categoryKeyFor(topic.profileKey);
    if(!categoryKey)continue;
    const rawCandidate=buildEnglishNativeCandidate(topic);
    if(!rawCandidate)continue;
    const fallbackCode=desiredCountry==='AE'?'NOV188':'NOV170',candidate={...rawCandidate,code:normalizeApprovedCoupon(rawCandidate.code,fallbackCode)};
    if(!isApprovedCoupon(candidate.code))continue;
    if(slot<PROFILE_DIVERSITY_SLOTS&&usedProfiles.has(candidate.profileKey))continue;
    if((profileCounts.get(candidate.profileKey)||0)>=PROFILE_MAX_PER_BATCH)continue;
    if((intentCounts.get(candidate.intent)||0)>=INTENT_MAX_PER_BATCH)continue;
    const article=buildEnglishUsefulArticle(candidate,cursor);
    if(!article)continue;
    if(usedSlugs.has(article.slug)||usedKeywords.has(String(article.primaryKeyword||'').toLowerCase()))continue;
    if(await env.CONTENT_FINAL.head('articles/'+article.slug+'.html'))continue;
    const audit=auditEnglishSeoArticle(article,candidate,{recent,threshold});
    if(!audit.productionReady||audit.minJaccardDistance<0.18)continue;
    return {cursor,candidate,article,audit,categoryKey};
  }
  return null;
}

export async function runEnglishCanary(env){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing'};
  const canaryTarget=targetFromEnv(env),target=controlledTargetFromEnv(env);
  if(canaryTarget===0)return {ok:true,skipped:'english_canary_disabled',target:canaryTarget,controlledTarget:target};
  let state=await readState(env);
  if(state.records.length>=target){if(state.controlledStatus!=='complete')state=await writeState(env,state);return {ok:true,skipped:'english_controlled_complete',target:canaryTarget,controlledTarget:target,published:state.records.length}}
  const dailyTarget=dailyTargetFromEnv(env),todayCount=publishedToday(state.records),minInterval=minIntervalMinutesFromEnv(env),nextAt=nextEligibleAt(state,env),nowMs=Date.now();
  if(todayCount>=dailyTarget)return {ok:true,skipped:'english_daily_target_complete',published:state.records.length,publishedToday:todayCount,dailyTarget,controlledTarget:target};
  if(nextAt&&Date.parse(nextAt)>nowMs)return {ok:true,skipped:'english_interval_wait',published:state.records.length,publishedToday:todayCount,dailyTarget,minIntervalMinutes:minInterval,nextEligibleAt:nextAt,controlledTarget:target};
  const slot=state.records.length;let found=null;try{found=await findCandidate(env,state,slot)}catch(e){state.lastError='candidate_scan_error:'+String(e?.message||e).slice(0,220);state.lastAttemptAt=now();state=await writeState(env,state);return {ok:false,error:state.lastError,published:state.records.length,target:canaryTarget,controlledTarget:target}}
  if(!found){state.cursor=Math.max(Number(state.cursor||START_CURSOR)+MAX_SCAN,START_CURSOR);state.lastError='no_production_ready_candidate';state.lastAttemptAt=now();state=await writeState(env,state);return {ok:false,error:'no_production_ready_candidate',published:state.records.length,target:canaryTarget,controlledTarget:target}}
  const {cursor,candidate,article,audit,categoryKey}=found,createdAt=now(),floor=qualityFloor(audit),urlPath='/en/articles/'+article.slug,isCanary=slot<canaryTarget;
  const record={
    slug:article.slug,title:article.title,metaDescription:sanitizeMeta(article.metaDescription),country:candidate.country,coupon:candidate.code,
    status:'published',createdAt,updatedAt:createdAt,indexable:true,quality:audit.score,qualityGroups:audit.groups,qualityFloor:floor,
    qualityChecks:audit.measuredChecks,provider:isCanary?'programmatic-cloudflare:english-v6-canary':'programmatic-cloudflare:english-v6-controlled',primaryKeyword:article.primaryKeyword,
    wordCount:audit.wordCount,signature:audit.signature,plain:audit.plain,blueprint:article.blueprint,profileKey:candidate.profileKey,
    categoryKey,intent:candidate.intent,language:'en',languageIntent:'en',languageSource:'native-intent-v6-canary',canary:isCanary,
    phase:isCanary?'canary':'controlled',minJaccardDistance:audit.minJaccardDistance,urlPath,marketPath:candidate.country==='SA'?'/en/saudi':'/en/uae'
  };
  await env.CONTENT_FINAL.put('articles/'+article.slug+'.html',String(article.html||''),{
    httpMetadata:{contentType:'text/html; charset=utf-8'},
    customMetadata:{lang:'en',ls:'native-intent-v6-canary',t:encodeURIComponent(record.title).slice(0,900),m:encodeURIComponent(record.metaDescription).slice(0,900),c:record.country,cp:record.coupon,q:String(record.quality),qf:String(record.qualityFloor),qc:String(record.qualityChecks),p:record.provider,kw:encodeURIComponent(record.primaryKeyword).slice(0,900),bp:String(record.blueprint),at:createdAt,status:'published',canary:isCanary?'1':'0',phase:record.phase}
  });
  state.records.push(record);state.cursor=cursor+1;state.lastError=null;state.lastAttemptAt=createdAt;state.lastPublishedAt=createdAt;state=await writeState(env,state);
  return {ok:true,target:canaryTarget,controlledTarget:target,published:state.records.length,publishedToday:publishedToday(state.records),dailyTarget:dailyTargetFromEnv(env),minIntervalMinutes:minIntervalMinutesFromEnv(env),nextEligibleAt:nextEligibleAt(state,env),canaryComplete:state.status==='complete',controlledComplete:state.controlledStatus==='complete',record:publicRecord(record),audit:{score:audit.score,wordCount:audit.wordCount,minJaccardDistance:audit.minJaccardDistance,groups:audit.groups}};
}

export async function englishCanaryRecords(env){const s=await readState(env);return (s.records||[]).map(publicRecord)}

export async function englishCanaryHealth(env){
  const state=await readState(env),allRecords=[];
  for(const r of state.records||[]){let r2Present=false;try{r2Present=Boolean(await env.CONTENT_FINAL?.head('articles/'+r.slug+'.html'))}catch{}allRecords.push({...publicRecord(r),r2Present})}
  const canaryTarget=targetFromEnv(env),controlledTarget=controlledTargetFromEnv(env),records=allRecords.slice(0,canaryTarget);
  const sa=allRecords.filter(r=>r.country==='SA').length,ae=allRecords.filter(r=>r.country==='AE').length,profileCount=new Set(allRecords.map(r=>r.profileKey).filter(Boolean)).size;
  const today=publishedToday(allRecords),dailyTarget=dailyTargetFromEnv(env),minIntervalMinutes=minIntervalMinutesFromEnv(env);return {ok:true,version:3,builder:BULK_ENGINE_INFO.englishArticleBuilder,target:canaryTarget,status:records.length>=canaryTarget?'complete':'active',published:records.length,complete:records.length>=canaryTarget,records,lastError:state.lastError||null,updatedAt:state.updatedAt,controlled:{target:controlledTarget,published:allRecords.length,remaining:Math.max(0,controlledTarget-allRecords.length),complete:allRecords.length>=controlledTarget,status:allRecords.length>=controlledTarget?'complete':'active',sa,ae,uniqueProfiles:profileCount,publishedToday:today,dailyTarget,minIntervalMinutes,nextEligibleAt:nextEligibleAt(state,env),records:allRecords}};
}

export async function serveEnglishCanaryHealth(env){return jsonResponse(await englishCanaryHealth(env))}

function pageCss(){return `<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#111827;font-family:Inter,Arial,sans-serif}.top{background:#111827;color:#fff}.topin,.wrap{width:min(980px,94%);margin:auto}.topin{min-height:70px;display:flex;justify-content:space-between;align-items:center;gap:18px}.top a{color:#fff;text-decoration:none;margin-left:14px}.brand{font-weight:900;font-size:20px}.wrap{margin-top:24px;margin-bottom:50px;background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:clamp(18px,4vw,42px);box-shadow:0 16px 42px rgba(15,23,42,.06);line-height:1.8}.wrap h1{font-size:clamp(30px,5vw,44px);line-height:1.15}.wrap h2{margin-top:38px;font-size:clamp(22px,3vw,30px)}.wrap h3{font-size:18px}.wrap p,.wrap li{font-size:17px}.eyebrow{font-size:13px;color:#6d28d9;font-weight:900}.direct-answer{background:#fffbeb;border-left:5px solid #facc15;padding:17px;border-radius:14px}.article-toc{background:#f8fafc;border-radius:12px;padding:12px;margin:18px 0}.article-toc a,.wrap a{color:#5b21b6}.coupon-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:15px;background:#f8fafc;border-radius:14px;margin:18px 0}.coupon-actions button{border:0;border-radius:11px;background:#facc15;color:#111827;padding:12px 16px;font-weight:900;cursor:pointer}.copy-feedback{color:#15803d;font-weight:800;min-height:1.2em}.wrap table{width:100%;border-collapse:collapse;margin:18px 0}.wrap td,.wrap th{border:1px solid #dbe3ec;padding:10px;text-align:left}.wrap th{background:#f8fafc}.faq details{border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;margin:9px 0}.sources{background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:16px}.canary-note{font-size:12px;color:#64748b;margin-bottom:16px}@media(max-width:650px){.topin{align-items:flex-start;flex-direction:column;padding:14px 0}.wrap{width:96%;padding:18px}.wrap p,.wrap li{font-size:16px}.wrap table{display:block;overflow-x:auto}}</style>`}
function copyJs(){return `<script>(()=>{document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-code]');if(!b)return;const code=b.dataset.copyCode||'';const f=b.parentElement?.querySelector('.copy-feedback');let ok=false;try{await navigator.clipboard.writeText(code);ok=true}catch{try{const t=document.createElement('textarea');t.value=code;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();ok=document.execCommand('copy');t.remove()}catch{}}if(f)f.textContent=ok?'Code copied':'Code: '+code;const old=b.textContent;b.textContent=ok?'✓ Copied':old;setTimeout(()=>{b.textContent=old;if(f)f.textContent=''},1800)})})()</script>`}

export async function serveEnglishCanaryArticle(req,env){
  if(req.method!=='GET'||!env.CONTENT_FINAL)return null;
  const u=new URL(req.url),m=u.pathname.match(/^\/en\/articles\/([^/]+)$/);if(!m)return null;
  const slug=decodeURIComponent(m[1]),state=await readState(env),rec=(state.records||[]).find(r=>r.slug===slug&&r.languageSource==='native-intent-v6-canary');if(!rec)return null;
  const o=await env.CONTENT_FINAL.get('articles/'+slug+'.html');if(!o)return null;
  const safeCoupon=normalizeApprovedCoupon(rec.coupon,rec.country==='AE'?'NOV188':'NOV170'),raw=replaceUnapprovedCouponTokens(await o.text(),safeCoupon),origin=env.SITE_ORIGIN||u.origin,canonical=origin+'/en/articles/'+enc(slug),countryLabel=rec.country==='SA'?'Saudi Arabia':'UAE',countryPath=rec.country==='SA'?'/en/saudi':'/en/uae',categoryPath=rec.categoryKey?`${countryPath}/category/${rec.categoryKey}`:countryPath;
  const graph={'@context':'https://schema.org','@type':'Article',headline:rec.title,description:rec.metaDescription,inLanguage:'en',datePublished:rec.createdAt,dateModified:rec.updatedAt||rec.createdAt,mainEntityOfPage:canonical,author:{'@type':'Organization',name:'NoonCoupons'},publisher:{'@type':'Organization',name:'NoonCoupons'},about:[{'@type':'Thing',name:'Noon'},{'@type':'Place',name:countryLabel},{'@type':'Thing',name:rec.primaryKeyword}]};
  const safeMeta=replaceUnapprovedCouponTokens(rec.metaDescription,safeCoupon);const head=`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(rec.title)}</title><meta name="description" content="${esc(safeMeta)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(canonical)}"><link rel="alternate" hreflang="en" href="${esc(canonical)}"><link rel="alternate" hreflang="x-default" href="${esc(canonical)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(rec.title)}"><meta property="og:description" content="${esc(rec.metaDescription)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:site_name" content="NoonCoupons"><script type="application/ld+json" data-schema="article">${safeJson(graph)}</script>${pageCss()}`;
  const phaseLabel=rec.canary?'canary':'controlled expansion';
  const body=`<header class="top"><div class="topin"><div class="brand"><a href="/en/${rec.country==='SA'?'saudi':'uae'}">NoonCoupons</a></div><nav><a href="${countryPath}">${countryLabel}</a><a href="${categoryPath}">Category</a><a href="/${rec.country==='SA'?'saudi':'uae'}">العربية</a></nav></div></header><main class="wrap"><div class="canary-note">Native English guide · ${phaseLabel} · quality-gated · coupon-first</div>${raw}</main>${copyJs()}`;
  return new Response(`<!doctype html><html lang="en" dir="ltr"><head>${head}</head><body>${body}</body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','content-language':'en','x-english-canary':'v1','x-english-phase':rec.canary?'canary':'controlled','x-robots-tag':'index, follow','x-content-type-options':'nosniff'}});
}

export async function englishCanarySitemap(env,origin){
  const state=await readState(env),rows=(state.records||[]).filter(r=>r.indexable!==false&&r.languageSource==='native-intent-v6-canary');
  const urls=rows.map(r=>`<url><loc>${xmlEsc(origin+r.urlPath)}</loc><lastmod>${xmlEsc(r.updatedAt||r.createdAt)}</lastmod></url>`).join('');
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

export const ENGLISH_CANARY_INFO={version:3,maxArticles:2,controlledMaxArticles:MAX_CONTROLLED_TOTAL,dailyMaxArticles:MAX_DAILY_TARGET,diversityWindow:DIVERSITY_WINDOW,stateKey:STATE_KEY,builder:6,route:'/en/articles/:slug',sitemap:'/sitemap-en-articles.xml',qualityThreshold:95,jaccardThreshold:0.18};
