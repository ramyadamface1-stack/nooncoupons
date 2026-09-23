import app from './public-entry.js';
import {commerceLanding,commerceArticlePathHtml,commerceNavHtml,commerceSitemap,augmentCommerceSitemap,COMMERCE_TAXONOMY_INFO} from './commerce-pages-v2.js';
import {commercePaths} from './commerce-taxonomy.js';
import {COMMERCE_GENERATOR_INFO,commerceCoverageTarget} from './commerce-generator-taxonomy.js';
import {enhanceLandingPage,LANDING_CONTENT_V3} from './landing-content-v3.js';
import {enhanceSpecialtyLanding,LANDING_SPECIALTY_V4} from './landing-specialty-v4.js';
import {serveEnglishCanaryArticle,serveEnglishCanaryHealth,englishCanaryHealth,englishCanarySitemap} from './english-canary.js';
import {serveEnglishCanaryRepairHealth} from './english-canary-repair.js';
import {readCouponR2MigrationState} from './coupon-r2-migration.js';
import {APPROVED_COUPON_CODES} from './approved-coupons.js';
export {ControlPlane,GeneratorControl} from './public-entry.js';

async function r2json(env,key,fallback){try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}}
const R2_COUNT_SNAPSHOT_KEY='_ops/article-count.json';
const CORPUS_AUDIT_STATE_KEY='maintenance/article-corpus-audit-v4.json';
const ARTICLE_DISCOVERY_CURRENT_KEY='maintenance/article-discovery-v1/current.json';
const R2_COUNT_TTL_MS=300000;
let r2CountCache={snapshot:null,at:0};
async function readR2CountSnapshot(env){
  try{
    const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(R2_COUNT_SNAPSHOT_KEY):null;
    if(!o)return null;
    const x=await o.json(),count=Number(x?.count),countedAt=String(x?.countedAt||'');
    if(!Number.isFinite(count)||count<0||!countedAt)return null;
    return {count,countedAt,source:String(x?.source||'legacy-snapshot'),version:Number(x?.version||1),complete:x?.complete===true,auditVersion:Number(x?.auditVersion||0)||null,auditModel:x?.auditModel||null,runId:x?.runId||null,readFailures:Number(x?.readFailures||0),listCalls:Number(x?.listCalls||0)||null,listedObjects:Number(x?.listedObjects||0)||null};
  }catch{return null}
}
async function writeR2CountSnapshot(env,snapshot){
  try{
    if(env.CONTENT_FINAL)await env.CONTENT_FINAL.put(R2_COUNT_SNAPSHOT_KEY,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  }catch{}
}
async function completedAuditSnapshot(env){
  try{
    const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(CORPUS_AUDIT_STATE_KEY):null;
    if(!o)return null;
    const x=await o.json();
    if(x?.done!==true||x?.scanDone!==true||Number(x?.readFailures||0)!==0||!Number.isFinite(Number(x?.scanned)))return null;
    const countedAt=String(x.completedAt||x.lastBatchAt||new Date().toISOString());
    return {count:Number(x.scanned),countedAt,source:'article-corpus-audit-v4',version:2,complete:true,auditVersion:4,auditModel:x.auditModel||'rendered-live-v4',runId:x.runId||null,readFailures:0,listCalls:Number(x.listCalls||0)||null,listedObjects:Number(x.listedObjects||0)||null};
  }catch{return null}
}
async function countR2ArticleHtml(env,{fresh=false}={}){
  if(!env.CONTENT_FINAL)return {count:null,countedAt:null,cached:false,ageSeconds:null,complete:false,source:null,stale:true,reason:'r2_binding_missing'};
  const now=Date.now();
  if(!fresh&&r2CountCache.snapshot&&now-r2CountCache.at<R2_COUNT_TTL_MS){
    const snap=r2CountCache.snapshot,snapAt=Date.parse(snap.countedAt||'');
    return {...snap,cached:true,ageSeconds:Number.isFinite(snapAt)?Math.max(0,Math.floor((now-snapAt)/1000)):null,stale:Number.isFinite(snapAt)?now-snapAt>R2_COUNT_TTL_MS:true};
  }
  let snap=await readR2CountSnapshot(env);
  if(fresh){
    const audit=await completedAuditSnapshot(env);
    if(audit&&(!snap||Date.parse(audit.countedAt||'')>=Date.parse(snap.countedAt||''))){
      snap=audit;
      await writeR2CountSnapshot(env,audit);
    }
  }
  if(snap){
    const snapAt=Date.parse(snap.countedAt||'');
    r2CountCache={snapshot:snap,at:now};
    return {...snap,cached:true,ageSeconds:Number.isFinite(snapAt)?Math.max(0,Math.floor((now-snapAt)/1000)):null,stale:Number.isFinite(snapAt)?now-snapAt>R2_COUNT_TTL_MS:true};
  }
  return {count:null,countedAt:null,cached:false,ageSeconds:null,complete:false,source:null,stale:true,reason:'count_snapshot_missing_run_full_corpus_audit'};
}
const dec=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
const xmlEsc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&apos;');
function hardened(res){const h=new Headers(res.headers);h.set('x-content-type-options','nosniff');h.set('referrer-policy','strict-origin-when-cross-origin');h.set('x-frame-options','SAMEORIGIN');h.set('permissions-policy','camera=(), microphone=(), geolocation=()');h.set('strict-transport-security','max-age=31536000');return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h})}
function articleMoneyHub(rec={}){const ae=rec.country==='AE',base=ae?'/uae':'/saudi-arabia',country=ae?'الإمارات':'السعودية';return `<aside id="article-money-hub" dir="rtl" style="margin:28px auto;padding:20px;border:1px solid #e5e7eb;border-radius:18px;background:#fff7ed;max-width:1050px;font-family:Tahoma,Arial,sans-serif"><strong>تبحث عن كود نون ${country} قبل الدفع؟</strong><p style="line-height:1.8;color:#475569">انتقل إلى الصفحة الأساسية المخصصة للأكواد بدل الاعتماد على مقال واحد؛ ستجد روابط الأكواد وطريقة التحقق من الأهلية داخل السلة.</p><p><a href="${base}/noon-coupon-code" style="font-weight:900;color:#5b21b6">كود خصم نون ${country}</a> · <a href="${base}/noon-coupon-code-today">أكواد اليوم</a> · <a href="${base}/noon-coupon-code-2026">أكواد 2026</a></p></aside>`}
async function appendArticleCommerce(req,env,res){if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;const u=new URL(req.url),slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');if(!slug)return res;const latest=await r2json(env,'bulk/latest.json',{articles:[]});let rec=(latest.articles||[]).find(a=>a?.slug===slug)||null;if(!rec){try{const o=await env.CONTENT_FINAL?.head('articles/'+slug+'.html'),md=o?.customMetadata||{};rec={slug,country:md.c||md.country||'SA',title:md.t?dec(md.t):(md.title||slug),primaryKeyword:md.kw?dec(md.kw):'',categoryKey:md.cat||null,brandKey:md.bk||null,modelKey:md.mk||null,comparisonKey:md.ck||null,landingPath:md.lp||null}}catch{rec={slug,country:'SA',title:slug}}}let html=await res.text();if(!html.includes('id="article-commerce-path"'))html=html.replace(/<\/body>/i,commerceArticlePathHtml(rec||{slug})+'</body>');if(!html.includes('id="article-money-hub"'))html=html.replace(/<\/body>/i,articleMoneyHub(rec||{})+'</body>');const h=new Headers(res.headers);h.delete('content-length');h.set('x-commerce-article-path','v4');h.set('x-money-hub','country-intent-v2');if(rec?.landingPath)h.set('x-commerce-landing-path',rec.landingPath);return new Response(html,{status:res.status,statusText:res.statusText,headers:h})}
async function appendHomeCommerce(req,res){return res}
function mergeCommerceIntoMainSitemap(xml,origin){let text=augmentCommerceSitemap(String(xml||''),origin);if(/<sitemapindex\b/i.test(text)){if(!text.includes('/sitemap-commerce.xml'))text=text.replace(/<\/sitemapindex>/i,`<sitemap><loc>${xmlEsc(origin)}/sitemap-commerce.xml</loc></sitemap></sitemapindex>`);if(!text.includes('/sitemap-money.xml'))text=text.replace(/<\/sitemapindex>/i,`<sitemap><loc>${xmlEsc(origin)}/sitemap-money.xml</loc></sitemap></sitemapindex>`);if(!text.includes('/sitemap-en-articles.xml'))text=text.replace(/<\/sitemapindex>/i,`<sitemap><loc>${xmlEsc(origin)}/sitemap-en-articles.xml</loc></sitemap></sitemapindex>`);return text}if(/<urlset\b/i.test(text)){const rows=commercePaths().filter(path=>!text.includes(origin+path)).map(path=>`<url><loc>${xmlEsc(origin+path)}</loc></url>`).join('');return text.replace(/<\/urlset>/i,rows+'</urlset>')}return text}
async function augmentSitemapResponse(req,env,res){if(!res.ok||new URL(req.url).pathname!=='/sitemap.xml')return res;const type=(res.headers.get('content-type')||'').toLowerCase();if(!type.includes('xml'))return res;const origin=env.SITE_ORIGIN||new URL(req.url).origin,text=mergeCommerceIntoMainSitemap(await res.text(),origin),h=new Headers(res.headers);h.delete('content-length');h.set('x-commerce-sitemap','v4');h.set('x-commerce-routes',String(COMMERCE_TAXONOMY_INFO.routes));return new Response(text,{status:res.status,statusText:res.statusText,headers:h})}
function permanentRedirect(to){return new Response(null,{status:301,headers:{location:to,'cache-control':'public, max-age=3600','x-seo-migration':'saudi-country-hub-v2'}})}
async function health(env){const latest=await r2json(env,'bulk/latest.json',{articles:[]}),rows=(latest.articles||[]).slice(0,200),explicit=rows.filter(a=>a?.categoryKey&&a?.landingPath),brand=rows.filter(a=>a?.brandKey),model=rows.filter(a=>a?.modelKey),comparison=rows.filter(a=>a?.comparisonKey),high=rows.filter(a=>a?.commercialPriority==='high'),categoryDirect=rows.filter(a=>a?.landingPath&&/\/(saudi|uae)\/category\//.test(a.landingPath)),brandDirect=rows.filter(a=>a?.landingPath&&/\/(saudi|uae)\/brand\//.test(a.landingPath)),modelDirect=rows.filter(a=>a?.landingPath&&/\/(saudi|uae)\/model\//.test(a.landingPath)),comparisonDirect=rows.filter(a=>a?.landingPath&&/\/(saudi|uae)\/compare\//.test(a.landingPath)),pct=n=>rows.length?Math.round(n/rows.length*100):0,sample=explicit[0]||null;return {ok:true,version:COMMERCE_TAXONOMY_INFO.version,...COMMERCE_TAXONOMY_INFO,generatorTaxonomy:COMMERCE_GENERATOR_INFO,landingContent:LANDING_CONTENT_V3,landingSpecialty:LANDING_SPECIALTY_V4,metadataCoverage:{checked:rows.length,explicit:explicit.length,percent:pct(explicit.length),brand:brand.length,brandPercent:pct(brand.length),model:model.length,modelPercent:pct(model.length),comparison:comparison.length,comparisonPercent:pct(comparison.length),commercialPriorityHigh:high.length,commercialPriorityHighPercent:pct(high.length),directLandingDistribution:{category:categoryDirect.length,categoryPercent:pct(categoryDirect.length),brand:brandDirect.length,brandPercent:pct(brandDirect.length),model:modelDirect.length,modelPercent:pct(modelDirect.length),comparison:comparisonDirect.length,comparisonPercent:pct(comparisonDirect.length)},coverageTargets:{priority:commerceCoverageTarget('mobiles'),standard:commerceCoverageTarget('electronics')},coverageStatus:(()=>{const actual={category:pct(categoryDirect.length),brand:pct(brandDirect.length),model:pct(modelDirect.length),comparison:pct(comparisonDirect.length)},target=commerceCoverageTarget('mobiles'),underTarget=Object.keys(actual).filter(k=>actual[k]<(target[k+'DirectMin']||0));return {actual,target,underTarget,balanced:underTarget.length===0}})()},latestExplicitSample:sample?{slug:sample.slug,country:sample.country,categoryKey:sample.categoryKey,brandKey:sample.brandKey||null,modelKey:sample.modelKey||null,comparisonKey:sample.comparisonKey||null,landingPath:sample.landingPath,quality:sample.quality,provider:sample.provider}:null,sitemap:'/sitemap-commerce.xml',mainSitemap:'/sitemap.xml',sitemapDiscovery:'main-index-or-direct-urlset',time:new Date().toISOString()}}

async function contentStats(req,env,ctx){
  let generator={};
  try{
    const u=new URL(req.url);u.pathname='/api/generator-health';u.search='';
    const r=await app.fetch(new Request(u.toString(),{method:'GET',headers:req.headers}),env,ctx);
    generator=await r.json();
  }catch{}
  let english={};
  try{english=await englishCanaryHealth(env)}catch{}
  let couponMigration={ok:false,done:false,scanned:0,updated:0,replaced:0};
  try{couponMigration=await readCouponR2MigrationState(env)}catch{}
  const freshCount=new URL(req.url).searchParams.get('fresh')==='1';
  const r2Count=await countR2ArticleHtml(env,{fresh:freshCount});
  const r2Uploaded=r2Count.count;
  const bulk=generator?.bulk||{};
  const controlled=english?.controlled||{};
  const arabic=Number(bulk.publishedTotal||0);
  const englishTotal=Number(controlled.published||0),trackedPublished=arabic+englishTotal,untrackedEstimate=r2Count.complete&&Number.isFinite(Number(r2Uploaded))?Math.max(0,Number(r2Uploaded)-trackedPublished):null;
  const discovery=await r2json(env,ARTICLE_DISCOVERY_CURRENT_KEY,null),auditQualified=discovery?.complete?Number(discovery.articles||0):null,auditCoverage=r2Count.complete&&auditQualified!=null&&Number(r2Uploaded)>0?Math.round(auditQualified/Number(r2Uploaded)*10000)/100:null;
  return {
    ok:true,total:trackedPublished,r2Uploaded,authoritativeAuditHtmlCount:r2Uploaded,liveTrackedPublished:trackedPublished,arabic,english:englishTotal,
    englishByCountry:{SA:Number(controlled.sa||0),AE:Number(controlled.ae||0)},
    publishedTodayArabic:Number(bulk.publishedToday||0),dailyTargetArabic:Number(bulk.dailyTarget||0),
    last:{slug:bulk.lastSlug||null,quality:bulk.lastQuality??null,wordCount:bulk.lastWordCount??null,run:bulk.lastRun||null,error:bulk.lastError||null},
    englishControlled:{target:Number(controlled.target||0),complete:Boolean(controlled.complete),remaining:Number(controlled.remaining||0),publishedToday:Number(controlled.publishedToday||0),dailyTarget:Number(controlled.dailyTarget||0),minIntervalMinutes:Number(controlled.minIntervalMinutes||0),nextEligibleAt:controlled.nextEligibleAt||null},
    source:'live-runtime',generatedAt:new Date().toISOString(),health:generator,
    couponMigration:{ok:Boolean(couponMigration?.ok),done:Boolean(couponMigration?.done),scanned:Number(couponMigration?.scanned||0),updated:Number(couponMigration?.updated||0),replaced:Number(couponMigration?.replaced||0),lastBatchAt:couponMigration?.lastBatchAt||null,completedAt:couponMigration?.completedAt||null},
    storageAudit:{trackedPublished,liveTrackedPublished:trackedPublished,r2HtmlObjects:r2Uploaded,authoritativeAuditHtmlCount:r2Uploaded,r2CountComplete:Boolean(r2Count.complete),untrackedEstimate,auditQualified,discoveryComplete:Boolean(discovery?.complete),discoveryShards:Number(discovery?.shards||0),discoveryPolicy:discovery?.policy||null,discoveryRunId:discovery?.runId||null,sourceAuditScanned:Number(discovery?.sourceAuditScanned||0)||null,auditCoveragePercent:auditCoverage,autoDelete:false,note:r2Count.complete?'Authoritative HTML-object snapshot from the last completed full corpus audit. It is not a live publication counter; use liveTrackedPublished for current generator growth. No automatic deletion.':'Legacy/incomplete audit snapshot; use liveTrackedPublished for current generator growth and do not use this snapshot for cleanup or live corpus totals.'},
    r2Count:{count:r2Uploaded,countedAt:r2Count.countedAt,cached:Boolean(r2Count.cached),ageSeconds:r2Count.ageSeconds??null,complete:Boolean(r2Count.complete),source:r2Count.source||null,version:r2Count.version||null,auditVersion:r2Count.auditVersion||null,auditModel:r2Count.auditModel||null,runId:r2Count.runId||null,stale:Boolean(r2Count.stale),reason:r2Count.reason||null,listCalls:r2Count.listCalls??null,listedObjects:r2Count.listedObjects??null,snapshotKey:R2_COUNT_SNAPSHOT_KEY,ttlSeconds:R2_COUNT_TTL_MS/1000}
  };
}

export default{
  async fetch(req,env,ctx){const u=new URL(req.url),path=u.pathname.replace(/\/+$/,'')||'/',origin=env.SITE_ORIGIN||u.origin;if(req.method==='GET'&&path==='/saudi-arabia')return hardened(permanentRedirect('/saudi'+u.search));if(req.method==='GET'&&/^\/saudi\/noon-coupon-code(?:-today|-2026)?$/.test(path))return hardened(permanentRedirect(path.replace(/^\/saudi\//,'/saudi-arabia/')+u.search));if(req.method==='GET'&&path==='/sitemap-commerce.xml')return hardened(commerceSitemap(origin));if(req.method==='GET'&&path==='/sitemap-en-articles.xml')return hardened(await englishCanarySitemap(env,origin));if(req.method==='GET'&&path==='/api/english-canary-health')return serveEnglishCanaryHealth(env);if(req.method==='GET'&&path==='/api/english-canary-repair-health')return serveEnglishCanaryRepairHealth(env);if(req.method==='GET'&&path.startsWith('/en/articles/')){const er=await serveEnglishCanaryArticle(req,env);if(er)return hardened(er)}if(req.method==='GET'&&path==='/api/admin/seo-overview'){
  const au=new URL(req.url);au.pathname='/api/admin/status';au.search='';
  const adminRes=await app.fetch(new Request(au.toString(),{method:'GET',headers:req.headers}),env,ctx);
  if(!adminRes.ok)return adminRes;
  const probe=async pathname=>{try{const x=new URL(req.url);x.pathname=pathname;x.search='';const r=await app.fetch(new Request(x.toString(),{method:'GET',headers:{accept:'*/*'}}),env,ctx);const body=await r.text();return {ok:r.ok,status:r.status,contentType:r.headers.get('content-type')||'',length:body.length,body:body.slice(0,12000)}}catch(e){return {ok:false,status:0,error:String(e?.message||e)}}};
  const [seo,robots,llms,sitemap,research,glossary,countries,auditState,discoveryState]=await Promise.all([
    probe('/api/seo-health'),probe('/robots.txt'),probe('/llms.txt'),probe('/sitemap.xml'),probe('/research'),probe('/glossary'),probe('/countries'),
    r2json(env,CORPUS_AUDIT_STATE_KEY,null),r2json(env,ARTICLE_DISCOVERY_CURRENT_KEY,null)
  ]);
  const has=(x,s)=>String(x?.body||'').includes(s);
  const checks={
    robotsPublic:robots.ok&&has(robots,'Allow: /'),
    sitemapDeclared:robots.ok&&has(robots,'Sitemap:'),
    sitemapHealthy:sitemap.ok&&/<(?:sitemapindex|urlset)\b/i.test(sitemap.body||''),
    llmsHealthy:llms.ok&&has(llms,'Approved coupon codes only:')&&has(llms,'/research')&&has(llms,'/glossary'),
    researchHealthy:research.ok&&has(research,'بيانات ومنهجية كوبونات نون'),
    glossaryHealthy:glossary.ok&&has(glossary,'DefinedTerm')&&has(glossary,'قاموس مصطلحات الكوبونات'),
    countriesHealthy:countries.ok&&has(countries,'نون السعودية والإمارات'),
    corpusAuditDone:Boolean(auditState?.done&&auditState?.scanDone&&Number(auditState?.readFailures||0)===0),
    corpusAuditProgress:{runId:auditState?.runId||null,scanned:Number(auditState?.scanned||0),uniqueArticles:Number(auditState?.uniqueArticles||0),readFailures:Number(auditState?.readFailures||0),scanDone:Boolean(auditState?.scanDone),done:Boolean(auditState?.done),wordBands:auditState?.wordBands||null,issues:auditState?.issues||{}},
    discoveryComplete:Boolean(discoveryState?.complete),
    discoveryArticles:discoveryState?.complete?Number(discoveryState?.articles||0):null,
    discoveryShards:discoveryState?.complete?Number(discoveryState?.shards||0):0,
    discoveryPolicy:discoveryState?.policy||null,
    auditArchiveReady:Boolean(discoveryState?.complete&&Number(discoveryState?.shards||0)>0),
    approvedCouponCount:APPROVED_COUPON_CODES.length,
    approvedCoupons:[...APPROVED_COUPON_CODES],
    indexNowEnabled:Boolean(seo.ok&&/"indexNowEnabled"\s*:\s*true/i.test(seo.body||'')),
    llmsUrl:(env.SITE_ORIGIN||new URL(req.url).origin)+'/llms.txt',
    sitemapUrl:(env.SITE_ORIGIN||new URL(req.url).origin)+'/sitemap.xml',
    researchUrl:(env.SITE_ORIGIN||new URL(req.url).origin)+'/research',
    glossaryUrl:(env.SITE_ORIGIN||new URL(req.url).origin)+'/glossary',
    countriesUrl:(env.SITE_ORIGIN||new URL(req.url).origin)+'/countries',
    auditArchiveUrl:(env.SITE_ORIGIN||new URL(req.url).origin)+'/blog/archive'
  };
  return new Response(JSON.stringify({ok:true,checks,probes:{seo:{ok:seo.ok,status:seo.status},robots:{ok:robots.ok,status:robots.status},llms:{ok:llms.ok,status:llms.status},sitemap:{ok:sitemap.ok,status:sitemap.status},research:{ok:research.ok,status:research.status},glossary:{ok:glossary.ok,status:glossary.status},countries:{ok:countries.ok,status:countries.status}},generatedAt:new Date().toISOString()},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}if(req.method==='GET'&&path==='/api/admin/live-overview'){
  const au=new URL(req.url);au.pathname='/api/admin/status';au.search='';
  const adminRes=await app.fetch(new Request(au.toString(),{method:'GET',headers:req.headers}),env,ctx);
  if(!adminRes.ok)return adminRes;
  const admin=await adminRes.json(),stats=await contentStats(req,env,ctx);
  return new Response(JSON.stringify({ok:true,admin,health:stats.health||{},contentStats:stats},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}if(req.method==='GET'&&path==='/api/article-count-health'){
  const fresh=new URL(req.url).searchParams.get('fresh')==='1',count=await countR2ArticleHtml(env,{fresh});
  return new Response(JSON.stringify({ok:true,...count,snapshotKey:R2_COUNT_SNAPSHOT_KEY,auditStateKey:CORPUS_AUDIT_STATE_KEY,ttlSeconds:R2_COUNT_TTL_MS/1000},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}if(req.method==='GET'&&path==='/api/content-stats')return new Response(JSON.stringify(await contentStats(req,env,ctx),null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});if(req.method==='GET'&&path==='/api/commerce-health')return new Response(JSON.stringify(await health(env),null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});if(req.method==='GET'){let landing=await commerceLanding(path,origin,env);if(landing){landing=await enhanceLandingPage(path,origin,landing,env);landing=await enhanceSpecialtyLanding(path,origin,landing);return hardened(landing)}}let res=await app.fetch(req,env,ctx);if(req.method==='GET'&&path.startsWith('/articles/'))res=await appendArticleCommerce(req,env,res);res=await appendHomeCommerce(req,res);res=await augmentSitemapResponse(req,env,res);return hardened(res)},
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
export const COMMERCE_ENTRY_INFO={version:17,seoAdminOverview:true,englishSchedulerOwner:false,entry:'commerce-entry',wraps:'public-entry',routes:COMMERCE_TAXONOMY_INFO.routes,articleBacklinks:true,homeNavigation:true,separateShoesAndBags:true,modelFamilyPages:true,explicitGeneratorTaxonomy:COMMERCE_GENERATOR_INFO.version,landingContent:LANDING_CONTENT_V3.version,landingSpecialty:LANDING_SPECIALTY_V4.version,minLandingWords:LANDING_CONTENT_V3.minWords,sitemapDiscovery:'main-index-or-direct-urlset'};