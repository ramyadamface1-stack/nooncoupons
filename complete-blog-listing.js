// Read-only, bounded all-article browser for /blog, /blog/saudi and /blog/uae.
// Uses the existing R2 bucket. No deletion, migration, new resources or full-corpus scan.
// R2 uses lexicographic key order; the newest-publication feed remains a separate
// small, clearly labelled shortcut. A startAfter key prevents skipped records
// when filtering or stopping midway through a listed R2 page.
const SIZE=15,MAX_LIST_CALLS=6,MARKET_BATCH=80;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('ar-EG');
const safeResumeKey=k=>typeof k==='string'&&k.startsWith('articles/')&&k.length<=600&&
  !k.includes('..')&&!/[\x00-\x1f\x7f]/.test(k);
const safeSlugKey=k=>safeResumeKey(k)&&/^articles\/[^/]{1,300}\.html$/u.test(k);
const safeDate=x=>{try{const ms=Date.parse(String(x||''));return Number.isFinite(ms)?new Date(ms).toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo'}):null}catch{return null}};
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
 const title=String(rawTitle).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().slice(0,230);
 const href=(english?'/en/articles/':'/articles/')+encodeURIComponent(slug);
 return {key,slug,title: title||slug,country,english,href,uploaded:o.uploaded||null};
}
/** Does not overscan past an emitted key. On partial-filter pages, consumes each
 * visited key exactly once and resumes after the last scanned key. R2 LIST may
 * return metadata on native bindings but the remote S3 adapter does not. */
export async function listFullBlogPublished(env,{market=null,after='',pageSize=SIZE,maxCalls=MAX_LIST_CALLS}={}){
 if(!env?.CONTENT_FINAL?.list)throw Error('FULL_BLOG_R2_LIST_UNAVAILABLE');
 if(market!==null&&!['SA','AE'].includes(market))throw Error('FULL_BLOG_INVALID_MARKET');
 if(after&&!safeResumeKey(after))throw Error('FULL_BLOG_INVALID_CURSOR');
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>15||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>6)
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
const meta={description:'تصفح جميع أدلة ومقالات نون السعودية والإمارات المحفوظة في R2، 15 مقالًا في الصفحة، مع روابط المقالات الأصلية.'};
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
 const path=pth(market),title='مدونة كوبونات نون — جميع مقالات '+label(market);
 const origin='https://noondealsnow.com',canonical=origin+path;
 const items=page.rows.map(a=>'<article class="article-card" dir="'+(a.english?'ltr':'rtl')+'"><div class="card-meta">'+(a.country==='AE'?'الإمارات':'السعودية')+(a.uploaded?' · محفوظ '+esc(safeDate(a.uploaded)||''):'')+'</div><h2><a href="'+esc(a.href)+'">'+esc(a.title)+'</a></h2><a class="read" href="'+esc(a.href)+'">'+(a.english?'Open article':'اقرأ المقال')+' ←</a></article>').join('');
 const count=Number(snapshot?.count),isCount=Number.isSafeInteger(count)&&count>0;
 const date=safeDate(snapshot?.countedAt);
 const countLine=isCount?'آخر جرد لملفات المقالات في R2: <strong>'+fmt(count)+'</strong>'+(date?' (بتاريخ '+esc(date)+')':'')+' — ليس عدًا مباشرًا لحظيًا':'جميع المقالات المحفوظة قابلة للتصفح حتى آخر صفحة';
 const latest=Array.isArray(recent?.articles)?recent.articles.filter(a=>a?.status==='published'&&a?.slug&&a?.indexable!==false).slice(0,3):[];
 const quick=latest.length?'<aside class="latest"><h2>أحدث المقالات المنشورة</h2><div>'+latest.map(a=>{
   const slug=String(a.slug),english=slug.startsWith('en-')||String(a.language||'').startsWith('en');
   const text=String(a.title||slug),href=(english?'/en/articles/':'/articles/')+encodeURIComponent(slug);
   return '<a href="'+esc(href)+'">'+esc(text)+'</a>';
 }).join('')+'</div></aside>':'';
 const next=page.nextAfter?'<a rel="next" href="'+esc(newLink(path,page.nextAfter))+'">المقالات التالية ←</a>':'';
 const head='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(meta.description)+'"><link rel="canonical" href="'+canonical+'"><meta name="robots" content="'+(after?'noindex,follow':'index,follow')+'">';
 const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:title,url:canonical,mainEntity:{'@type':'ItemList',itemListElement:page.rows.map((a,i)=>({'@type':'ListItem',position:i+1,url:origin+a.href}))}}).replace(/</g,'\\u003c')+'</script>';
 const style='<style>*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#111827;font-family:Tahoma,Arial,sans-serif;line-height:1.75}a{color:#2638a4;text-decoration:underline;text-underline-offset:3px}header{background:#111827;color:#fff;padding:28px 0}header a{color:#fff}.w{width:min(1080px,92%);margin:auto}.links{display:flex;flex-wrap:wrap;gap:12px}.links a{padding:5px 9px}.hero p{color:#e5e7eb}.count{padding:12px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin:20px 0}.latest{padding:16px;background:#fff;border:1px solid #e5e7eb;border-radius:14px}.latest h2{font-size:18px;margin:0 0 10px}.latest div{display:flex;gap:14px;flex-wrap:wrap}.latest a{display:inline-block;max-width:310px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0}.article-card{padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;min-width:0}.article-card h2{font-size:19px;line-height:1.6;overflow-wrap:anywhere}.card-meta{color:#475569;font-size:13px}.read{font-weight:bold}.pager{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center;margin:26px auto 50px}.pager a{border:1px solid #cbd5e1;background:#fff;padding:9px 13px;border-radius:10px}.note{color:#475569;font-size:14px}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:570px){.grid{grid-template-columns:1fr}}</style>';
 const body='<header><div class="w hero"><nav class="links" aria-label="أقسام الموقع"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/blog">كل المقالات</a><a href="/blog/saudi">السعودية</a><a href="/blog/uae">الإمارات</a><a href="/blog/archive/all">الأرشيف المباشر</a></nav><h1>'+esc(title)+'</h1><p>كل ملفات المقالات المنشورة في الأرشيف؛ لا نعتمد على فهرس أحدث المقالات المحدود، ولا نحذف أو نغيّر روابط المقالات القديمة.</p></div></header><main class="w"><div class="count">'+countLine+'</div>'+quick+'<h2>تصفح جميع المقالات '+(after?'— تكملة القائمة':'')+'</h2><p class="note">15 مقالًا في الدفعة، تصفح متسلسل للملفات المخزنة. ترتيب فهرس R2 أبجدي وليس حسب تاريخ النشر؛ روابط أحدث المقالات أعلاه.</p><section class="grid">'+(items||'<p>لا توجد مقالات قابلة للعرض في هذه الدفعة.</p>')+'</section><nav class="pager" aria-label="التنقل بين صفحات المدونة"><a href="'+path+'">أول القائمة</a>'+next+'</nav><p class="note">المعروض الآن: '+fmt(page.rows.length)+' · نتيجة القراءة: '+fmt(page.scanned)+' مفتاحًا · لا توجد حدود قصوى لعدد صفحات المدونة.</p></main>';
 return new Response('<!doctype html><html lang="ar" dir="rtl"><head>'+head+style+schema+'</head><body>'+body+'</body></html>',{headers:{'content-type':'text/html; charset=utf-8','cache-control':after?'public,max-age=0,s-maxage=120':'public,max-age=0,s-maxage=30','x-robots-tag':after?'noindex,follow':'index,follow','x-full-blog-r2':'read-only-cursor-v1'}});
}
