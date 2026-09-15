import app from './visual-platform.js';
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
  return `# كوبونات نون\n\nArabic shopping and coupon guidance for Noon Saudi Arabia and UAE.\n\nCanonical site: ${origin}/\nSitemap: ${origin}/sitemap.xml\nRSS: ${origin}/feed.xml\nEditorial policy: ${origin}/editorial-policy\nCoupon verification policy: ${origin}/coupon-verification\nEditorial team: ${origin}/authors/editorial-team\nDisclaimer: ${origin}/disclaimer\n\nArticles are published only after automated quality, uniqueness, indexation, schema and coupon-freshness gates. The site is independent and is not Noon.com.\n`;
}

async function rss(origin,env){
  const latest=await latestBulk(env);
  const items=(latest.articles||[]).filter(a=>a?.slug&&a?.indexable!==false).slice(0,50).map(a=>{
    const link=origin+'/articles/'+encodeURI(a.slug),date=new Date(a.updatedAt||a.createdAt||Date.now()).toUTCString();
    return `<item><title>${esc(a.title||a.primaryKeyword||a.slug)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid><pubDate>${esc(date)}</pubDate><description>${esc(a.metaDescription||'')}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>كوبونات نون — أحدث الأدلة</title><link>${esc(origin+'/blog')}</link><description>أحدث أدلة نون السعودية والإمارات التي اجتازت بوابة الجودة.</description><language>ar</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(req.method==='GET'&&u.pathname==='/robots.txt')return txt(robots(origin));
    if(req.method==='GET'&&u.pathname==='/llms.txt')return txt(llms(origin));
    if(req.method==='GET'&&(u.pathname==='/feed.xml'||u.pathname==='/rss.xml'))return xml(await rss(origin,env));
    if(req.method==='GET'&&env.INDEXNOW_KEY&&u.pathname===`/${env.INDEXNOW_KEY}.txt`)return txt(env.INDEXNOW_KEY,'public,max-age=86400,s-maxage=86400');
    if(u.pathname==='/api/seo-health'){
      const host=new URL(origin).hostname;
      return json({ok:true,version:'seo-discovery-v1',origin,host,customDomain:!host.endsWith('.workers.dev'),robots:true,sitemap:origin+'/sitemap.xml',rss:origin+'/feed.xml',llms:origin+'/llms.txt',indexNowEnabled:String(env.INDEXNOW_ENABLED||'false')==='true',indexNowKeyHosted:Boolean(env.INDEXNOW_KEY),note:host.endsWith('.workers.dev')?'Custom domain cutover is still the main SEO authority blocker.':null,time:new Date().toISOString()});
    }
    if(u.pathname==='/api/visual-health'){
      const s=await stateViaApp(u.origin,env,ctx);
      const published=(s.articles||[]).filter(a=>a.status==='published');
      return json({
        ok:true,
        version:'visual-v4',
        svgEngine:true,
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
        templateText:{discount:'10% OFF',audience:'SAVE 10% • NEW & EXISTING USERS'},
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
