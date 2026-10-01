import app from './brand-runtime.js';
import {runEnglishCanaryBatch,englishCanaryRecords} from './english-canary.js';
import {runCouponR2MigrationBatch,readCouponR2MigrationState,runCouponR2AuditBatch,readCouponR2AuditState} from './coupon-r2-migration.js';
import {replaceUnapprovedCouponTokens} from './approved-coupons.js';
import {runArticleCorpusAuditBatch,readArticleCorpusAuditState,runArticleCollisionOwnerBatch,readArticleCollisionOwnerState,readArticleDiscoveryState} from './article-corpus-audit.js';
export {ControlPlane,GeneratorControl} from './brand-runtime.js';

const DISCOVERY_RELEASE='2026-10-01-gsc-intent-sitemap-r1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const enc=s=>encodeURI(String(s||''));
let latestCache={at:0,value:null};
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
    '/en/coupons',
    '/en/uae/saving-guide',
    '/blog',
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
    '/countries'
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
  const eligible=['/','/coupons','/blog','/saudi','/uae','/saudi/categories','/uae/categories','/saudi/shopping-guide','/uae/shopping-guide'].includes(path)||/^\/(?:saudi-arabia|uae)\/noon-coupon-code$/.test(path);
  if(!eligible)return res;
  let html=await res.text();
  if(html.includes('id="crawl-discovery-links"'))return res;
  const data=await latest(env);
  let english=[];
  try{english=await englishCanaryRecords(env)}catch{}
  const block=discoveryHtml(path,[...(data.articles||[]),...(english||[])]);
  if(!block)return new Response(html,{status:res.status,statusText:res.statusText,headers:res.headers});
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,block+'</body>'):html+block;
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-crawl-discovery-links','v2');h.set('x-discovery-manifest-cache','120s-isolate');h.set('x-discovery-market-mix','balanced-sa-ae-with-english');
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

async function hubSitemap(env,origin){
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
  let english=[];try{english=(await englishCanaryRecords(env)).filter(discoveryEligible)}catch{}
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

async function imageSitemap(env,origin){
  const data=await latest(env);
  let english=[];try{english=await englishCanaryRecords(env)}catch{}
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

async function augmentRootSitemap(res,origin){
  if(!res.ok)return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('xml'))return res;
  let body=await res.text();
  if(/<sitemapindex\b/i.test(body)){
    const additions=[
      ['priority',origin+'/sitemap-priority.xml'],
      ['english',origin+'/sitemap-en-articles.xml'],
      ['hubs',origin+'/sitemap-hubs.xml'],
      ['images',origin+'/sitemap-images.xml']
    ];
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
  const priority=`Sitemap: ${origin}/sitemap-priority.xml`;
  const english=`Sitemap: ${origin}/sitemap-en-articles.xml`;
  const hubs=`Sitemap: ${origin}/sitemap-hubs.xml`;
  const images=`Sitemap: ${origin}/sitemap-images.xml`;
  if(!body.includes(root))body=(body.trimEnd()+`\n${root}\n`).replace(/^\n+/, '');
  if(!body.includes(priority))body=(body.trimEnd()+`\n${priority}\n`).replace(/^\n+/, '');
  if(!body.includes(english))body=(body.trimEnd()+`\n${english}\n`).replace(/^\n+/, '');
  if(!body.includes(hubs))body=(body.trimEnd()+`\n${hubs}\n`).replace(/^\n+/, '');
  if(!body.includes(images))body=(body.trimEnd()+`\n${images}\n`).replace(/^\n+/, '');
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-priority-sitemap-robots','v1');h.set('x-english-sitemap-robots','v1');h.set('x-hub-sitemap-robots','v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}

async function sitemapHealth(req,env,ctx,origin){
  const paths=['/sitemap.xml','/sitemap-pages.xml','/sitemap-guides.xml','/sitemap-coupons.xml','/sitemap-coupons-saudi.xml','/sitemap-coupons-uae.xml','/sitemap-priority.xml','/sitemap-en-articles.xml','/sitemap-hubs.xml','/sitemap-images.xml','/sitemap-commerce.xml','/sitemap-money.xml','/sitemap-topics.xml'];
  const rows=[];
  for(const path of paths){
    try{
      let res;
      if(path==='/sitemap-priority.xml')res=await prioritySitemap(env,origin);
      else if(path==='/sitemap-hubs.xml')res=await hubSitemap(env,origin);
      else if(path==='/sitemap-images.xml')res=await imageSitemap(env,origin);
      else{const u=new URL(req.url);u.pathname=path;u.search='';res=await app.fetch(new Request(u.toString(),{method:'GET',headers:{accept:'application/xml,text/xml,*/*'}}),env,ctx)}
      const text=await res.text(),type=(res.headers.get('content-type')||'').toLowerCase(),root=/<(?:urlset|sitemapindex)\b/i.test(text),xmlDecl=/^\s*<\?xml\b/i.test(text),locs=(text.match(/<loc>/gi)||[]).length,httpLocs=(text.match(/<loc>http:\/\//gi)||[]).length,httpsLocs=(text.match(/<loc>https:\/\//gi)||[]).length;
      rows.push({path,status:res.status,ok:res.ok&&type.includes('xml')&&root,contentType:type,xmlDeclaration:xmlDecl,rootDetected:root,locs,httpLocs,httpsLocs,bytes:text.length});
    }catch(e){rows.push({path,status:0,ok:false,error:String(e?.message||e).slice(0,220)})}
  }
  return new Response(JSON.stringify({ok:rows.every(x=>x.ok),origin,checkedAt:new Date().toISOString(),rows},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-sitemap-self-audit':'v1'}});
}

function edgePageCacheKey(u){
  return new Request(u.origin+u.pathname,{method:'GET'});
}
function edgePageCacheEligible(req,u){
  if(req.method!=='GET'||u.search||req.headers.has('authorization')||req.headers.has('cookie')||req.headers.has('range'))return false;
  const p=u.pathname.replace(/\/+$/,'')||'/';
  if(['/','/coupons','/blog','/saudi','/uae','/saudi/categories','/uae/categories','/saudi/shopping-guide','/uae/shopping-guide','/en/coupons','/en/uae/saving-guide','/en/saudi','/en/uae'].includes(p))return true;
  if(/^\/(?:saudi|uae)\/(?:category|brand|model|compare)\/[^/]+(?:\/[^/]+)?$/.test(p))return true;
  if(/^\/en\/(?:saudi|uae)\/noon-coupon-code$/.test(p))return true;
  if(/^\/en\/(?:saudi|uae)\/(?:category|product)\/[^/]+$/.test(p))return true;
  if(/^\/(?:articles|en\/articles)\/[^/]+$/.test(p))return true;
  if(/^\/(?:saudi-arabia|uae)\/noon-coupon-code(?:-today|-2026)?$/.test(p))return true;
  if(/^\/(?:saudi-arabia|uae)\/coupon\/[^/]+$/.test(p))return true;
  return false;
}
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
  if(!type.includes('text/html')||res.headers.has('set-cookie')||cc.includes('private')||cc.includes('no-store'))return res;
  const h=new Headers(res.headers);h.delete('content-length');h.set('cache-control','public, max-age=30, s-maxage=120, stale-while-revalidate=600');h.set('x-edge-page-cache','MISS');
  const out=new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
  ctx?.waitUntil?.(caches.default.put(edgePageCacheKey(u),out.clone()));
  return out;
}
export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    const edgeHit=await edgePageCacheGet(req,u);if(edgeHit)return edgeHit;
    if(req.method==='GET'&&u.pathname==='/api/revision')return new Response(JSON.stringify({ok:true,release:DISCOVERY_RELEASE,layer:'discovery-entry',sitemapHealth:true,imageSitemap:true,englishIntentOwners:true,shoppingIntentOwners:true,noIdleGenerationGuard:true,titleCannibalizationGate:true},null,2),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-runtime-revision':DISCOVERY_RELEASE}});
    if(req.method==='GET'&&u.pathname==='/api/sitemap-health')return sitemapHealth(req,env,ctx,origin);
    if(req.method==='GET'&&u.pathname==='/sitemap-priority.xml'){const r=await prioritySitemap(env,origin),h=new Headers(r.headers);h.set('x-runtime-revision',DISCOVERY_RELEASE);return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h})}
    if(req.method==='GET'&&u.pathname==='/sitemap-hubs.xml'){const r=await hubSitemap(env,origin),h=new Headers(r.headers);h.set('x-runtime-revision',DISCOVERY_RELEASE);return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h})}
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
    let res=await app.fetch(req,env,ctx);
    if(req.method==='GET'&&u.pathname==='/sitemap.xml')res=await augmentRootSitemap(res,origin);
    if(req.method==='GET'&&u.pathname==='/robots.txt')res=await augmentRobots(res,origin);
    res=await injectDiscoveryLinks(req,env,res);
    res=await sanitizeCouponSurface(req,res);
    res=edgePageCachePut(req,u,res,ctx);
    const revisionHeaders=new Headers(res.headers);revisionHeaders.set('x-runtime-revision',DISCOVERY_RELEASE);
    return new Response(res.body,{status:res.status,statusText:res.statusText,headers:revisionHeaders});
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)return app.scheduled(event,env,ctx);
  }
};

export const DISCOVERY_ENTRY_INFO={version:23,release:DISCOVERY_RELEASE,revisionEndpoint:'/api/revision',hubSitemap:true,hubSitemapPath:'/sitemap-hubs.xml',edgePageCache:true,edgePageCacheBrowserSeconds:30,edgePageCacheSharedSeconds:120,edgePageCacheStaleSeconds:600,englishBatchPublishing:true,englishPriorityDiscovery:true,englishRootSitemapDiscovery:true,englishHomepageDiscovery:true,balancedMarketDiscovery:true,exactMarketHubFilter:true,englishPriorityArticleLimit:500,englishCategoryEvidenceMin:3,couponR2Migration:true,couponR2Audit:true,articleCorpusAudit:true,collisionOwnerAudit:true,couponSurfaceSanitizer:true,secureMigrationStep:true,englishSchedulerOwner:true,englishSchedulerRuntimeOwner:'auto-platform',englishBatchRunsBeforeRepair:false,englishSchedulerObserved:true,englishSchedulerPriority:'english-uae-core-cron-deadline-safe',englishSchedulerEffectiveBatch:24,englishSchedulerStatusRetry:true,englishSchedulerTimeBudgetMs:45000,englishSchedulerStopsOnError:true,englishBatchRepairSequential:false,secureEnglishBatchStep:true,wraps:'brand-runtime',prioritySitemap:'/sitemap-priority.xml',recentArticleLimit:500,keyPriorityPages:34,discoveryLinks:true,discoveryLinkCount:8,discoveryHubs:['/','/coupons','/blog','/blog/archive','/saudi','/uae','/saudi/categories','/uae/categories'],robotsPrioritySitemap:true,robotsEnglishSitemap:true,manifestCacheSeconds:120};
