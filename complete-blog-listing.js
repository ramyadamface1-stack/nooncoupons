import {refreshCurrentSeasonLabel} from './article-temporal-freshness.js';
import {normalizeMarketCoupon} from './approved-coupons.js';
import {renderCouponAction,rescueCopyScript} from './rescue-article-conversion.js';
// Read-only, bounded all-article browser for /blog, /blog/saudi and /blog/uae.
// Uses the existing R2 bucket. No deletion, migration, new resources or full-corpus scan.
// R2 uses lexicographic key order; the newest-publication feed remains a separate
// small, clearly labelled shortcut. A startAfter key prevents skipped records
// when filtering or stopping midway through a listed R2 page.
const SIZE=15,MAX_LIST_CALLS=16,MARKET_BATCH=256;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('ar-EG');
const safeResumeKey=k=>typeof k==='string'&&k.startsWith('articles/')&&k.length<=600&&
  !k.includes('..')&&!/[\x00-\x1f\x7f]/.test(k);
const safeSlugKey=k=>safeResumeKey(k)&&/^articles\/[^/]{1,300}\.html$/u.test(k);
const safeDate=x=>{try{const ms=Date.parse(String(x||''));return Number.isFinite(ms)?new Date(ms).toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo'}):null}catch{return null}};
const safeDateTime=x=>{try{const ms=Date.parse(String(x||''));return Number.isFinite(ms)?new Date(ms).toLocaleString('ar-EG',{timeZone:'Africa/Cairo',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}):null}catch{return null}};
export function verifiedRowEditorialDate(meta,publishedAt,now=new Date()){
 const modified=String(meta?.editorialUpdatedAt||meta?.substantiveUpdatedAt||'');
 const base=Date.parse(String(publishedAt||'')),update=Date.parse(modified);
 return Number.isFinite(base)&&Number.isFinite(update)&&update>base&&update<=now.getTime()
   ?new Date(update).toISOString():null;
}
export function fullBlogMarketOf(o){
 const md=o?.customMetadata||{},slug=String(o?.key||'').slice(9,-5);
 const market=String(md.c||md.country||md.market||'').toUpperCase();
 if(['SA','AE'].includes(market))return market;
 if(/(?:^|[-_])(?:uae|ae|emirates|dubai|abudhabi)(?:[-_]|$)|الإمارات|دبي|أبوظبي|^en-/i.test(slug))return 'AE';
 if(/(?:^|[-_])(?:saudi|sa|ksa|riyadh|jeddah)(?:[-_]|$)|السعودية|الرياض|جدة/i.test(slug))return 'SA';
 return 'SA'; // Unlabelled older files are never omitted from the all-market blog.
}
export function fullBlogRowFromObject(o,market=null){
 const key=String(o?.key||'');
 if(!safeSlugKey(key))return null;
 const md=o.customMetadata||{};
 if(md.status&&String(md.status).toLowerCase()!=='published')return null;
 // Published noindex articles are still browseable: listing visibility is not SEO indexing.
 const country=fullBlogMarketOf(o);
 if(market&&country!==market)return null;
 const slug=key.slice(9,-5),english=String(md.lang||md.language||'').toLowerCase().startsWith('en')||slug.startsWith('en-');
 let rawTitle=md.t||md.title||slug;
 try{rawTitle=decodeURIComponent(String(rawTitle))}catch{}
 const title=refreshCurrentSeasonLabel(String(rawTitle).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim()).slice(0,230);
 const href=(english?'/en/articles/':'/articles/')+encodeURIComponent(slug);
 const publishedAt=md.publishedAt||md.datePublished||md.at||null;
 return {key,slug,title: title||slug,country,english,href,coupon:normalizeMarketCoupon(md.cp||md.coupon,country),
   publishedAt,editorialUpdatedAt:verifiedRowEditorialDate(md,publishedAt),uploaded:o.uploaded||null};
}
/** Does not overscan past an emitted key. On partial-filter pages, consumes each
 * visited key exactly once and resumes after the last scanned key. R2 LIST may
 * return metadata on native bindings but the remote S3 adapter does not. */
export async function listFullBlogPublished(env,{market=null,after='',pageSize=SIZE,maxCalls=MAX_LIST_CALLS}={}){
 if(!env?.CONTENT_FINAL?.list)throw Error('FULL_BLOG_R2_LIST_UNAVAILABLE');
 if(market!==null&&!['SA','AE'].includes(market))throw Error('FULL_BLOG_INVALID_MARKET');
 if(after&&!safeResumeKey(after))throw Error('FULL_BLOG_INVALID_CURSOR');
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>15||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>16)
   throw Error('FULL_BLOG_INVALID_LIMIT');
 const rows=[],seen=new Set();
 let pointer=after,more=false,calls=0,scanned=0,lastScanned=after,complete=false;
 while(calls<maxCalls&&rows.length<pageSize){
   // A spare entry is enough to know whether a nonfiltered page has a successor.
   // Filtered pages read larger bounded blocks; stopping at the 15th match is
   // safe because the next page starts after that exact key, not the R2 cursor.
   const wanted=market?MARKET_BATCH:pageSize+1;
   const batch=await env.CONTENT_FINAL.list({prefix:'articles/',limit:wanted,
     ...(pointer?{startAfter:pointer}:{}),include:['customMetadata']});
   calls++;
   if(!batch||!Array.isArray(batch.objects))throw Error('FULL_BLOG_BAD_R2_LIST');
   const objects=batch.objects;
   let stopped=false;
   for(let i=0;i<objects.length;i++){
     const o=objects[i],key=String(o?.key||'');
     if(!safeResumeKey(key))continue;
     scanned++;lastScanned=key;
     const row=fullBlogRowFromObject(o,market);
     if(!row||seen.has(row.key))continue;
     seen.add(row.key);rows.push(row);
     if(rows.length===pageSize){
       more=i<objects.length-1||batch.truncated===true;
       pointer=key;stopped=true;break;
     }
   }
   if(stopped){complete=!more;break}
   if(batch.truncated!==true){more=false;complete=true;break}
   if(!objects.length||lastScanned===pointer)throw Error('FULL_BLOG_CURSOR_STALLED');
   pointer=lastScanned;
   more=true;
 }
 if(rows.length<pageSize&&!complete)more=true;
 return {rows,more,nextAfter:more?(rows.length===pageSize?pointer:lastScanned):null,
   scanned,calls,pageSize,complete:!more};
}
const pth=(market)=>market==='SA'?'/blog/saudi':market==='AE'?'/blog/uae':'/blog';
const label=m=>m==='SA'?'نون السعودية':m==='AE'?'نون الإمارات':'السعودية والإمارات';
// Buyer-first snippets: internal storage/cursor terminology does not help
// people decide which market, guide or coupon is right for their shopping cart.
export function fullBlogSeo(market){
 if(market==='SA')return {
   title:'مدونة نون السعودية | أدلة الشراء وكود خصم NOV170',
   description:'تصفح أدلة الشراء ومقارنات المنتجات على نون السعودية. انسخ كوبون NOV170، واعرف خطوات تجربته وشروط الأهلية قبل الدفع.'
 };
 if(market==='AE')return {
   title:'مدونة نون الإمارات | أدلة الشراء وكود خصم NOV188',
   description:'تصفح أدلة شراء ومقارنات المنتجات على نون الإمارات. انسخ كوبون NOV188، واعرف طريقة تجربته ومراجعة إجمالي السلة قبل الدفع.'
 };
 return {
   title:'مدونة أكواد خصم نون السعودية والإمارات | أدلة الشراء',
   description:'أدلة شراء ومقارنات منتجات نون السعودية والإمارات. اختر سوقك، انسخ كود الخصم المناسب، وتعرف على شروط استخدامه قبل إتمام الطلب.'
 };
}
// The complete R2 /blog exits before brand-runtime's normal GA4 injection.
// Restore the site's already-configured property here, without double pageviews
// or external loading when the visitor enabled Do Not Track.
export const completeBlogAnalytics=String.raw`<script id="complete-blog-ga4">(function(){
if(navigator.doNotTrack==='1'||window.doNotTrack==='1')return;
var g=document.createElement('script');g.async=true;g.src='https://www.googletagmanager.com/gtag/js?id=G-1551Z7DJ2C';document.head.appendChild(g);
window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
window.gtag('js',new Date());window.gtag('config','G-1551Z7DJ2C');
})();</script>`;
export function blogMarketOffers(market){
 const markets=market==='SA'?['SA']:market==='AE'?['AE']:['SA','AE'];
 return '<section class="blog-market-offers" aria-label="انسخ كوبون نون حسب الدولة">'+
   markets.map(m=>renderCouponAction(m,false,'blog')).join('')+'</section>';
}
// The site's SVG image endpoint is deterministic and does not read the R2
// article body. For records with a coupon, use the same market-validated code
// as the article page; otherwise use the existing market-safe default.
function blogImageSrc(slug,country,coupon){
 const market=country==='AE'?'AE':'SA',code=normalizeMarketCoupon(coupon,market);
 return '/assets/coupon-svg/'+encodeURIComponent(slug)+'/1.svg?v=11&coupon='+encodeURIComponent(code)+'&country='+market;
}
function newLink(path,after){return path+'?after='+encodeURIComponent(after)}
async function readJson(env,key){
 try{const o=await env.CONTENT_FINAL.get(key);return o?await o.json():null}catch{return null}
}
export async function completeBlogResponse(env,url){
 const market=url.pathname==='/blog/saudi'?'SA':url.pathname==='/blog/uae'?'AE':null;
 const after=String(url.searchParams.get('after')||'');
 if(after.length>1000||after&&!safeResumeKey(after))return new Response('Invalid article cursor',{status:400,headers:{'cache-control':'no-store'}});
 if(!env?.CONTENT_FINAL?.list)return null; // Existing emergency/legacy rescue remains available.
 let page;
 try{page=await listFullBlogPublished(env,{market,after})}
 catch{return new Response('Article directory temporarily unavailable',{status:503,headers:{'cache-control':'no-store','retry-after':'120','x-robots-tag':'noindex,nofollow'}})}
 const [snapshot,recent]=await Promise.all([
   readJson(env,'_ops/article-count.json'),
   !after?readJson(env,'blog/latest-live-v1.json'):Promise.resolve(null)
 ]);
 const path=pth(market),{title,description}=fullBlogSeo(market);
 const origin='https://noondealsnow.com',canonical=origin+path;
 const items=page.rows.map(a=>'<article class="article-card" dir="'+(a.english?'ltr':'rtl')+'"><a class="card-image" href="'+esc(a.href)+'" aria-label="'+esc(a.title)+'"><img src="'+esc(blogImageSrc(a.slug,a.country,a.coupon))+'" alt="'+esc(a.title)+' — Noon '+(a.country==='AE'?'UAE':'Saudi Arabia')+'" width="1600" height="1000" loading="lazy" decoding="async"></a><div class="card-meta">'+(a.country==='AE'?'الإمارات':'السعودية')+(a.publishedAt&&safeDateTime(a.publishedAt)?' · نشر <time datetime="'+esc(a.publishedAt)+'">'+esc(safeDateTime(a.publishedAt))+'</time>':a.uploaded?' · محفوظ '+esc(safeDateTime(a.uploaded)||''):'')+(a.editorialUpdatedAt?' · آخر تحديث <time datetime="'+esc(a.editorialUpdatedAt)+'">'+esc(safeDateTime(a.editorialUpdatedAt))+'</time>':'')+'</div><h2><a href="'+esc(a.href)+'">'+esc(a.title)+'</a></h2><a class="read" href="'+esc(a.href)+'">'+(a.english?'Open article':'اقرأ المقال')+' ←</a></article>').join('');
 const count=Number(snapshot?.count),isCount=Number.isSafeInteger(count)&&count>0;
 const date=safeDate(snapshot?.countedAt);
 const countLine=isCount?'آخر جرد لملفات المقالات في R2: <strong>'+fmt(count)+'</strong>'+(date?' (بتاريخ '+esc(date)+')':'')+' — ليس عدًا مباشرًا لحظيًا':'جميع المقالات المحفوظة قابلة للتصفح حتى آخر صفحة';
 // The R2 object cursor must remain alphabetical to avoid skipping history.
 // Give visitors a separate, bounded newest-first discovery lane instead.
 const seenRecent=new Set();
 const latest=Array.isArray(recent?.articles)?recent.articles.filter(a=>{
   const slug=String(a?.slug||'');
   if(a?.status!=='published'||a?.indexable===false||!slug||slug.length>300||/[/?#]/.test(slug)||seenRecent.has(slug))return false;
   if(market&&a.country!==market)return false;
   seenRecent.add(slug);return true;
 }).sort((a,b)=>{
   const published=x=>Date.parse(x?.publishedAt||x?.createdAt||'')||0;
   return published(b)-published(a);
 }).slice(0,15):[];
 const quick=latest.length?'<aside class="latest"><h2>أحدث المقالات المنشورة</h2><p class="note">مرتبة حسب تاريخ النشر، والأرشيف الكامل أسفلها.</p><div>'+latest.map(a=>{
   const slug=String(a.slug),english=slug.startsWith('en-')||String(a.language||'').startsWith('en');
   const text=refreshCurrentSeasonLabel(String(a.title||slug)),href=(english?'/en/articles/':'/articles/')+encodeURIComponent(slug);
   const publishedAt=a.publishedAt||a.createdAt,when=safeDateTime(publishedAt);
   const thumb='<img class="latest-image" src="'+esc(blogImageSrc(slug,a.country,a.coupon||a.code))+'" alt="'+esc(text)+'" width="1600" height="1000" loading="lazy" decoding="async">';
   return '<article dir="'+(english?'ltr':'rtl')+'"><a href="'+esc(href)+'">'+thumb+esc(text)+'</a>'+(when?'<small><time datetime="'+esc(publishedAt)+'">'+esc(when)+'</time> · '+(a.country==='AE'?'الإمارات':'السعودية')+'</small>':'')+'</article>';
 }).join('')+'</div></aside>':'';
 const next=page.nextAfter?'<a rel="next" href="'+esc(newLink(path,page.nextAfter))+'">المقالات التالية ←</a>':'';
 const head='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+canonical+'"><meta name="robots" content="'+(after?'noindex,follow':'index,follow')+'">';
 const newestStyle='<style>.article-card .card-image{display:block;margin-bottom:12px}.article-card .card-image img{display:block;width:100%;height:auto;aspect-ratio:8/5;object-fit:contain;background:#fffdf0;border-radius:11px}.latest>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.latest article{padding:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;min-width:0}.latest article a{font-weight:700;overflow-wrap:anywhere}.latest article a img{display:block;width:100%;height:auto;aspect-ratio:8/5;object-fit:contain;border-radius:9px;margin-bottom:8px;background:#fffdf0}.latest article small{display:block;color:#475569;margin-top:5px}.latest .note{margin:0 0 12px}@media(max-width:750px){.latest>div{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.latest>div{grid-template-columns:1fr}}</style>';
 const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:title,url:canonical,mainEntity:{'@type':'ItemList',itemListElement:page.rows.map((a,i)=>({'@type':'ListItem',position:i+1,url:origin+a.href}))}}).replace(/</g,'\\u003c')+'</script>';
 const style='<style>*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#111827;font-family:Tahoma,Arial,sans-serif;line-height:1.75}a{color:#2638a4;text-decoration:underline;text-underline-offset:3px}header{background:#111827;color:#fff;padding:28px 0}header a{color:#fff}.w{width:min(1080px,92%);margin:auto}.links{display:flex;flex-wrap:wrap;gap:12px}.links a{padding:5px 9px}.hero p{color:#e5e7eb}.count{padding:12px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin:20px 0}.latest{padding:16px;background:#fff;border:1px solid #e5e7eb;border-radius:14px}.latest h2{font-size:18px;margin:0 0 10px}.latest div{display:flex;gap:14px;flex-wrap:wrap}.latest a{display:inline-block;max-width:310px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0}.article-card{padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;min-width:0}.article-card h2{font-size:19px;line-height:1.6;overflow-wrap:anywhere}.card-meta{color:#475569;font-size:13px}.read{font-weight:bold}.pager{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center;margin:26px auto 50px}.pager a{border:1px solid #cbd5e1;background:#fff;padding:9px 13px;border-radius:10px}.note{color:#475569;font-size:14px}.blog-market-offers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:20px 0}.blog-market-offers .rescue-offer{border:1px solid #cbd5e1;border-radius:14px;background:#fff;padding:16px;min-width:0}.blog-market-offers .rescue-offer__heading{display:flex;justify-content:space-between;gap:8px;font-weight:800}.blog-market-offers .rescue-offer__heading strong{font:800 1.35rem system-ui;color:#0f172a}.blog-market-offers .rescue-offer__buttons{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.blog-market-offers .rescue-offer__buttons>*{display:inline-flex;justify-content:center;align-items:center;flex:1 1 165px;min-height:46px;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer;text-align:center}.blog-market-offers .rescue-copy{background:#1d4ed8;border:2px solid #1d4ed8;color:#fff}.blog-market-offers .rescue-shop{border:2px solid #0f172a;background:#fff;color:#0f172a}.blog-market-offers .rescue-offer__note{font-size:.85rem;margin:6px 0;color:#475569}.blog-market-offers .rescue-copy-status{min-height:1.5em;display:block;color:#166534}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.blog-market-offers{grid-template-columns:1fr}}@media(max-width:570px){.grid{grid-template-columns:1fr}}</style>';
 const body='<header><div class="w hero"><nav class="links" aria-label="أقسام الموقع"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/blog">كل المقالات</a><a href="/blog/saudi">السعودية</a><a href="/blog/uae">الإمارات</a><a href="/blog/archive/all">الأرشيف المباشر</a></nav><h1>'+esc(title)+'</h1><p>اعثر على دليل الشراء المناسب لبلدك ومنتجك، واقرأ النصائح قبل نسخ الكوبون وتجربته. جميع روابط المقالات القديمة محفوظة.</p></div></header><main class="w">'+(!after?blogMarketOffers(market):'')+'<div class="count">'+countLine+'</div>'+quick+'<h2>تصفح جميع المقالات '+(after?'— تكملة القائمة':'')+'</h2><p class="note">حتى 15 مقالًا في الصفحة. للوصول للمقالات السابقة استخدم زر المقالات التالية. قسم أحدث المقالات مرتب حسب تاريخ النشر، أما القائمة الكاملة فمرتبة بالأسماء.</p><section class="grid">'+(items||'<p>لا توجد مقالات قابلة للعرض في هذه الدفعة.</p>')+'</section><nav class="pager" aria-label="التنقل بين صفحات المدونة"><a href="'+path+'">أول القائمة</a>'+next+'</nav><p class="note">المعروض الآن: '+fmt(page.rows.length)+' · نتائج التصفح: '+fmt(page.scanned)+' · تابع الصفحات التالية لاستكشاف بقية الأدلة.</p></main>';
 return new Response('<!doctype html><html lang="ar" dir="rtl"><head>'+head+style+newestStyle+schema+completeBlogAnalytics+'</head><body>'+body+rescueCopyScript+'</body></html>',{headers:{'content-type':'text/html; charset=utf-8','cache-control':after?'public,max-age=0,s-maxage=120':'public,max-age=0,s-maxage=30','x-robots-tag':after?'noindex,follow':'index,follow','x-full-blog-r2':'read-only-cursor-v1'}});
}
