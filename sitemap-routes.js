const ORIGIN='https://nooncoupons.ramychatgptgcoupons.workers.dev';
const CODES=['NOV170','NOV188','NOV174','NOV157','NOV177','NOV186','NOV163','NOV153','NOV195','NOV161'];
const TRUST=['/editorial-policy','/coupon-verification','/authors/editorial-team','/disclaimer','/terms'];
const MAPS=['/sitemap-pages.xml','/sitemap-categories.xml','/sitemap-articles.xml','/sitemap-coupons.xml','/sitemap-coupons-saudi.xml','/sitemap-coupons-uae.xml','/sitemap-stores.xml'];
const xml=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const urlset=urls=>`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(urls)].map(u=>`<url><loc>${esc(u)}</loc></url>`).join('')}</urlset>`;
export function sitemapIndex(){return xml(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${MAPS.map(p=>`<sitemap><loc>${ORIGIN}${p}</loc></sitemap>`).join('')}</sitemapindex>`)}
async function baseUrls(app,env,ctx){const res=await app.fetch(new Request(ORIGIN+'/sitemap.xml'),env,ctx);const text=await res.text();return [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'))}
export async function splitMap(path,app,env,ctx){const urls=await baseUrls(app,env,ctx);const p=u=>{try{return new URL(u).pathname}catch{return''}};let out=[];
if(path==='/sitemap-pages.xml')out=urls.filter(u=>!p(u).startsWith('/category/')&&!p(u).startsWith('/guide/')&&!p(u).startsWith('/coupon/')).concat(TRUST.map(x=>ORIGIN+x),[ORIGIN+'/faq',ORIGIN+'/store/noon']);
if(path==='/sitemap-categories.xml')out=urls.filter(u=>p(u).startsWith('/category/'));
if(path==='/sitemap-articles.xml')out=urls.filter(u=>p(u).startsWith('/guide/'));
if(path==='/sitemap-coupons.xml')out=urls.filter(u=>p(u).startsWith('/coupon/'));
if(path==='/sitemap-coupons-saudi.xml')out=CODES.map(c=>`${ORIGIN}/saudi-arabia/coupon/${c.toLowerCase()}`);
if(path==='/sitemap-coupons-uae.xml')out=CODES.map(c=>`${ORIGIN}/uae/coupon/${c.toLowerCase()}`);
if(path==='/sitemap-stores.xml')out=[ORIGIN+'/store/noon'];
return xml(urlset(out))}
export function isSplitSitemap(path){return MAPS.includes(path)}
