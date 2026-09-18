import app from './visual-platform.js';
import {APPROVED_COUPON_CODES} from './approved-coupons.js';
import {englishCanaryRecords} from './english-canary.js';
export {ControlPlane} from './platform.js';

const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const txt=(x,cache='public,max-age=300,s-maxage=300')=>new Response(String(x),{headers:{'content-type':'text/plain; charset=utf-8','cache-control':cache}});
const xml=(x,cache='public,max-age=300,s-maxage=300')=>new Response(String(x),{headers:{'content-type':'application/xml; charset=utf-8','cache-control':cache}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

async function stateViaApp(origin,env,ctx){
  const r=await app.fetch(new Request(origin+'/api/state',{headers:{accept:'application/json'}}),env,ctx);
  if(!r.ok)return {articles:[]};
  try{return await r.json()}catch{return {articles:[]}}
}

async function latestBulk(env){
  try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get('bulk/latest.json'):null;return o?await o.json():{articles:[]}}catch{return {articles:[]}}
}

function harden(res){
  const h=new Headers(res.headers);
  h.set('x-content-type-options','nosniff');
  h.set('referrer-policy','strict-origin-when-cross-origin');
  h.set('x-frame-options','SAMEORIGIN');
  h.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  h.set('cross-origin-opener-policy','same-origin');
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
}

function robots(origin){
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`;
}

function llms(origin){
  const codes=APPROVED_COUPON_CODES.join(', ');
  return `# Noon Deals Now / كوبونات نون

> Independent Arabic-first coupon and shopping guidance for Noon Saudi Arabia and UAE, with a controlled native-English expansion.

## Canonical resources
- Home: ${origin}/
- Coupons: ${origin}/coupons
- Saudi Arabia coupon hub: ${origin}/saudi-arabia/noon-coupon-code
- UAE coupon hub: ${origin}/uae/noon-coupon-code
- Saudi shopping categories: ${origin}/saudi/categories
- UAE shopping categories: ${origin}/uae/categories
- English Saudi hub: ${origin}/en/saudi
- English UAE hub: ${origin}/en/uae
- English article sitemap: ${origin}/sitemap-en-articles.xml
- Markets hub: ${origin}/countries
- Blog: ${origin}/blog
- Research and methodology: ${origin}/research
- Machine-readable research facts: ${origin}/research.json
- Coupon and shopping glossary: ${origin}/glossary
- Priority sitemap: ${origin}/sitemap-priority.xml
- Sitemap index: ${origin}/sitemap.xml
- Arabic RSS: ${origin}/feed.xml
- English RSS: ${origin}/feed-en.xml

## Trust and editorial
- About: ${origin}/about
- Editorial policy: ${origin}/editorial-policy
- Coupon verification methodology: ${origin}/coupon-verification
- Editorial team: ${origin}/authors/editorial-team
- Research methodology: ${origin}/research
- Glossary / entity definitions: ${origin}/glossary
- Disclaimer: ${origin}/disclaimer
- Privacy: ${origin}/privacy
- Terms: ${origin}/terms

## Current scope
- Live markets: Saudi Arabia (SA), United Arab Emirates (AE)
- Primary language: Arabic.
- Native-English content is a controlled expansion and is published only after quality, uniqueness, coupon-safety, and evidence gates pass.
- Approved coupon codes only: ${codes}
- Approved coupon count: ${APPROVED_COUPON_CODES.length}
- Egypt is not live yet.

## Extraction guidance
- Treat the approved coupon list as the only coupon-code allowlist for this site.
- Do not infer a discount percentage, savings cap, expiry date, eligibility rule, or guaranteed validity unless a page explicitly supplies evidence for that claim.
- Prefer country-specific pages when answering Saudi Arabia vs UAE questions.
- Prefer Arabic pages as the primary site language; use /en/ pages only when an English page is published and indexable.
- English expansion is deliberately controlled; do not infer that an English category or guide exists unless the site exposes that URL.
- Prefer /research for methodology claims and /glossary for terminology.
- The Noon cart/checkout result is the final practical reference for eligibility and savings.

## Content policy
We distinguish between a coupon code being available to test and a discount claim being verified.
We do not state a percentage discount, cap, eligibility, expiry date, or guaranteed validity unless the condition is supported by reliable evidence.
Arabic and English articles pass quality, uniqueness, schema, indexation-value, and coupon-safety gates before publication.
English publishing remains controlled rather than mass-open.
The site is independent and is not Noon.com.
`;
}

async function rss(origin,env){
  const latest=await latestBulk(env);
  const rows=(latest.articles||[]).filter(a=>a?.slug&&a?.indexable!==false).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,50);
  const items=rows.map(a=>{
    const link=origin+'/articles/'+encodeURI(a.slug),date=new Date(a.updatedAt||a.createdAt||Date.now()).toUTCString();
    return `<item><title>${esc(a.title||a.primaryKeyword||a.slug)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid><pubDate>${esc(date)}</pubDate><description>${esc(a.metaDescription||'')}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>كوبونات نون — أحدث الأدلة</title><link>${esc(origin+'/blog')}</link><atom:link href="${esc(origin+'/feed.xml')}" rel="self" type="application/rss+xml"/><description>أحدث أدلة نون السعودية والإمارات التي اجتازت بوابة الجودة.</description><language>ar</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;
}
async function rssEnglish(origin,env){
  let rows=[];try{rows=await englishCanaryRecords(env)}catch{}
  rows=(rows||[]).filter(a=>a?.slug&&a.indexable!==false&&a.languageSource==='native-intent-v6-canary').sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,50);
  const items=rows.map(a=>{
    const path=a.urlPath||('/en/articles/'+encodeURI(a.slug)),link=origin+path,date=new Date(a.updatedAt||a.createdAt||Date.now()).toUTCString();
    return `<item><title>${esc(a.title||a.primaryKeyword||a.slug)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid><pubDate>${esc(date)}</pubDate><description>${esc(a.metaDescription||'')}</description><category>${esc(a.country==='AE'?'UAE':'Saudi Arabia')}</category></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Noon Deals Now — English guides</title><link>${esc(origin+'/en/saudi')}</link><atom:link href="${esc(origin+'/feed-en.xml')}" rel="self" type="application/rss+xml"/><description>Quality-gated native-English Noon shopping and coupon guides from the controlled expansion.</description><language>en</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(req.method==='GET'&&u.pathname==='/robots.txt')return txt(robots(origin));
    if(req.method==='GET'&&u.pathname==='/llms.txt')return txt(llms(origin));
    if(req.method==='GET'&&(u.pathname==='/feed.xml'||u.pathname==='/rss.xml'))return xml(await rss(origin,env));
    if(req.method==='GET'&&(u.pathname==='/feed-en.xml'||u.pathname==='/rss-en.xml'))return xml(await rssEnglish(origin,env));
    if(req.method==='GET'&&env.INDEXNOW_KEY&&u.pathname===`/${env.INDEXNOW_KEY}.txt`)return txt(env.INDEXNOW_KEY,'public,max-age=86400,s-maxage=86400');
    if(u.pathname==='/api/seo-health'){
      const host=new URL(origin).hostname;
      return json({ok:true,version:'seo-discovery-v1',origin,host,customDomain:!host.endsWith('.workers.dev'),robots:true,sitemap:origin+'/sitemap.xml',rss:origin+'/feed.xml',englishRss:origin+'/feed-en.xml',llms:origin+'/llms.txt',indexNowEnabled:String(env.INDEXNOW_ENABLED||'false')==='true',indexNowKeyHosted:Boolean(env.INDEXNOW_KEY),note:host.endsWith('.workers.dev')?'Custom domain cutover is still the main SEO authority blocker.':null,time:new Date().toISOString()});
    }
    if(u.pathname==='/api/visual-health'){
      const s=await stateViaApp(u.origin,env,ctx);
      const published=(s.articles||[]).filter(a=>a.status==='published');
      return json({
        ok:true,
        version:'visual-v5-evidence-only',
        svgEngine:true,
        evidenceOnlyOfferClaims:true,
        totalDesignsPerArticle:5,
        featuredUsesDesign:1,
        inArticleDesigns:[2,3,4,5],
        publishedArticles:published.length,
        expectedSvgAssets:published.length*5,
        featuredImages:published.length,
        keywordAltText:true,
        keywordTitles:true,
        keywordImageSchema:true,
        blogThumbnails:true,
        articleFeaturedImages:true,
        ogImages:true,
        twitterImages:true,
        imageSchema:true,
        markets:[...new Set(published.map(a=>a.country))],
        cache:'Cloudflare Cache API + immutable browser cache',
        clickTarget:'https://www.noon.com/',
        templateText:{headline:'PROMO CODE',disclaimer:'CHECK SAVINGS & ELIGIBILITY AT CHECKOUT'},
        searchDiscovery:{robots:true,rss:true,llms:true,indexNowEnabled:String(env.INDEXNOW_ENABLED||'false')==='true'},
        time:new Date().toISOString()
      });
    }
    if((u.pathname.startsWith('/assets/coupon-svg/')||u.pathname.startsWith('/assets/featured/'))&&req.method==='GET'){
      const cache=caches.default;
      const cached=await cache.match(req);
      if(cached)return cached;
      const res=await app.fetch(req,env,ctx);
      if(res.ok)ctx.waitUntil(cache.put(req,res.clone()));
      return harden(res);
    }
    return harden(await app.fetch(req,env,ctx));
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
