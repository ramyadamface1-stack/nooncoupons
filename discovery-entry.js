import app from './brand-runtime.js';
export {ControlPlane,GeneratorControl} from './brand-runtime.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const enc=s=>encodeURI(String(s||''));

async function latest(env){
  try{
    if(!env.CONTENT_FINAL)return {articles:[]};
    const o=await env.CONTENT_FINAL.get('bulk/latest.json');
    return o?await o.json():{articles:[]};
  }catch{return {articles:[]}}
}

function keyPages(origin){
  return [
    '/',
    '/coupons',
    '/blog',
    '/saudi-arabia/noon-coupon-code',
    '/saudi-arabia/noon-coupon-code-today',
    '/saudi-arabia/noon-coupon-code-2026',
    '/uae/noon-coupon-code',
    '/uae/noon-coupon-code-today',
    '/uae/noon-coupon-code-2026'
  ].map(path=>({loc:origin+path,lastmod:null}));
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
  if(!body.includes('/sitemap-priority.xml')){
    if(/<sitemapindex\b/i.test(body))body=body.replace(/<\/sitemapindex>/i,`<sitemap><loc>${esc(origin)}/sitemap-priority.xml</loc></sitemap></sitemapindex>`);
    else if(/<urlset\b/i.test(body))body=body.replace(/<\/urlset>/i,`<url><loc>${esc(origin)}/sitemap-priority.xml</loc></url></urlset>`);
  }
  const h=new Headers(res.headers);h.delete('content-length');h.set('x-priority-sitemap-discovery','v1');
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(req.method==='GET'&&u.pathname==='/sitemap-priority.xml')return prioritySitemap(env,origin);
    let res=await app.fetch(req,env,ctx);
    if(req.method==='GET'&&u.pathname==='/sitemap.xml')res=await augmentRootSitemap(res,origin);
    return res;
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const DISCOVERY_ENTRY_INFO={version:1,wraps:'brand-runtime',prioritySitemap:'/sitemap-priority.xml',recentArticleLimit:500,keyCommercialPages:9};
