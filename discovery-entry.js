import app from './brand-runtime.js';
import {runEnglishCanary,englishCanaryRecords} from './english-canary.js';
import {repairEnglishCanaryLegacyMetadata} from './english-canary-repair.js';
import {runCouponR2MigrationBatch,readCouponR2MigrationState,runCouponR2AuditBatch,readCouponR2AuditState} from './coupon-r2-migration.js';
import {replaceUnapprovedCouponTokens} from './approved-coupons.js';
import {runArticleCorpusAuditBatch,readArticleCorpusAuditState} from './article-corpus-audit.js';
export {ControlPlane,GeneratorControl} from './brand-runtime.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const enc=s=>encodeURI(String(s||''));
let latestCache={at:0,value:null};
const CLOUDFLARE_ACCOUNT_ID='c82274152a942dea53044eae7153cfd7';

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

async function latest(env){
  const now=Date.now();
  if(latestCache.value&&now-latestCache.at<120000)return latestCache.value;
  try{
    if(!env.CONTENT_FINAL)return latestCache.value||{articles:[]};
    const o=await env.CONTENT_FINAL.get('bulk/latest.json');
    const value=o?await o.json():{articles:[]};
    latestCache={at:now,value};
    return value;
  }catch{return latestCache.value||{articles:[]}}
}

function keyPages(origin){
  return [
    '/',
    '/coupons',
    '/blog',
    '/saudi',
    '/uae',
    '/saudi/categories',
    '/uae/categories',
    '/saudi-arabia/noon-coupon-code',
    '/saudi-arabia/noon-coupon-code-today',
    '/saudi-arabia/noon-coupon-code-2026',
    '/uae/noon-coupon-code',
    '/uae/noon-coupon-code-today',
    '/uae/noon-coupon-code-2026',
    '/editorial-policy',
    '/coupon-verification',
    '/authors/editorial-team',
    '/about',
    '/privacy',
    '/research',
    '/glossary',
    '/countries'
  ].map(path=>({loc:origin+path,lastmod:null}));
}

function marketForPath(path){return path.startsWith('/uae/')?'AE':path.startsWith('/saudi-arabia/')?'SA':null}
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
function discoveryHtml(path,articles){
  const market=marketForPath(path);
  let rows=(articles||[]).filter(discoveryEligible);
  if(market)rows=rows.filter(a=>a.country===market);
  rows=rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,8);
  if(!rows.length)return '';
  const country=market==='AE'?'الإمارات':market==='SA'?'السعودية':'السعودية والإمارات';
  const cards=rows.map(a=>{
    const m=a.country==='AE'?'الإمارات':'السعودية';
    const title=esc(a.title||a.primaryKeyword||a.slug);
    const desc=esc((a.metaDescription||'دليل عملي قبل الشراء واستخدام الكوبون.').slice(0,115));
    return `<article class="dl-card"><small>${m}</small><h3><a href="/articles/${enc(a.slug)}">${title}</a></h3><p>${desc}</p><a class="dl-read" href="/articles/${enc(a.slug)}">اقرأ المقال ←</a></article>`;
  }).join('');
  return `<section id="crawl-discovery-links" class="latest-editorial" dir="rtl" aria-label="أحدث مقالات نون"><style>.latest-editorial{padding:42px 0;background:#fff}.dl-wrap{width:min(1180px,92%);margin:auto}.dl-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:20px}.dl-head h2{margin:0;font:900 29px Tahoma,Arial,sans-serif;color:#101828}.dl-head p{margin:7px 0 0;color:#667085;line-height:1.8}.dl-head>a{font-weight:900;color:#111827;text-decoration:none}.dl-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.dl-card{border:1px solid #e7e9ee;border-radius:16px;padding:17px;background:#fff}.dl-card small{color:#7a6400;font-weight:900}.dl-card h3{font:900 17px/1.65 Tahoma,Arial,sans-serif;margin:8px 0}.dl-card h3 a,.dl-read{text-decoration:none;color:#111827}.dl-card p{color:#667085;font:13px/1.8 Tahoma,Arial,sans-serif}.dl-read{font-weight:900}@media(max-width:900px){.dl-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.dl-grid{grid-template-columns:1fr}.dl-head{display:block}}</style><div class="dl-wrap"><div class="dl-head"><div><small style="color:#7a6400;font-weight:900">من المدونة</small><h2>أحدث مقالات نون ${country}</h2><p>أدلة جديدة عن الكوبونات والأقسام وقرارات الشراء قبل الدفع.</p></div><a href="/blog">كل المقالات ←</a></div><div class="dl-grid">${cards}</div></div></section>`;
}

async function injectDiscoveryLinks(req,env,res){
  if(!res.ok||req.method!=='GET')return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html'))return res;
  const path=new URL(req.url).pathname.replace(/\/+$/,'')||'/';
  const eligible=['/','/coupons','/blog','/saudi','/uae','/saudi/categories','/uae/categories'].includes(path)||/^\/(?:saudi-arabia|uae)\/noon-coupon-code(?:-today|-2026)?$/.test(path);
  if(!eligible)return res;
  let html=await res.text();
  if(html.includes('id="crawl-discovery-links"'))return res;
  const data=await latest(env),block=discoveryHtml(path,data.articles||[]);
  if(!block)return new Response(html,{status:res.status,statusText:res.statusText,headers:res.headers});
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,block+'</body>'):html+block;
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-crawl-discovery-links','v1');h.set('x-discovery-manifest-cache','120s-isolate');
  return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
}

async function prioritySitemap(env,origin){
  const data=await latest(env);
  const articles=(data.articles||[])
    .filter(discoveryEligible)
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))
    .slice(0,500)
    .map(a=>({loc:origin+'/articles/'+enc(a.slug),lastmod:a.updatedAt||a.createdAt||null}));
  let english=[];
  try{english=(await englishCanaryRecords(env)).filter(discoveryEligible)}catch{}
  const englishArticles=english
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))
    .slice(0,200)
    .map(a=>({loc:origin+(a.urlPath||('/en/articles/'+enc(a.slug))),lastmod:a.updatedAt||a.createdAt||null}));
  const englishPages=[];
  for(const [country,market] of [['SA','saudi'],['AE','uae']]){
    const marketRows=english.filter(a=>a.country===country);
    if(!marketRows.length)continue;
    englishPages.push({loc:origin+'/en/'+market,lastmod:null});
    const byCategory=new Map();
    for(const a of marketRows){if(a.categoryKey)byCategory.set(a.categoryKey,(byCategory.get(a.categoryKey)||0)+1)}
    for(const [categoryKey,count] of byCategory)if(count>=3)englishPages.push({loc:origin+'/en/'+market+'/category/'+encodeURIComponent(categoryKey),lastmod:null});
  }
  const seen=new Set(),rows=[];
  for(const row of [...keyPages(origin),...englishPages,...articles,...englishArticles]){
    if(seen.has(row.loc))continue;
    seen.add(row.loc);rows.push(row);
  }
  const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(x=>`<url><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:''}</url>`).join('')}</urlset>`;
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900, stale-while-revalidate=86400','x-robots-tag':'all','x-priority-sitemap-count':String(rows.length),'x-priority-sitemap':'v2','x-english-priority-count':String(englishArticles.length),'x-english-priority-hubs':String(englishPages.length)}});
}

async function augmentRootSitemap(res,origin){
  if(!res.ok)return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('xml'))return res;
  let body=await res.text();
  if(!body.includes('/sitemap-priority.xml')&&/<sitemapindex\b/i.test(body))body=body.replace(/<\/sitemapindex>/i,`<sitemap><loc>${esc(origin)}/sitemap-priority.xml</loc></sitemap></sitemapindex>`);
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-priority-sitemap-discovery','v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}

async function augmentRobots(res,origin){
  if(!res.ok)return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(type&&!type.includes('text/plain'))return res;
  let body=await res.text();
  const root=`Sitemap: ${origin}/sitemap.xml`;
  const priority=`Sitemap: ${origin}/sitemap-priority.xml`;
  const english=`Sitemap: ${origin}/sitemap-en-articles.xml`;
  if(!body.includes(root))body=(body.trimEnd()+`\n${root}\n`).replace(/^\n+/, '');
  if(!body.includes(priority))body=(body.trimEnd()+`\n${priority}\n`).replace(/^\n+/, '');
  if(!body.includes(english))body=(body.trimEnd()+`\n${english}\n`).replace(/^\n+/, '');
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-priority-sitemap-robots','v1');h.set('x-english-sitemap-robots','v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(req.method==='GET'&&u.pathname==='/sitemap-priority.xml')return prioritySitemap(env,origin);
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
    if(req.method==='POST'&&u.pathname==='/api/internal/coupon-migration-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let limit=500;
      try{const body=await req.json();limit=Math.max(1,Math.min(Number(body?.limit)||500,500));}catch{}
      const state=await runCouponR2MigrationBatch(env,{limit});
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(req.method==='POST'&&u.pathname==='/api/internal/coupon-r2-audit-step'){
      if(!await verifyMaintenanceToken(req))return new Response(JSON.stringify({ok:false,reason:'unauthorized'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
      let limit=500;
      try{const body=await req.json();limit=Math.max(1,Math.min(Number(body?.limit)||500,500));}catch{}
      const state=await runCouponR2AuditBatch(env,{limit});
      return new Response(JSON.stringify(state),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    let res=await app.fetch(req,env,ctx);
    if(req.method==='GET'&&u.pathname==='/sitemap.xml')res=await augmentRootSitemap(res,origin);
    if(req.method==='GET'&&u.pathname==='/robots.txt')res=await augmentRobots(res,origin);
    res=await injectDiscoveryLinks(req,env,res);
    res=await sanitizeCouponSurface(req,res);
    return res;
  },
  async scheduled(event,env,ctx){const base=app.scheduled?app.scheduled(event,env,ctx):null;if(base)ctx.waitUntil(Promise.resolve(base));ctx.waitUntil((async()=>{await repairEnglishCanaryLegacyMetadata(env);return runEnglishCanary(env)})());}
};

export const DISCOVERY_ENTRY_INFO={version:11,englishPriorityDiscovery:true,englishPriorityArticleLimit:200,englishCategoryEvidenceMin:3,couponR2Migration:true,couponR2Audit:true,articleCorpusAudit:true,couponSurfaceSanitizer:true,secureMigrationStep:true,englishSchedulerOwner:true,wraps:'brand-runtime',prioritySitemap:'/sitemap-priority.xml',recentArticleLimit:500,keyPriorityPages:21,discoveryLinks:true,discoveryLinkCount:12,discoveryHubs:['/','/coupons','/blog','/saudi','/uae','/saudi/categories','/uae/categories'],robotsPrioritySitemap:true,robotsEnglishSitemap:true,manifestCacheSeconds:120};
