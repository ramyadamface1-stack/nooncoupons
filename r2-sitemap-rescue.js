// Temporary SEO discovery for published articles copied to the existing new R2 bucket.
// Zero R2 writes from Workers, no scans of the 240k corpus per request, no new resources.
import {signedR2Read} from './r2-emergency-readonly.js';
const HOME='https://noondealsnow.com',VERSION='rescue-index-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const cache=new Map();
function reply(body,status=200,extra={}){
  return new Response(body,{status,headers:{'content-type':'application/xml; charset=utf-8','cache-control':status===200?'public,max-age=600,s-maxage=1800,stale-while-revalidate=3600':'no-store','x-robots-tag':status===200?'all':'noindex','x-rescue-sitemap':VERSION,...extra}});
}
async function readMirrored(env,key,ttlMs=120000){
  const previous=cache.get(key);
  if(previous&&previous.until>Date.now())return previous.value;
  const result=await signedR2Read(env,key);
  if(result.status===404)return null;
  if(!result.ok)throw new Error('rescue_sitemap_r2_status_'+result.status);
  const body=await result.text();
  if(ttlMs){
    cache.set(key,{value:body,until:Date.now()+ttlMs});
    if(cache.size>9)cache.delete(cache.keys().next().value);
  }
  return body;
}
function image(slug,coupon,country,variant){
  const approved=/^NOV\d{2,4}$/.test(coupon||'')?coupon:(country==='AE'?'NOV188':'NOV170');
  return HOME+'/assets/coupon-svg/'+encodeURI(slug)+'/'+variant+'.svg?v=9&amp;coupon='+encodeURIComponent(approved)+'&amp;country='+(country==='AE'?'AE':'SA');
}
function active(a){
  if(!a||!a.slug||a.status==='draft'||a.status==='scheduled'||a.indexable===false||a.superseded===true||a.orphan===true)return false;
  if(a.quality!=null&&Number(a.quality)<90)return false;
  return true;
}
function path(a){return a.slug.startsWith('en-')||a.languageSource==='native-intent-v6-canary'||a.lang==='en'?'/en/articles/':'/articles/'}
async function recent(env,imagesOnly=false,englishOnly=false){
  const raw=await readMirrored(env,'bulk/latest.json',120000);
  if(!raw)return reply('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',503);
  const data=JSON.parse(raw);
  const seen=new Set();
  const rows=(data.articles||[]).filter(active).filter(a=>!englishOnly||path(a)==='/en/articles/').filter(a=>{
    const slug=a.slug;if(seen.has(slug))return false;seen.add(slug);return true;
  }).slice(0,imagesOnly?500:4000);
  const xml=rows.map(a=>{
    const url=HOME+path(a)+encodeURI(a.slug),country=a.country==='AE'?'AE':'SA',coupon=String(a.coupon||a.code||'').toUpperCase();
    const lastmod=a.updatedAt||a.publishedAt||a.createdAt||'';
    const articleImage='<image:image><image:loc>'+image(a.slug,coupon,country,1)+'</image:loc><image:title>'+esc(a.title||a.slug)+'</image:title></image:image>';
    return '<url><loc>'+esc(url)+'</loc>'+(imagesOnly?'':lastmod&&/^\d{4}-\d\d-\d\d/.test(lastmod)?'<lastmod>'+esc(lastmod)+'</lastmod>':'')+articleImage+'</url>';
  }).join('');
  const document='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+xml+'</urlset>';
  return reply(document,200,{'x-rescue-sitemap-urls':String(rows.length)});
}
async function staticFiles(env,path){
  const isIndex=path==='/sitemap-rescue-articles.xml';
  const match=path.match(/^\/sitemap-rescue-articles-(\d{4})\.xml$/);
  if(!isIndex&&!match)return null;
  const raw=await readMirrored(env,'seo-rescue/index.json',300000);
  if(!raw)return reply('Sitemap pending',503);
  const manifest=JSON.parse(raw);
  if(manifest.version!==1||!Number.isInteger(manifest.count)||manifest.count<100||!Array.isArray(manifest.segments)||!manifest.segments.length)return reply('Invalid curated index',503);
  if(isIndex){
    const xml='<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
      manifest.segments.map(x=>'<sitemap><loc>'+HOME+'/sitemap-rescue-articles-'+String(x.n).padStart(4,'0')+'.xml</loc></sitemap>').join('')+'</sitemapindex>';
    return reply(xml,200,{'x-rescue-curated-articles':String(manifest.count),'x-rescue-curated-shards':String(manifest.segments.length)});
  }
  const n=Number(match[1]);
  if(!Number.isInteger(n)||n<0||n>=manifest.segments.length||manifest.segments[n]?.n!==n)return reply('Not found',404);
  const segment=await readMirrored(env,'seo-rescue/articles-'+n+'.json',300000);
  if(!segment)return reply('Segment unavailable',503);
  const data=JSON.parse(segment);
  if(!Array.isArray(data.articles)||data.articles.length>2500||data.articles.length<1)return reply('Invalid segment',503);
  const entries=data.articles.map(a=>{
    if(typeof a.slug!=='string'||a.slug.length>280||a.slug.includes('/')||a.slug.includes('..')||!['SA','AE'].includes(a.country))return '';
    const url=HOME+'/articles/'+encodeURI(a.slug);
    const date=/^\d{4}-\d{2}-\d{2}$/.test(a.lastmod||'')?'<lastmod>'+a.lastmod+'</lastmod>':'';
    const coupon=String(a.code||'').toUpperCase(),qualified=/^NOV\d{2,4}$/.test(coupon);
    const img=qualified?'<image:image><image:loc>'+image(a.slug,coupon,a.country,1)+'</image:loc></image:image>':'';
    return '<url><loc>'+esc(url)+'</loc>'+date+img+'</url>';
  }).join('');
  return reply('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+entries+'</urlset>',200,{'x-rescue-curated-segment':String(n),'x-rescue-curated-urls':String(data.articles.length)});
}
export async function rescueSitemapResponse(req,env){
  const u=new URL(req.url),p=u.pathname;
  if(req.method!=='GET'||String(env.R2_RESCUE_READONLY_ENABLED||'')!=='true')return null;
  try{
    if(p==='/sitemap-rescue-recent.xml')return await recent(env,false,false);
    if(p==='/sitemap-images.xml')return await recent(env,true,false);
    if(p==='/sitemap-en-articles.xml'){
      const old=await recent(env,false,true);
      const found=Number(old.headers.get('x-rescue-sitemap-urls')||0);
      return found?old:null;
    }
    return await staticFiles(env,p);
  }catch(e){
    console.warn('rescue_sitemap_failure',String(e?.message||e).slice(0,120));
    return reply('Sitemap temporarily unavailable',503);
  }
}
export const RESCUE_SITEMAP_VERSION=VERSION;
