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
  if(p==='/blog/archive'||p==='/blog/archive/all'||p==='/blog/archive/full'||p==='/blog/archive/english'||/^\/blog\/archive\/20\d{2}-\d{2}-\d{2}$/.test(p))return 'page';
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
export function publicEdgeTtlSeconds(path){
  const kind=publicRouteKind(path);
  return kind==='article'?600:kind==='xml'?900:300;
}
