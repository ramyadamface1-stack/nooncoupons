import app from './visual-platform.js';
import {APPROVED_COUPON_CODES} from './approved-coupons.js';
import {englishCanaryRecords} from './english-canary.js';
export {ControlPlane} from './platform.js';

const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const txt=(x,cache='public,max-age=300,s-maxage=300')=>new Response(String(x),{headers:{'content-type':'text/plain; charset=utf-8','cache-control':cache}});
const xml=(x,cache='public,max-age=300,s-maxage=300')=>new Response(String(x),{headers:{'content-type':'application/xml; charset=utf-8','cache-control':cache}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function feedEligible(a){
  const q=Number(a?.quality),f=Number(a?.qualityFloor);
  const minWords=a?.languageSource==='native-intent-v6-canary'?900:1500;return Boolean(a?.slug&&a.status==='published'&&a.indexable!==false&&a.superseded!==true&&a.orphan!==true&&a.duplicateIntent!==true&&Number.isFinite(q)&&q>=95&&(a.qualityFloor==null||(Number.isFinite(f)&&f>=88))&&(a.wordCount==null||Number(a.wordCount)>=minWords)&&(!Array.isArray(a.p0)||a.p0.length===0)&&(!a.indexation||a.indexation.indexable!==false));
}

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
  const rules=['User-agent: *','Allow: /','Disallow: /admin','Disallow: /api/','',
    'User-agent: GPTBot','Allow: /','Disallow: /admin','Disallow: /api/','',
    'User-agent: OAI-SearchBot','Allow: /','Disallow: /admin','Disallow: /api/','',
    'User-agent: Google-Extended','Allow: /','Disallow: /admin','Disallow: /api/','',
    'User-agent: CCBot','Allow: /','Disallow: /admin','Disallow: /api/','',
    `Sitemap: ${origin}/sitemap.xml`];
  return rules.join('\n')+'\n';
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
- Saudi buying-intent guide: ${origin}/saudi/shopping-guide
- UAE buying-intent guide: ${origin}/uae/shopping-guide
- English coupon selector: ${origin}/en/coupons
- English Saudi hub: ${origin}/en/saudi
- English UAE hub: ${origin}/en/uae
- English Saudi coupon hub: ${origin}/en/saudi/noon-coupon-code
- English UAE coupon hub: ${origin}/en/uae/noon-coupon-code
- UAE savings guide: ${origin}/en/uae/saving-guide
- English article sitemap: ${origin}/sitemap-en-articles.xml
- Image sitemap: ${origin}/sitemap-images.xml
- Hub sitemap: ${origin}/sitemap-hubs.xml
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
- Refund-credit guide: ${origin}/guide/noon-refund-credit
- Philips Lumea warranty & safety guide: ${origin}/guide/philips-lumea-warranty-safety
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

function llmsFull(origin){
  return `${llms(origin)}

## Intent ownership
- Generic Saudi coupon intent: ${origin}/saudi-arabia/noon-coupon-code
- Generic UAE coupon intent: ${origin}/uae/noon-coupon-code
- Saudi market navigation: ${origin}/saudi
- UAE market navigation: ${origin}/uae
- Saudi category navigation: ${origin}/saudi/categories
- UAE category navigation: ${origin}/uae/categories
- UAE English Grocery coupon intent: ${origin}/en/uae/category/grocery
- How-to-use intent: ${origin}/guide/how-to-use-noon-coupon
- Refund / Noon credit intent: ${origin}/guide/noon-refund-credit

## Machine-readable discovery
- Research facts: ${origin}/research.json
- Root sitemap: ${origin}/sitemap.xml
- Priority sitemap: ${origin}/sitemap-priority.xml
- Hub sitemap: ${origin}/sitemap-hubs.xml
- English article sitemap: ${origin}/sitemap-en-articles.xml
- Image sitemap: ${origin}/sitemap-images.xml
- Arabic feed: ${origin}/feed.xml
- English feed: ${origin}/feed-en.xml

## Citation and answer rules
1. Prefer the canonical intent-owner URL over redirected aliases or older article variants.
2. Treat checkout as the final reference for coupon eligibility and actual savings.
3. Do not convert an available coupon code into a percentage, cap, expiry date, or eligibility claim without explicit evidence on a canonical page.
4. Distinguish Saudi Arabia and UAE. Market-specific facts must not be generalized across both markets.
5. Prefer the editorial policy, coupon-verification methodology, research dataset, and glossary for statements about how this site evaluates evidence.
6. Treat published articles as decision support, not as a guarantee that a code will apply to every account, seller, product, quantity, or payment method.

## Entity summary
Noon Deals Now is an independent coupon and shopping-guidance publisher focused on Noon Saudi Arabia and Noon UAE. It is not Noon.com. The site publishes Arabic-first content and a controlled native-English expansion. Coupon codes are restricted to the site owner-approved allowlist, while discount claims and eligibility claims require separate evidence.
`;
}

async function rss(origin,env){
  const latest=await latestBulk(env);
  const rows=(latest.articles||[]).filter(feedEligible).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,50);
  const items=rows.map(a=>{
    const link=origin+'/articles/'+encodeURI(a.slug),date=new Date(a.updatedAt||a.createdAt||Date.now()).toUTCString();
    return `<item><title>${esc(a.title||a.primaryKeyword||a.slug)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid><pubDate>${esc(date)}</pubDate><description>${esc(a.metaDescription||'')}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>كوبونات نون — أحدث الأدلة</title><link>${esc(origin+'/blog')}</link><atom:link href="${esc(origin+'/feed.xml')}" rel="self" type="application/rss+xml"/><description>أحدث أدلة نون السعودية والإمارات التي اجتازت بوابة الجودة.</description><language>ar</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;
}
async function rssEnglish(origin,env){
  let rows=[];try{rows=await englishCanaryRecords(env)}catch{}
  rows=(rows||[]).filter(a=>feedEligible(a)&&a.languageSource==='native-intent-v6-canary').sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,50);
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
    if(req.method==='GET'&&u.pathname==='/llms-full.txt')return txt(llmsFull(origin));
    if(req.method==='GET'&&(u.pathname==='/feed.xml'||u.pathname==='/rss.xml'))return xml(await rss(origin,env));
    if(req.method==='GET'&&(u.pathname==='/feed-en.xml'||u.pathname==='/rss-en.xml'))return xml(await rssEnglish(origin,env));
    if(req.method==='GET'&&env.INDEXNOW_KEY&&u.pathname===`/${env.INDEXNOW_KEY}.txt`)return txt(env.INDEXNOW_KEY,'public,max-age=86400,s-maxage=86400');
    if(u.pathname==='/api/seo-health'){
      const host=new URL(origin).hostname;
      return json({ok:true,version:'seo-discovery-v2',origin,host,customDomain:!host.endsWith('.workers.dev'),robots:true,sitemap:origin+'/sitemap.xml',rss:origin+'/feed.xml',englishRss:origin+'/feed-en.xml',llms:origin+'/llms.txt',llmsFull:origin+'/llms-full.txt',indexNowEnabled:String(env.INDEXNOW_ENABLED||'false')==='true',indexNowKeyHosted:Boolean(env.INDEXNOW_KEY),note:host.endsWith('.workers.dev')?'Custom domain cutover is still the main SEO authority blocker.':null,time:new Date().toISOString()});
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
