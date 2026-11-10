// Public-only cache guard: a verified canonical route and strictly harmless tracking state.
// Auth/admin/API requests and content-changing query parameters always bypass this cache.
const STATIC_PUBLIC=new Set(['/','/coupons','/blog','/blog/saudi','/blog/uae','/saudi','/uae','/saudi/categories','/uae/categories','/saudi/shopping-guide','/uae/shopping-guide','/en/coupons','/en/uae/saving-guide','/en/saudi','/en/uae']);
const ANALYTICS_COOKIE=/^(?:_ga(?:_[A-Za-z0-9]+)?|_gid|_gat(?:_[A-Za-z0-9]+)?|_gcl_au|_fbp|_fbc|__utm[a-z]+)$/;
const TRACKING_QUERY=/^(?:utm_[a-z0-9_]+|gclid|fbclid|msclkid|igshid)$/i;
export function publicRouteKind(path){
  const p=path.replace(/\/+$/,'')||'/';
  if(/^\/(?:articles|en\/articles)\/[^/]+$/.test(p))return 'article';
  if(/^\/sitemap(?:-[a-z0-9-]+)?\.xml$/.test(p)||p==='/feed.xml'||p==='/rss.xml'||p==='/feed-en.xml'||p==='/rss-en.xml')return 'xml';
  if(STATIC_PUBLIC.has(p))return 'page';
  // The read-only new-account R2 archive has expensive cross-account GETs.
  // Cache only the canonical first page; cursor/page parameters still bypass cache.
  if(p==='/blog/archive'||p==='/blog/archive/all'||p==='/blog/archive/full'||p==='/blog/archive/english'||/^\/blog\/archive\/english\/catalog(?:\/[1-9]\d{0,4})?$/.test(p)||/^\/blog\/archive\/catalog(?:\/[1-9]\d{0,4})?$/.test(p)||/^\/blog\/archive\/20\d{2}-\d{2}-\d{2}$/.test(p))return 'page';
  if(/^\/(?:saudi|uae)\/(?:category|brand|model|compare)\/[^/]+(?:\/[^/]+)?$/.test(p))return 'page';
  if(/^\/en\/(?:saudi|uae)\/noon-coupon-code$/.test(p))return 'page';
  if(/^\/en\/(?:saudi|uae)\/(?:category|product)\/[^/]+$/.test(p))return 'page';
  if(/^\/(?:saudi-arabia|uae)\/noon-coupon-code(?:-today|-2026)?$/.test(p))return 'page';
  if(/^\/(?:saudi-arabia|uae)\/coupon\/[^/]+$/.test(p))return 'page';
  return null;
}
function analyticsCookiesOnly(req){
  const raw=req.headers.get('cookie')||'';
  return !raw||raw.split(';').every(part=>{
    const name=part.trim().split('=')[0];
    return name&&ANALYTICS_COOKIE.test(name);
  });
}
export function publicEdgeCacheEligible(req,u=new URL(req.url)){
  if(req.method!=='GET'||req.headers.has('authorization')||req.headers.has('range'))return false;
  const kind=publicRouteKind(u.pathname);
  if(!kind||!analyticsCookiesOnly(req))return false;
  if(!u.search)return true;
  return kind==='article'&&[...u.searchParams.keys()].every(key=>TRACKING_QUERY.test(key));
}
// Page-specific cache version: invalidate only old article HTML when a fix
// changes its SEO/schema presentation. Keep expensive archive/catalog cache warm.
export function publicEdgePolicyRevision(path,baseRevision='r2-jsonld-dedupe-r16'){
  const kind=publicRouteKind(String(path||''));
  if(String(path||'')==='/en/articles/en-iphone-18-pro-max-noon-abu-dhabi-price')
    return 'legacy-1102-cpu-canary-r2-direct-v1';
  if(kind==='article')return 'r2-rescue-security-ga4-topic-links-v21-nativefast-cpu';
  // Refresh only these two English coupon pages after enforcing market lists,
  // canonical detail links and real clipboard copy actions.
  if(/^\/en\/(?:saudi|uae)\/noon-coupon-code$/.test(String(path||'').replace(/\/+$/,'')))
    return 'english-market-coupon-copy-canonical-v1';
  // Country hubs previously featured a secondary code and omitted direct links to
  // the approved market-primary canonical detail; refresh these four small pages only.
  if(['/saudi','/uae','/en/saudi','/en/uae'].includes(String(path||'').replace(/\/+$/,'')))
    return 'primary-market-nov-canonical-v1';
  // Invalidate only the /coupons HTML assembled before visible canonical detail links.
  if((String(path||'').replace(/\/+$/,'')||'/')==='/coupons')return 'nov-coupon-detail-links-v1';
  // Ensure old market sitemaps are replaced immediately after the canonical market fix.
  if(/^\/sitemap-coupons-(?:saudi|uae)\.xml$/.test(String(path||'')))return 'market-coupon-canonical-v3';
  if(['/blog','/blog/saudi','/blog/uae'].includes(String(path||'').replace(/\/+$/,'')))return 'r2-complete-blog-r2-cursor-v19';
  return baseRevision;
}

export function publicEdgeTtlSeconds(path){
  // seo-rescue segments are immutable historical snapshots. Increasing this
  // cache TTL avoids expensive 2k-URL sitemap reconstruction per Cloudflare PoP.
  // The live recent/new article sitemaps keep their short refresh intervals.
  if(/^\/sitemap-rescue-(?:articles|images|english|english-images)-\d{1,4}\.xml$/.test(path))return 86400;
  if((path.replace(/\/+$/,'')||'/')==='/sitemap-live-recent.xml')return 60;
  if(['/blog','/blog/saudi','/blog/uae'].includes(path.replace(/\/+$/,'')||'/'))return 30;
  const kind=publicRouteKind(path);
  return kind==='article'?600:kind==='xml'?900:300;
}
