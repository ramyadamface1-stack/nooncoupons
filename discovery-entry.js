import app from './brand-runtime.js';
export {ControlPlane,GeneratorControl} from './brand-runtime.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const enc=s=>encodeURI(String(s||''));
let latestCache={at:0,value:null};

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
    '/privacy'
  ].map(path=>({loc:origin+path,lastmod:null}));
}

function marketForPath(path){return path.startsWith('/uae/')?'AE':path.startsWith('/saudi-arabia/')?'SA':null}
function discoveryHtml(path,articles){
  const market=marketForPath(path);
  let rows=(articles||[]).filter(a=>a?.slug&&a.indexable!==false);
  if(market)rows=rows.filter(a=>a.country===market);
  rows=rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,12);
  if(!rows.length)return '';
  const country=market==='AE'?'الإمارات':market==='SA'?'السعودية':'السعودية والإمارات';
  const links=rows.map(a=>`<li><a href="/articles/${enc(a.slug)}">${esc(a.title||a.primaryKeyword||a.slug)}</a></li>`).join('');
  return `<section id="crawl-discovery-links" dir="rtl" aria-label="أحدث أدلة نون"><div style="width:min(1050px,92%);margin:34px auto;padding:22px;border:1px solid #e5e7eb;border-radius:18px;background:#fff"><strong>أحدث أدلة نون ${country}</strong><p style="color:#64748b;line-height:1.8">روابط مباشرة إلى أحدث الأدلة التي اجتازت بوابة الجودة لمساعدة محركات البحث والزوار على اكتشاف المحتوى الجديد.</p><ul style="columns:2;gap:28px;line-height:1.9">${links}</ul><p><a href="/blog">كل الأدلة</a> · <a href="/coupons">كل الكوبونات</a></p></div></section>`;
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
    .filter(a=>a?.slug&&a.indexable!==false)
    .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))
    .slice(0,500)
    .map(a=>({loc:origin+'/articles/'+enc(a.slug),lastmod:a.updatedAt||a.createdAt||null}));
  const seen=new Set(),rows=[];
  for(const row of [...keyPages(origin),...articles]){
    if(seen.has(row.loc))continue;
    seen.add(row.loc);rows.push(row);
  }
  const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(x=>`<url><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:''}</url>`).join('')}</urlset>`;
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900, stale-while-revalidate=86400','x-robots-tag':'all','x-priority-sitemap-count':String(rows.length),'x-priority-sitemap':'v1'}});
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
  if(!body.includes(root))body=(body.trimEnd()+`\n${root}\n`).replace(/^\n+/, '');
  if(!body.includes(priority))body=(body.trimEnd()+`\n${priority}\n`).replace(/^\n+/, '');
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-priority-sitemap-robots','v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(req.method==='GET'&&u.pathname==='/sitemap-priority.xml')return prioritySitemap(env,origin);
    let res=await app.fetch(req,env,ctx);
    if(req.method==='GET'&&u.pathname==='/sitemap.xml')res=await augmentRootSitemap(res,origin);
    if(req.method==='GET'&&u.pathname==='/robots.txt')res=await augmentRobots(res,origin);
    res=await injectDiscoveryLinks(req,env,res);
    return res;
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const DISCOVERY_ENTRY_INFO={version:4,wraps:'brand-runtime',prioritySitemap:'/sitemap-priority.xml',recentArticleLimit:500,keyPriorityPages:18,discoveryLinks:true,discoveryLinkCount:12,discoveryHubs:['/','/coupons','/blog','/saudi','/uae','/saudi/categories','/uae/categories'],robotsPrioritySitemap:true,manifestCacheSeconds:120};
