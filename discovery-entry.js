import {enableExistingDestinationR2} from './r2-remote-existing-bucket.js';
import {publishAiV2NativeArticle} from './ai-v2-native-publish-bridge.js';
import {reconcileAiV2Publication} from './ai-v2-publication-ledger.js';
import {nativeAiV2SitemapResponse} from './ai-v2-sitemap.js';
import app from './brand-runtime.js';
import {llms as canonicalCouponSourceGuide} from './final-platform.js';
import {brandDirectoryResponse,enrichHomepageSchema} from './brand-directory-schema.js';
import {emergencyPublicR2Response,nativeBoundAiV2ArticleFastResponse,nativeBoundLegacyCpuCanaryResponse,rescueSitemapIndexPaths,rescueSitemapResponse,prebuiltRescueSitemapResponse,rescueManifestInventory} from './r2-emergency-readonly.js';
import {runEnglishCanaryBatch,englishCanaryRecords,englishPublicRecentRecords} from './english-canary.js';
import {bulkTick,getGeneratorStatus,updateGeneratorStatus} from './admin-runtime.js';
import {runCouponR2MigrationBatch,readCouponR2MigrationState,runCouponR2AuditBatch,readCouponR2AuditState} from './coupon-r2-migration.js';
import {replaceUnapprovedCouponTokens,APPROVED_COUPON_CODES} from './approved-coupons.js';
import {readRecentPublicManifest} from './r2-public-manifest.js';
import {publicEdgeCacheEligible,publicEdgeTtlSeconds,publicEdgePolicyRevision} from './r2-public-cache-policy.js';
import {runArticleCorpusAuditBatch,readArticleCorpusAuditState,runArticleCollisionOwnerBatch,readArticleCollisionOwnerState,readArticleDiscoveryState} from './article-corpus-audit.js';
export {ControlPlane,GeneratorControl} from './brand-runtime.js';

const DISCOVERY_RELEASE='2026-11-03-live-r2-analytics-security-v20';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const enc=s=>encodeURI(String(s||''));
const CLOUDFLARE_ACCOUNT_ID='c82274152a942dea53044eae7153cfd7';
const AUDIT_DISCOVERY_CURRENT_KEY='maintenance/article-discovery-v1/current.json';

function couponFallbackForPath(pathname){
  return String(pathname||'').startsWith('/uae')?'NOV188':'NOV170';
}

async function sanitizeCouponSurface(req,res){
  if(!res||req.method==='HEAD')return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  const textual=['text/html','application/json','application/ld+json','image/svg+xml','text/plain','application/javascript','text/javascript'].some(x=>type.includes(x));
  if(!textual)return res;
  const body=await res.text();
  const fixed=replaceUnapprovedCouponTokens(body,couponFallbackForPath(new URL(req.url).pathname));
  const h=new Headers(res.headers);
  h.delete('content-length');
  if(fixed!==body)h.set('x-coupon-surface-sanitized','v1');
  h.set('x-coupon-allowlist','nov-owner-v1');
  return new Response(fixed,{status:res.status,statusText:res.statusText,headers:h});
}

async function verifyMaintenanceToken(req){
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+/i.test(auth))return false;
  try{
    const check=await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/services/nooncoupons`,{
      headers:{authorization:auth,'content-type':'application/json'}
    });
    if(!check.ok)return false;
    const body=await check.json();
    return body?.success===true;
  }catch{return false}
}

async function latest(env){return readRecentPublicManifest(env)}

function cairoDayKey(value,fallback=''){
  if(!value)return fallback;
  try{
    const d=new Date(value);if(Number.isNaN(d.getTime()))return fallback;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(x=>x.type===t)?.value||'';
    const y=get('year'),m=get('month'),day=get('day');
    return y&&m&&day?`${y}-${m}-${day}`:fallback;
  }catch{return fallback}
}
function isoDayAdd(day,delta){
  const d=new Date(String(day)+'T00:00:00Z');if(Number.isNaN(d.getTime()))return day;
  d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);
}
async function dailyPublishReport(env,from,to){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return {ok:false,error:'invalid_range'};
  const span=Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)+1;
  if(span<1||span>45)return {ok:false,error:'range_too_large'};
  const daysObj=await env.CONTENT_FINAL.get('bulk/days.json');
  const manifest=daysObj?await daysObj.json():{days:[]};
  const sourceFrom=isoDayAdd(from,-1),sourceTo=isoDayAdd(to,1);
  const rows=(manifest.days||[]).filter(x=>x?.day>=sourceFrom&&x?.day<=sourceTo&&Number(x?.count)>0);
  const out=new Map();
  for(let d=from;d<=to;d=isoDayAdd(d,1))out.set(d,{day:d,saudiArabic:0,uaeArabic:0,uaeEnglish:0,total:0,bulkArchiveDayCount:0});
  const seenBulk=new Set();
  for(const row of rows){
    if(out.has(row.day))out.get(row.day).bulkArchiveDayCount=Number(row.count)||0;
    const shards=Math.max(0,Number(row.shards)||Math.ceil(Number(row.count||0)/100));
    for(let shard=0;shard<shards;shard++){
      const obj=await env.CONTENT_FINAL.get(`bulk/day/${row.day}/${shard}.json`);
      if(!obj)continue;
      const data=await obj.json();
      for(const a of (data.articles||[])){
        if(!a?.slug)continue;
        const unique=String(a.slug);
        if(seenBulk.has(unique))continue;
        seenBulk.add(unique);
        const day=cairoDayKey(a.publishedAt||a.createdAt||a.updatedAt,row.day);
        const rec=out.get(day);if(!rec)continue;
        if(a.country==='AE')rec.uaeArabic++;else rec.saudiArabic++;
      }
    }
  }
  let english=[];
  try{english=await englishCanaryRecords(env)}catch{}
  for(const a of (english||[])){
    if(!a?.slug||a.status!=='published')continue;
    const day=cairoDayKey(a.publishedAt||a.createdAt||a.updatedAt,'');
    const rec=out.get(day);if(rec)rec.uaeEnglish++;
  }
  const result=[...out.values()].map(x=>({...x,uaeTotal:x.uaeArabic+x.uaeEnglish,total:x.saudiArabic+x.uaeArabic+x.uaeEnglish}));
  return {ok:true,timeZone:'Africa/Cairo',from,to,days:result,totals:result.reduce((a,x)=>({saudi:a.saudi+x.saudiArabic,uaeArabic:a.uaeArabic+x.uaeArabic,uaeEnglish:a.uaeEnglish+x.uaeEnglish,uae:a.uae+x.uaeTotal,total:a.total+x.total}),{saudi:0,uaeArabic:0,uaeEnglish:0,uae:0,total:0})};
}

function keyPages(origin){
  return [
    '/',
    '/coupons',
    '/en/coupons',
    '/en/uae/saving-guide',
    '/blog',
    '/blog/saudi',
    '/blog/uae',
    '/brands',
    '/saudi',
    '/uae',
    '/saudi/categories',
    '/uae/categories',
    '/saudi/shopping-guide',
    '/uae/shopping-guide',
    '/saudi/category/mobiles',
    '/saudi/category/audio',
    '/saudi/category/gifts',
    '/saudi/category/home-kitchen',
    '/saudi/brand/puma',
    '/saudi/brand/adidas',
    '/saudi/brand/braun',
    '/saudi/brand/philips',
    '/saudi/brand/versace',
    '/saudi/brand/sony',
    '/saudi/model/samsung/galaxy-s',
    '/guide/noon-yellow-friday',
    '/saudi-arabia/noon-coupon-code',
    '/uae/noon-coupon-code',
    '/editorial-policy',
    '/coupon-verification',
    '/guide/noon-refund-credit',
    '/guide/philips-lumea-warranty-safety',
    '/authors/editorial-team',
    '/about',
    '/privacy',
    '/research',
    '/glossary',
    '/countries',
    // Lightweight indexable coupon detail URLs: no R2 scan required.
    ...APPROVED_COUPON_CODES.map(code=>'/coupon/'+code.toLowerCase())
  ].map(path=>({loc:origin+path,lastmod:null}));
}

function marketForPath(path){
  if(path==='/uae'||path.startsWith('/uae/'))return 'AE';
  if(path==='/saudi'||path.startsWith('/saudi/')||path.startsWith('/saudi-arabia/'))return 'SA';
  return null;
}
function discoveryEligible(a){
  if(!a?.slug||a.status!=='published'||a.indexable===false||a.superseded===true||a.orphan===true||a.duplicateIntent===true)return false;
  const quality=Number(a.quality),floor=Number(a.qualityFloor);
  if(!Number.isFinite(quality)||quality<95)return false;
  if(a.qualityFloor!=null&&(!Number.isFinite(floor)||floor<88))return false;
  const minWords=a.languageSource==='native-intent-v6-canary'?900:1500;if(a.wordCount!=null&&Number(a.wordCount)<minWords)return false;
  if(Array.isArray(a.p0)&&a.p0.length)return false;
  if(a.indexation&&a.indexation.indexable===false)return false;
  return true;
}
function articleHref(a){
  const explicit=String(a?.urlPath||'').trim();
  if(explicit.startsWith('/'))return explicit;
  return a?.languageSource==='native-intent-v6-canary'?'/en/articles/'+enc(a.slug):'/articles/'+enc(a.slug);
}
function discoveryRows(articles,market){
  const sorted=(articles||[])
    .filter(discoveryEligible)
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  if(market)return sorted.filter(a=>a.country===market).slice(0,8);
  const selected=[],seen=new Set();
  for(const country of ['SA','AE']){
    for(const a of sorted.filter(row=>row.country===country).slice(0,4)){
      const href=articleHref(a);
      if(seen.has(href))continue;
      seen.add(href);selected.push(a);
    }
  }
  for(const a of sorted){
    if(selected.length>=8)break;
    const href=articleHref(a);
    if(seen.has(href))continue;
    seen.add(href);selected.push(a);
  }
  return selected
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))
    .slice(0,8);
}
function discoveryHtml(path,articles){
  const market=marketForPath(path);
  const rows=discoveryRows(articles,market);
  if(!rows.length)return '';
  const country=market==='AE'?'الإمارات':market==='SA'?'السعودية':'السعودية والإمارات';
  const cards=rows.map(a=>{
    const m=a.country==='AE'?'الإمارات':'السعودية';
    const title=esc(a.title||a.primaryKeyword||a.slug);
    const desc=esc((a.metaDescription||'دليل عملي قبل الشراء واستخدام الكوبون.').slice(0,115));
    const href=articleHref(a);
    return `<article class="dl-card"><small>${m}</small><h3><a href="${href}">${title}</a></h3><p>${desc}</p><a class="dl-read" href="${href}">اقرأ المقال ←</a></article>`;
  }).join('');
  return `<section id="crawl-discovery-links" class="latest-editorial" dir="rtl" aria-label="أحدث مقالات نون"><style>.latest-editorial{padding:42px 0;background:#fff}.dl-wrap{width:min(1180px,92%);margin:auto}.dl-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:20px}.dl-head h2{margin:0;font:900 29px Tahoma,Arial,sans-serif;color:#101828}.dl-head p{margin:7px 0 0;color:#667085;line-height:1.8}.dl-head>a{font-weight:900;color:#111827;text-decoration:none}.dl-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.dl-card{border:1px solid #e7e9ee;border-radius:16px;padding:17px;background:#fff}.dl-card small{color:#7a6400;font-weight:900}.dl-card h3{font:900 17px/1.65 Tahoma,Arial,sans-serif;margin:8px 0}.dl-card h3 a,.dl-read{text-decoration:none;color:#111827}.dl-card p{color:#667085;font:13px/1.8 Tahoma,Arial,sans-serif}.dl-read{font-weight:900}@media(max-width:900px){.dl-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.dl-grid{grid-template-columns:1fr}.dl-head{display:block}}</style><div class="dl-wrap"><div class="dl-head"><div><small style="color:#7a6400;font-weight:900">من المدونة</small><h2>أحدث مقالات نون ${country}</h2><p>أدلة جديدة عن الكوبونات والأقسام وقرارات الشراء قبل الدفع.</p></div><a href="/blog">كل المقالات ←</a></div><div class="dl-grid">${cards}</div></div></section>`;
}

async function injectDiscoveryLinks(req,env,res){
  if(!res.ok||req.method!=='GET')return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html'))return res;
  const path=new URL(req.url).pathname.replace(/\/+$/,'')||'/';
  const eligible=['/','/coupons','/blog','/saudi','/uae','/saudi/shopping-guide','/uae/shopping-guide'].includes(path)||/^\/(?:saudi-arabia|uae)\/noon-coupon-code$/.test(path);
  if(!eligible)return res;
  let html=await res.text();
  if(html.includes('id="crawl-discovery-links"'))return res;
  const data=await latest(env);
  let english=[];
  try{english=await englishPublicRecentRecords(env)}catch{}
  const block=discoveryHtml(path,[...(data.articles||[]),...(english||[])]);
  if(!block)return new Response(html,{status:res.status,statusText:res.statusText,headers:res.headers});
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,block+'</body>'):html+block;
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-crawl-discovery-links','v2');h.set('x-discovery-manifest-cache','120s-isolate');h.set('x-discovery-market-mix','balanced-sa-ae-with-english');
  return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
}

export function coreSitemap(origin){
  const extra=[
    '/en/saudi',
    '/en/uae',
    '/en/saudi/noon-coupon-code',
    '/en/uae/noon-coupon-code',
    '/en/saudi/category/mobiles',
    '/en/uae/category/grocery'
  ];
  const seen=new Set(),rows=[];
  for(const row of [...keyPages(origin),...extra.map(path=>({loc:origin+path,lastmod:null}))]){
    if(seen.has(row.loc))continue;
    seen.add(row.loc);rows.push(row);
  }
  const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(x=>`<url><loc>${esc(x.loc)}</loc></url>`).join('')}</urlset>`;
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400','x-robots-tag':'all','x-core-sitemap':'v1','x-core-sitemap-count':String(rows.length)}});
}

// CPU-safe sitemap projection. The full English state can grow to tens of
// thousands of entries; parsing it during a public sitemap GET caused
// intermittent Cloudflare Worker 1102 CPU errors. Source archives stay intact
// and remain covered by independent canonical R2/native sitemap shards.
export async function boundedEnglishSitemapRecords(env){
  try{
    const object=await env?.CONTENT_FINAL?.get('english-canary/public-recent-v1.json');
    if(!object)return [];
    const data=await object.json();
    if(data?.version!==1||!Array.isArray(data.articles))return [];
    return data.articles.slice(-500).filter(discoveryEligible);
  }catch{return []}
}

export async function prioritySitemap(env,origin){
  const data=await latest(env);
  const articles=(data.articles||[])
    .filter(discoveryEligible)
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))
    .slice(0,500)
    .map(a=>({loc:origin+'/articles/'+enc(a.slug),lastmod:a.updatedAt||a.createdAt||null}));
  const english=await boundedEnglishSitemapRecords(env);
  const englishArticles=english
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))
    .slice(0,500)
    .map(a=>({loc:origin+(a.urlPath||('/en/articles/'+enc(a.slug))),lastmod:a.updatedAt||a.createdAt||null}));
  const englishPages=[
    {loc:origin+'/en/coupons',lastmod:null},
    {loc:origin+'/en/uae/saving-guide',lastmod:null},
    {loc:origin+'/en/saudi',lastmod:null},
    {loc:origin+'/en/uae',lastmod:null},
    {loc:origin+'/en/saudi/noon-coupon-code',lastmod:null},
    {loc:origin+'/en/uae/noon-coupon-code',lastmod:null},
    {loc:origin+'/en/saudi/category/mobiles',lastmod:null}
  ];
  for(const [country,market] of [['SA','saudi'],['AE','uae']]){
    const marketRows=english.filter(a=>a.country===country);
    if(!marketRows.length)continue;
    englishPages.push({loc:origin+'/en/'+market,lastmod:null});
    englishPages.push({loc:origin+'/en/'+market+'/noon-coupon-code',lastmod:marketRows.map(a=>a.updatedAt||a.createdAt||'').sort().slice(-1)[0]||null});
    const byCategory=new Map();
    for(const a of marketRows){if(a.categoryKey)byCategory.set(a.categoryKey,(byCategory.get(a.categoryKey)||0)+1)}
    for(const [categoryKey,count] of byCategory)if(count>=3)englishPages.push({loc:origin+'/en/'+market+'/category/'+encodeURIComponent(categoryKey),lastmod:null});
    if(country==='AE'){
      const productHubs=[
        ['iphone-18-pro-max',/iphone\s*18\s*pro\s*max/i],
        ['iphone-duo',/iphone\s*duo/i],
        ['samsung-galaxy-s26-ultra',/samsung\s*(?:galaxy\s*)?s26\s*ultra/i]
      ];
      for(const [key,pattern] of productHubs){
        const matches=marketRows.filter(a=>pattern.test(String(a.title||'')+' '+String(a.primaryKeyword||'')));
        if(matches.length>=2)englishPages.push({loc:origin+'/en/uae/product/'+key,lastmod:matches.map(a=>a.updatedAt||a.createdAt||'').sort().slice(-1)[0]||null});
      }
    }
  }
  const auditArchive=[];
  try{
    const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(AUDIT_DISCOVERY_CURRENT_KEY):null;
    const d=o?await o.json():null;
    if(d?.complete&&Number(d?.version)===1&&Number(d?.shards||0)>0)auditArchive.push({loc:origin+'/blog/archive',lastmod:d.generatedAt||null});
  }catch{}
  const seen=new Set(),rows=[];
  for(const row of [...keyPages(origin),...auditArchive,...englishPages,...articles,...englishArticles]){
    if(seen.has(row.loc))continue;
    seen.add(row.loc);rows.push(row);
  }
  const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(x=>`<url><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:''}</url>`).join('')}</urlset>`;
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900, stale-while-revalidate=86400','x-robots-tag':'all','x-priority-sitemap-count':String(rows.length),'x-priority-sitemap':'v2','x-english-priority-count':String(englishArticles.length),'x-english-priority-hubs':String(englishPages.length)}});
}

export async function hubSitemap(env,origin){
  const data=await latest(env);
  const rows=new Map();
  const add=(path,lastmod=null)=>{
    if(!path||!String(path).startsWith('/'))return;
    const loc=origin+path;
    const prev=rows.get(loc);
    if(!prev||String(lastmod||'')>String(prev.lastmod||''))rows.set(loc,{loc,lastmod:lastmod||prev?.lastmod||null});
  };
  for(const a of (data.articles||[]).filter(discoveryEligible)){
    const market=a.country==='AE'?'uae':'saudi';
    const lastmod=a.updatedAt||a.createdAt||null;
    add('/'+market,lastmod);add('/'+market+'/categories',lastmod);
    if(a.categoryKey)add('/'+market+'/category/'+encodeURIComponent(a.categoryKey),lastmod);
    if(a.brandKey)add('/'+market+'/brand/'+encodeURIComponent(a.brandKey),lastmod);
    if(a.brandKey&&a.modelKey)add('/'+market+'/model/'+encodeURIComponent(a.brandKey)+'/'+encodeURIComponent(a.modelKey),lastmod);
    if(a.landingPath&&String(a.landingPath).startsWith('/'))add(String(a.landingPath),lastmod);
  }
  add('/en/coupons');add('/en/uae/saving-guide');add('/en/saudi');add('/en/uae');add('/en/saudi/noon-coupon-code');add('/en/uae/noon-coupon-code');add('/en/saudi/category/mobiles');
  const english=await boundedEnglishSitemapRecords(env);
  for(const a of english){
    const market=a.country==='AE'?'uae':'saudi',lastmod=a.updatedAt||a.createdAt||null;
    add('/en/'+market,lastmod);
    add('/en/'+market+'/noon-coupon-code',lastmod);
    if(a.categoryKey)add('/en/'+market+'/category/'+encodeURIComponent(a.categoryKey),lastmod);
    if(a.country==='AE'){
      const hay=String(a.title||'')+' '+String(a.primaryKeyword||'');
      if(/iphone\s*18\s*pro\s*max/i.test(hay))add('/en/uae/product/iphone-18-pro-max',lastmod);
      if(/iphone\s*duo/i.test(hay))add('/en/uae/product/iphone-duo',lastmod);
      if(/samsung\s*(?:galaxy\s*)?s26\s*ultra/i.test(hay))add('/en/uae/product/samsung-galaxy-s26-ultra',lastmod);
    }
  }
  const out=[...rows.values()].slice(0,10000);
  const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${out.map(x=>`<url><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:''}</url>`).join('')}</urlset>`;
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900, stale-while-revalidate=86400','x-robots-tag':'all','x-hub-sitemap':'v1','x-hub-sitemap-count':String(out.length)}});
}

// The legacy English sitemap read a large restored R2 segment and occasionally
// hit Worker 1102. Public bounded discovery is only a recent projection.
// The independent rescue shard sitemaps in the root index retain historic
// complete article coverage; do not alter or remove those URLs.
export async function englishRecentSitemap(env,origin){
  const rows=await boundedEnglishSitemapRecords(env);
  const seen=new Set(),entries=[];
  for(const a of rows){
    const path=articleHref(a);
    if(!path.startsWith('/en/articles/')||seen.has(path))continue;
    seen.add(path);
    const updated=a.updatedAt||a.createdAt||null;
    entries.push('<url><loc>'+esc(origin+path)+'</loc>'+(updated?'<lastmod>'+esc(updated)+'</lastmod>':'')+'</url>');
  }
  const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.join('')+'</urlset>';
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8',
    'cache-control':'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
    'x-robots-tag':'all','x-english-sitemap-source':'public-recent-projection-v1',
    'x-english-sitemap-count':String(entries.length)}});
}

export async function imageSitemap(env,origin){
  const data=await latest(env);
  const english=await boundedEnglishSitemapRecords(env);
  const source=[...(data.articles||[]),...(english||[])].filter(discoveryEligible)
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,500);
  const rows=source.map(a=>{
    const page=origin+articleHref(a),coupon=String(a.coupon||a.code||''),country=a.country==='AE'?'AE':'SA',title=String(a.title||a.primaryKeyword||a.slug);
    const images=[2,3].map(v=>origin+'/assets/coupon-svg/'+enc(a.slug)+'/'+v+'.svg?v=9&coupon='+encodeURIComponent(coupon)+'&country='+country);
    return `<url><loc>${esc(page)}</loc>${images.map(src=>`<image:image><image:loc>${esc(src)}</image:loc><image:title>${esc(title)}</image:title></image:image>`).join('')}</url>`;
  }).join('');
  const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${rows}</urlset>`;
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900, stale-while-revalidate=86400','x-robots-tag':'all','x-image-sitemap':'v1','x-image-sitemap-pages':String(source.length)}});
}

async function augmentRootSitemap(res,origin,env){
  if(!res.ok)return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('xml'))return res;
  let body=await res.text();
  if(/<sitemapindex\b/i.test(body)){
    const additions=[
      ['core',origin+'/sitemap-core.xml'],
      ['priority',origin+'/sitemap-priority.xml'],
      ['english',origin+'/sitemap-en-articles.xml'],
      ['hubs',origin+'/sitemap-hubs.xml'],
      ['images',origin+'/sitemap-images.xml'],
      ['native',origin+'/sitemap-ai-v2.xml']
    ];
    // Static, quality-gated R2 segments stay fetchable while the old account R2 is suspended.
    // Avoid modifying original article URLs or listing draft/scheduled items.
    try{
      for(const path of await rescueSitemapIndexPaths(env)){
        const loc=origin+path;
        if(!body.includes(loc))additions.push(['rescue',loc]);
      }
    }catch(error){console.warn('rescue_sitemap_index_unavailable',String(error?.message||error).slice(0,80))}
    for(const [,loc] of additions){
      if(!body.includes(loc))body=body.replace(/<\/sitemapindex>/i,`<sitemap><loc>${esc(loc)}</loc></sitemap></sitemapindex>`);
    }
  }
  const h=new Headers(res.headers);
  h.delete('content-length');
  h.set('x-priority-sitemap-discovery','v2');
  h.set('x-english-sitemap-discovery','v1');
  h.set('x-hub-sitemap-discovery','v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}

async function augmentRobots(res,origin){
  if(!res.ok)return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(type&&!type.includes('text/plain'))return res;
  let body=await res.text();
  const root=`Sitemap: ${origin}/sitemap.xml`;
  const core=`Sitemap: ${origin}/sitemap-core.xml`;
  const priority=`Sitemap: ${origin}/sitemap-priority.xml`;
  const english=`Sitemap: ${origin}/sitemap-en-articles.xml`;
  const hubs=`Sitemap: ${origin}/sitemap-hubs.xml`;
  const images=`Sitemap: ${origin}/sitemap-images.xml`;
  const native=`Sitemap: ${origin}/sitemap-ai-v2.xml`;
  if(!body.includes(root))body=(body.trimEnd()+`\n${root}\n`).replace(/^\n+/, '');
  if(!body.includes(core))body=(body.trimEnd()+`\n${core}\n`).replace(/^\n+/, '');
  if(!body.includes(priority))body=(body.trimEnd()+`\n${priority}\n`).replace(/^\n+/, '');
  if(!body.includes(english))body=(body.trimEnd()+`\n${english}\n`).replace(/^\n+/, '');
  if(!body.includes(hubs))body=(body.trimEnd()+`\n${hubs}\n`).replace(/^\n+/, '');
  if(!body.includes(images))body=(body.trimEnd()+`\n${images}\n`).replace(/^\n+/, '');
  if(!body.includes(native))body=(body.trimEnd()+`\n${native}\n`).replace(/^\n+/, '');
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-priority-sitemap-robots','v1');h.set('x-english-sitemap-robots','v1');h.set('x-hub-sitemap-robots','v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}

// A full 15-route XML self-crawl in ONE Worker invocation exceeded Cloudflare
// Free CPU (1102). Split it into explicit 3-route read-only probe windows.
// The default critical group checks the public root, core and native AI V2
// manifests. A passing group is NOT described as a 15-route full audit.
export const SITEMAP_HEALTH_PROBE_GROUPS=Object.freeze([
 ['/sitemap.xml','/sitemap-core.xml','/sitemap-ai-v2.xml'],
 ['/sitemap-pages.xml','/sitemap-guides.xml','/sitemap-coupons.xml'],
 ['/sitemap-coupons-saudi.xml','/sitemap-coupons-uae.xml','/sitemap-priority.xml'],
 ['/sitemap-en-articles.xml','/sitemap-hubs.xml','/sitemap-images.xml'],
 ['/sitemap-commerce.xml','/sitemap-money.xml','/sitemap-topics.xml']
]);
async function sitemapHealth(req,env,ctx,origin){
  const url=new URL(req.url),requested=url.searchParams.get('part')||'0';
  const part=/^[0-4]$/.test(requested)?Number(requested):0;
  const paths=SITEMAP_HEALTH_PROBE_GROUPS[part];
  const rows=[];
  for(const path of paths){
    try{
      if(path==='/sitemap.xml'){
        // Do NOT assemble the 100KB+ public sitemap index inside this
        // diagnostic. With Free's CPU budget it intermittently triggers 1102.
        // Verify durable authoritative source manifests instead. Actual HTTP
        // reachability of the root remains a separate direct URL smoke test.
        const [rescue,ai]=await Promise.all([
          env.CONTENT_FINAL?.head('seo-rescue/index.json'),
          env.CONTENT_FINAL?.head('_ops/ai-v2-publication-ledger-v1.json')
        ]);
        const checks={rescueIndexPresent:Boolean(rescue),aiV2LedgerPresent:Boolean(ai)};
        rows.push({path,status:null,ok:Object.values(checks).every(Boolean),
          verification:'durable-source-presence-only',
          liveHttpChecked:false,sourceChecks:checks});
        continue;
      }
      let res;
      if(path==='/sitemap-core.xml')res=coreSitemap(origin);
      else if(path==='/sitemap-priority.xml')res=await prioritySitemap(env,origin);
      else if(path==='/sitemap-hubs.xml')res=await hubSitemap(env,origin);
      else if(path==='/sitemap-images.xml')res=await imageSitemap(env,origin);
      else if(path==='/sitemap-ai-v2.xml')res=await nativeAiV2SitemapResponse(path,env,origin);
      else{
        const u=new URL(req.url);u.pathname=path;u.search='';
        res=await app.fetch(new Request(u.toString(),{method:'GET',headers:{accept:'application/xml,text/xml,*/*'}}),env,ctx);
      }
      if(path==='/sitemap.xml')res=await augmentRootSitemap(res,origin,env);
      const xml=await res.text(),type=(res.headers.get('content-type')||'').toLowerCase();
      const root=/<(?:urlset|sitemapindex)\b/i.test(xml),xmlDecl=/^\s*<\?xml\b/i.test(xml);
      const rescueCoverage=path==='/sitemap.xml'?{
        historicArabic:xml.includes(origin+'/sitemap-rescue-articles-'),
        historicEnglish:xml.includes(origin+'/sitemap-rescue-english-'),
        arabicCatalog:xml.includes(origin+'/sitemap-rescue-catalog.xml'),
        englishCatalog:xml.includes(origin+'/sitemap-rescue-english-catalog.xml'),
        nativeAI:xml.includes(origin+'/sitemap-ai-v2.xml')
      }:null;
      const ok=res.ok&&type.includes('xml')&&root&&xmlDecl&&
        (!rescueCoverage||Object.values(rescueCoverage).every(Boolean));
      rows.push({path,status:res.status,ok,contentType:type,xmlDeclaration:xmlDecl,
        rootDetected:root,locs:(xml.match(/<loc>/gi)||[]).length,
        bytes:xml.length,...(rescueCoverage?{rescueCoverage}:{})});
    }catch(e){rows.push({path,status:0,ok:false,error:String(e?.message||e).slice(0,120)})}
  }
  const checkedAt=new Date().toISOString();
  return new Response(JSON.stringify({ok:rows.every(x=>x.ok),origin,checkedAt,rows,
    auditScope:'bounded-three-route-group',part,groups:SITEMAP_HEALTH_PROBE_GROUPS.length,
    routesChecked:paths.length,routesInFullInventory:SITEMAP_HEALTH_PROBE_GROUPS.flat().length,
    fullInventoryVerified:false,nextPart:part+1<SITEMAP_HEALTH_PROBE_GROUPS.length?part+1:null,
    noHeavyFullSiteCrawl:true},null,2),{headers:{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-sitemap-self-audit':'bounded-group-v2'}});
}

const EDGE_CACHE_POLICY_REVISION='r2-jsonld-dedupe-r16';
function edgePageCacheKey(u){
  return new Request(u.origin+u.pathname+'?__ndn_edge_policy='+publicEdgePolicyRevision(u.pathname,EDGE_CACHE_POLICY_REVISION),{method:'GET'});
}
function edgePageCacheEligible(req,u){return publicEdgeCacheEligible(req,u)}

async function edgePageCacheGet(req,u){
  if(!edgePageCacheEligible(req,u))return null;
  const hit=await caches.default.match(edgePageCacheKey(u));
  if(!hit)return null;
  const h=new Headers(hit.headers);h.set('x-edge-page-cache','HIT');
  return new Response(hit.body,{status:hit.status,statusText:hit.statusText,headers:h});
}
function edgePageCachePut(req,u,res,ctx){
  if(!edgePageCacheEligible(req,u)||!res?.ok)return res;
  const type=(res.headers.get('content-type')||'').toLowerCase(),cc=(res.headers.get('cache-control')||'').toLowerCase();
  if(!(type.includes('text/html')||type.includes('application/xml')||type.includes('text/xml'))||res.headers.has('set-cookie')||cc.includes('private')||cc.includes('no-store'))return res;
  const h=new Headers(res.headers);h.delete('content-length');h.set('cache-control','public, max-age=30, s-maxage='+publicEdgeTtlSeconds(u.pathname)+', stale-while-revalidate=600');h.set('x-edge-page-cache','MISS');h.set('x-edge-policy',publicEdgePolicyRevision(u.pathname,EDGE_CACHE_POLICY_REVISION));
  const out=new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
  ctx?.waitUntil?.(caches.default.put(edgePageCacheKey(u),out.clone()));
  return out;
}
export default{
  async fetch(req,env,ctx){
    env=enableExistingDestinationR2(env);
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(u.hostname.toLowerCase()==='www.noondealsnow.com'){
      const canonical=new URL(req.url);canonical.protocol='https:';canonical.hostname='noondealsnow.com';canonical.port='';
      return new Response(null,{status:308,headers:{location:canonical.toString(),'cache-control':'public, max-age=86400','x-canonical-host-redirect':'www-to-apex-v1'}});
    }
    // HEAD metadata parity for existing public sitemaps. Legacy dynamic GET
    // handlers handled only GET and returned 404 for HEAD, even though the
    // same canonical XML URL returned 200 to GET. Keep HEAD cheap and bodyless.
    // Never invent a successful response for a non-existent rescue shard.
    if(req.method==='HEAD'){
      const isDynamic=u.pathname==='/sitemap-hubs.xml'||u.pathname==='/sitemap-priority.xml';
      const isRescueShard=/^\/sitemap-rescue-(?:articles|images|english|english-images)-\d{1,4}\.xml$/.test(u.pathname);
      if(isDynamic||isRescueShard){
        const headers={
          'content-type':'application/xml; charset=utf-8',
          'cache-control':'public, max-age=300, s-maxage=900, stale-while-revalidate=600',
          'x-robots-tag':'all',
          'x-sitemap-head-parity':'v1'
        };
        if(isRescueShard){
          try{
            const publishedPaths=await rescueSitemapIndexPaths(env);
            if(!publishedPaths.includes(u.pathname))return new Response(null,{status:404,headers});
          }catch{
            return new Response(null,{status:503,headers:{...headers,'cache-control':'no-store'}});
          }
        }
        return new Response(null,{status:200,headers});
      }
    }
    // Emergency public read-only rescue: old account R2 is NotEntitled (10042).
    // Only articles and blog/archive are served from the verified new R2 mirror.
    // Keep ALL admin, cron, DO state, route, and publishing paths unchanged.
    // Check canonical public Cloudflare Cache API BEFORE cross-account R2 GET.
    // Without this, every article visit and bot crawl incurs new-account R2 Class B reads.
    const edgeHit=await edgePageCacheGet(req,u);if(edgeHit)return edgeHit;
    // Always expose one truthful, tiny, market-specific coupon reference guide.
    // Some older static/edge llms.txt responses omitted NOV170 and NOV188;
    // this avoids a second, conflicting source for crawlers.
    if(req.method==='GET'&&u.pathname==='/llms.txt')
      return new Response(canonicalCouponSourceGuide(origin),{headers:{
        'content-type':'text/plain; charset=utf-8',
        'cache-control':'public, max-age=60, s-maxage=300',
        'x-llms-source':'canonical-approved-market-codes-v1'
      }});
    // Direct destination R2 binding: bypass CPU-intensive legacy HTML layers
    // ONLY for the same native QA-approved N5-N9 articles; old URLs, R2
    // writes, crawler directives and authenticated routes are unaffected.
    const boundFast=await nativeBoundAiV2ArticleFastResponse(req,env);
    if(boundFast)return edgePageCachePut(req,u,boundFast,ctx);
    // Canary only: bypass repeated whole-document SEO/HTML passes for this
    // observed failing legacy article. Cache as normal; no R2 writes.
    const legacyCpuCanary=await nativeBoundLegacyCpuCanaryResponse(req,env);
    if(legacyCpuCanary)return edgePageCachePut(req,u,legacyCpuCanary,ctx);
    if(req.method==='GET'){
      const nativeSitemap=await nativeAiV2SitemapResponse(u.pathname,env,origin);
      if(nativeSitemap)return edgePageCachePut(req,u,nativeSitemap,ctx);
      // Intercept the legacy heavy R2 sitemap renderers before rescue fallback:
      // full historic article URLs remain in independent sitemap-rescue shards.
      if(u.pathname==='/sitemap-en-articles.xml')
        return edgePageCachePut(req,u,await englishRecentSitemap(env,origin),ctx);
      if(u.pathname==='/sitemap-images.xml')
        return edgePageCachePut(req,u,await imageSitemap(env,origin),ctx);
      if(u.pathname==='/sitemap-live-recent.xml'||u.pathname==='/sitemap-rescue-catalog.xml'||
         u.pathname==='/sitemap-rescue-english-catalog.xml'||
         /^\/sitemap-rescue-(?:articles|images|english|english-images)-\d{1,4}\.xml$/.test(u.pathname)){
        try{
          // Prefer validated, streamed R2 XML on selected hot large shards.
          // On stale/missing prebuilt XML the original quality-gated renderer
          // remains active, including the same URLs and HTTP error semantics.
          const prebuilt=await prebuiltRescueSitemapResponse(u.pathname,env);
          if(prebuilt)return edgePageCachePut(req,u,prebuilt,ctx);
          const historical=await rescueSitemapResponse(u.pathname,env);
          if(historical)return edgePageCachePut(req,u,historical,ctx);
        }catch(error){console.warn('new_account_rescue_sitemap_unavailable',String(error?.message||error).slice(0,90))}
      }
    }
    const rescued=await emergencyPublicR2Response(req,env);
    if(rescued)return edgePageCachePut(req,u,rescued,ctx);
    const directory=brandDirectoryResponse(req);
    if(directory)return edgePageCachePut(req,u,directory,ctx);
    if(req.method==='GET'&&u.pathname==='/api/archive-inventory'){
      // One cached manifest read + historical snapshot. Never enumerate 190k
      // R2 objects or run the expensive full generator health on this route.
      const [manifest,snapshot]=await Promise.all([
        rescueManifestInventory(env).catch(e=>({ok:false,reason:String(e?.message||e).slice(0,90)})),
        (async()=>{try{const obj=await env.CONTENT_FINAL?.get('_ops/article-count.json');return obj?await obj.json():null}catch{return null}})()
      ]);
      const snapDate=String(snapshot?.countedAt||'');
      const ageMs=Date.now()-Date.parse(snapDate);
      const historical={
        count:Number.isFinite(Number(snapshot?.count))?Number(snapshot.count):null,
        countedAt:snapDate||null,
        ageDays:Number.isFinite(ageMs)?Math.max(0,Math.floor(ageMs/86400000)):null,
        stale:Number.isFinite(ageMs)?ageMs>86400000:true,
        source:String(snapshot?.source||'none'),
        completeAtTime:Boolean(snapshot?.complete),
        note:'Historic snapshot is not a live R2 object count.'
      };
      return new Response(JSON.stringify({ok:Boolean(manifest?.ok),generatedAt:new Date().toISOString(),manifest,historicalAuditSnapshot:historical,noR2List:true,noWrites:true},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=30, s-maxage=120','x-article-inventory':'manifest-v1'}});
    }
    if(req.method==='GET'&&u.pathname==='/api/revision')return new Response(JSON.stringify({ok:true,release:DISCOVERY_RELEASE,layer:'discovery-entry',sitemapHealth:true,imageSitemap:true,englishIntentOwners:true,shoppingIntentOwners:true,noIdleGenerationGuard:true,titleCannibalizationGate:true},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-runtime-revision':DISCOVERY_RELEASE}});

    if(req.method==='POST'&&u.pathname==='/api/internal/generation-burst-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let englishMax=23,englishBudgetMs=12000,englishCycles=4,runBulk=false,runEnglish=true,forceBulk=false,forceSaudi=false;
      try{
        const body=await req.json();
        englishMax=Math.max(1,Math.min(24,Number(body?.englishMax)||23));
        englishBudgetMs=Math.max(5000,Math.min(15000,Number(body?.englishBudgetMs)||12000));
        englishCycles=Math.max(1,Math.min(4,Number(body?.englishCycles)||4));
        runBulk=body?.runBulk===true;
        runEnglish=body?.runEnglish!==false;
        forceBulk=body?.forceBulk===true;
        forceSaudi=body?.forceSaudi===true;
      }catch{}
      const beforeRecords=await englishCanaryRecords(env);
      const beforeEnglish=beforeRecords.length;
      let english={ok:true,skipped:'english_disabled_for_step',published:0,statePersisted:true,cycles:0,results:[]};
      if(runEnglish){
        const cycles=[];
        for(let cycle=0;cycle<englishCycles;cycle++){
          const part=await runEnglishCanaryBatch(env,{maxPerTick:englishMax,timeBudgetMs:englishBudgetMs,ignoreIntervalFirst:true});
          cycles.push(part);
          if(part?.ok===false)break;
        }
        english={ok:cycles.every(x=>x?.ok!==false),published:cycles.reduce((n,x)=>n+Number(x?.published||0),0),statePersisted:cycles.every(x=>x?.statePersisted===true),cycles:cycles.length,results:cycles};
      }
      const afterRecords=await englishCanaryRecords(env);
      const afterEnglish=afterRecords.length;
      const paceOwnsBulk=String(env.BULK_DAILY_PACE_MODE||'true').toLowerCase()==='true';
      const effectiveBulk=runBulk&&(forceBulk||!paceOwnsBulk);
      if(effectiveBulk&&forceSaudi&&forceBulk){
        const state=await getGeneratorStatus(env),lease=Date.parse(String(state.bulkBurstPriorityUntil||''));
        if(!Number.isFinite(lease)||lease-Date.now()<45000){
          await updateGeneratorStatus(env,{bulkBurstPriorityUntil:new Date(Date.now()+90000).toISOString(),bulkBurstPriorityMarket:'SA'});
        }
      }
      const bulkEnv=effectiveBulk?new Proxy(env,{get(target,prop){
        if(prop==='BULK_BATCH_SIZE')return '64';
        if(prop==='BULK_CATCHUP_BATCH_SIZE')return '64';
        if(prop==='BULK_CANDIDATE_BUDGET_MS')return '24000';
        if(prop==='BULK_BURST_MODE')return 'true';
        if(prop==='BULK_BURST_FORCE_COUNTRY'&&forceSaudi)return 'SA';
        if(prop==='BULK_BURST_PRIORITY_PROFILES'&&forceSaudi)return 'mobile,computing,beauty,grocery,fashion,appliance,audio,screen,kitchen,home,kids,baby,fitness,travel,office,auto,pets';
        return Reflect.get(target,prop);
      }}):env;
      const bulk=effectiveBulk?await bulkTick(bulkEnv):{ok:true,skipped:paceOwnsBulk&&!forceBulk?'daily_pace_owns_bulk':'bulk_not_requested'};
      return new Response(JSON.stringify({ok:Boolean(english?.ok)&&(!effectiveBulk||Boolean(bulk?.ok)),version:4,release:DISCOVERY_RELEASE,beforeEnglish,afterEnglish,englishDelta:Math.max(0,afterEnglish-beforeEnglish),english,effectiveBulk,forceBulk,forceSaudi,bulk},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='GET'&&u.pathname==='/api/daily-publish-report'){
      const range=String(u.searchParams.get('range')||'').split('..'),from=String(u.searchParams.get('from')||range[0]||''),to=String(u.searchParams.get('to')||range[1]||from);
      const report=await dailyPublishReport(env,from,to);
      return new Response(JSON.stringify(report,null,2),{status:report.ok?200:400,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-report-time-zone':'Africa/Cairo'}});
    }
    if(req.method==='GET'&&u.pathname==='/api/sitemap-health')return sitemapHealth(req,env,ctx,origin);
    if(req.method==='GET'&&u.pathname==='/sitemap-core.xml'){const r=coreSitemap(origin),h=new Headers(r.headers);h.set('x-runtime-revision',DISCOVERY_RELEASE);return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h})}
    if(req.method==='GET'&&u.pathname==='/sitemap-priority.xml'){const r=await prioritySitemap(env,origin),h=new Headers(r.headers);h.set('x-runtime-revision',DISCOVERY_RELEASE);return edgePageCachePut(req,u,new Response(r.body,{status:r.status,statusText:r.statusText,headers:h}),ctx)}
    if(req.method==='GET'&&u.pathname==='/sitemap-hubs.xml'){const r=await hubSitemap(env,origin),h=new Headers(r.headers);h.set('x-runtime-revision',DISCOVERY_RELEASE);return edgePageCachePut(req,u,new Response(r.body,{status:r.status,statusText:r.statusText,headers:h}),ctx)}
    if(req.method==='GET'&&u.pathname==='/sitemap-images.xml'){const r=await imageSitemap(env,origin),h=new Headers(r.headers);h.set('x-runtime-revision',DISCOVERY_RELEASE);return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h})}
    if(req.method==='GET'&&u.pathname==='/api/coupon-migration-health'){
      const state=await readCouponR2MigrationState(env);
      return new Response(JSON.stringify(state,null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='GET'&&u.pathname==='/api/coupon-r2-audit-health'){
      const state=await readCouponR2AuditState(env);
      return new Response(JSON.stringify(state,null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='GET'&&u.pathname==='/api/article-corpus-audit-health'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      const state=await readArticleCorpusAuditState(env);
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/article-corpus-audit-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let limit=1000,reset=false,runId='';
      try{const body=await req.json();limit=Math.max(1,Math.min(Number(body?.limit)||1000,1000));reset=body?.reset===true;runId=String(body?.runId||'').trim();}catch{}
      const state=await runArticleCorpusAuditBatch(env,{limit,reset,runId});
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='GET'&&u.pathname==='/api/article-collision-owner-health'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      const state=await readArticleCollisionOwnerState(env);
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='GET'&&u.pathname==='/api/article-discovery-health'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      const state=await readArticleDiscoveryState(env);
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/article-collision-owner-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let limit=1000,reset=false,runId='';
      try{const body=await req.json();limit=Math.max(1,Math.min(Number(body?.limit)||1000,1000));reset=body?.reset===true;runId=String(body?.runId||'').trim();}catch{}
      const state=await runArticleCollisionOwnerBatch(env,{limit,reset,runId});
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/coupon-migration-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let limit=500;
      try{const body=await req.json();limit=Math.max(1,Math.min(Number(body?.limit)||500,500));}catch{}
      const state=await runCouponR2MigrationBatch(env,{limit});
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/coupon-r2-audit-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let limit=500,reset=false,runId='';
      try{const body=await req.json();limit=Math.max(1,Math.min(Number(body?.limit)||500,500));reset=body?.reset===true;runId=String(body?.runId||'').trim();}catch{}
      const state=await runCouponR2AuditBatch(env,{limit,reset,runId});
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/english-batch-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let limit=2,timeBudgetMs=22000,ignoreInterval=true;try{const body=await req.json();limit=Math.max(1,Math.min(8,Number(body?.limit)||2));timeBudgetMs=Math.max(5000,Math.min(30000,Number(body?.timeBudgetMs)||22000));ignoreInterval=body?.ignoreInterval!==false}catch{}
      const state=await runEnglishCanaryBatch(env,{maxPerTick:limit,timeBudgetMs,ignoreIntervalFirst:ignoreInterval});
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/ai-v2/reconcile'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json','cache-control':'no-store'}});
      let body;try{body=await req.json()}catch{return new Response(JSON.stringify({ok:false,reason:'invalid_json'}),{status:400})}
      let result;try{result=await reconcileAiV2Publication(env,{slug:body?.slug})}catch{result={ok:false,reason:'ledger_reconciliation_unavailable'}}
      return new Response(JSON.stringify(result),{status:result.ok?200:409,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/ai-v2/publish'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json','cache-control':'no-store'}});
      let raw;try{raw=await req.text();if(raw.length>300000)throw Error('payload_too_large')}catch{return new Response(JSON.stringify({ok:false,reason:'payload_too_large'}),{status:413})}
      let body;try{body=JSON.parse(raw)}catch{return new Response(JSON.stringify({ok:false,reason:'invalid_json'}),{status:400})}
      let result;try{result=await publishAiV2NativeArticle(env,body)}catch(e){console.warn('ai_v2_native_publish_error',String(e?.message||e).slice(0,110));result={ok:false,reason:'native_publish_unavailable'}}
      return new Response(JSON.stringify(result),{status:result.ok?200:409,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    let res=await app.fetch(req,env,ctx);
    res=await enrichHomepageSchema(req,res);
    if(req.method==='GET'&&u.pathname==='/sitemap.xml')res=await augmentRootSitemap(res,origin,env);
    if(req.method==='GET'&&u.pathname==='/robots.txt')res=await augmentRobots(res,origin);
    res=await injectDiscoveryLinks(req,env,res);
    res=await sanitizeCouponSurface(req,res);
    res=edgePageCachePut(req,u,res,ctx);
    const revisionHeaders=new Headers(res.headers);revisionHeaders.set('x-runtime-revision',DISCOVERY_RELEASE);
    return new Response(res.body,{status:res.status,statusText:res.statusText,headers:revisionHeaders});
  },
  async scheduled(event,env,ctx){
    env=enableExistingDestinationR2(env);
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};

export const DISCOVERY_ENTRY_INFO={version:26,dailyPaceRecovery:true,burstBulkAlwaysEnabled:true,recoveryEnglishCycles:4,recoveryBulkEveryStep:false,recoveryBulkOwner:'daily-pace',cpuSaverMode:true,cronCadenceMinutes:1,coreSitemap:true,coreSitemapPath:'/sitemap-core.xml',release:DISCOVERY_RELEASE,revisionEndpoint:'/api/revision',hubSitemap:true,hubSitemapPath:'/sitemap-hubs.xml',edgePageCache:true,edgePageCacheBrowserSeconds:30,edgePageCacheSharedSeconds:120,edgePageCacheStaleSeconds:600,englishBatchPublishing:true,englishPriorityDiscovery:true,englishRootSitemapDiscovery:true,englishHomepageDiscovery:true,balancedMarketDiscovery:true,exactMarketHubFilter:true,englishPriorityArticleLimit:500,englishCategoryEvidenceMin:3,couponR2Migration:true,couponR2Audit:true,articleCorpusAudit:true,collisionOwnerAudit:true,couponSurfaceSanitizer:true,secureMigrationStep:true,englishSchedulerOwner:true,englishSchedulerRuntimeOwner:'auto-platform',englishBatchRunsBeforeRepair:false,englishSchedulerObserved:true,englishSchedulerPriority:'english-uae-core-cron-deadline-safe',englishSchedulerEffectiveBatch:24,englishSchedulerStatusRetry:true,englishSchedulerTimeBudgetMs:12000,englishSchedulerStopsOnError:true,englishBatchRepairSequential:false,secureEnglishBatchStep:true,wraps:'brand-runtime',prioritySitemap:'/sitemap-priority.xml',recentArticleLimit:500,keyPriorityPages:34,discoveryLinks:true,discoveryLinkCount:8,discoveryHubs:['/','/coupons','/blog','/blog/archive','/saudi','/uae','/saudi/categories','/uae/categories'],robotsPrioritySitemap:true,robotsEnglishSitemap:true,manifestCacheSeconds:120,r2PublicManifestCoalesced:true,edgeCachePolicy:EDGE_CACHE_POLICY_REVISION};
