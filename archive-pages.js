const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=s=>encodeURI(String(s||''));
const dec=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
const PAGE_SIZE=15,SHARD_SIZE=100;
const DISCOVERY_CURRENT='maintenance/article-discovery-v1/current.json',ENGLISH_STATE='english-canary/state.json';
async function read(env,key,fallback){try{const o=await env.CONTENT_FINAL?.get(key);return o?await o.json():fallback}catch{return fallback}}
function shell(title,body){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | كوبونات نون</title><meta name="robots" content="noindex,follow"><meta name="description" content="أرشيف تصفح لأدلة نون المنشورة. صفحات الأرشيف غير مفهرسة وتستخدم للوصول للمحتوى الأقدم."><style>body{margin:0;background:#f8fafc;color:#111827;font-family:Tahoma,Arial,sans-serif}.w{width:min(1100px,92%);margin:auto}.hero{padding:36px 0;background:#111827;color:#fff}.hero a{color:#fff}.hero p{color:#d1d5db;line-height:1.8}.days,.cards{display:grid;gap:12px;padding:24px 0}.days{grid-template-columns:repeat(3,1fr)}.day,.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px}.day a,.card a{text-decoration:none;color:#111827}.day strong{display:block;font-size:18px}.day span,.card p,.muted{color:#667085}.card h2{font-size:19px;line-height:1.6}.card p{line-height:1.8}.pager{display:flex;justify-content:center;align-items:center;gap:12px;padding:8px 0 40px}.pager a{padding:9px 14px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#111827;text-decoration:none;font-weight:800}.back{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.back a{background:#fff;color:#111827!important;padding:8px 12px;border-radius:999px;text-decoration:none;font-weight:800}@media(max-width:800px){.days{grid-template-columns:1fr 1fr}}@media(max-width:540px){.days{grid-template-columns:1fr}}</style></head><body>${body}</body></html>`}
function headers(maxAge=120){return {'content-type':'text/html; charset=utf-8','cache-control':`public,max-age=${maxAge},s-maxage=${maxAge}`,'x-robots-tag':'noindex, follow','x-content-archive':'v1'}}
function validDay(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')}
function card(a){return `<article class="card"><small>${a.country==='AE'?'الإمارات':'السعودية'} · ${esc(a.intentLabel||a.intent||'دليل')}</small><h2><a href="/articles/${enc(a.slug)}">${esc(a.title||a.primaryKeyword||a.slug)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><a href="/articles/${enc(a.slug)}"><strong>اقرأ الدليل ←</strong></a></article>`}
export async function archiveLanding(path,url,env){
  if(path==='/blog/archive/all'){
    if(!env.CONTENT_FINAL)return new Response('Archive unavailable',{status:503,headers:{...headers(30),'x-robots-tag':'noindex,nofollow'}});
    const cursor=String(url.searchParams.get('cursor')||'').trim()||undefined;
    let listing;
    try{listing=await env.CONTENT_FINAL.list({prefix:'articles/',limit:15,...(cursor?{cursor}:{}),include:['customMetadata']})}
    catch(e){return new Response('Archive listing temporarily unavailable',{status:503,headers:{...headers(30),'x-robots-tag':'noindex,nofollow'}})}
    const objects=(listing.objects||[]).filter(o=>String(o?.key||'').startsWith('articles/')&&String(o.key).endsWith('.html'));
    const cards=objects.map(o=>{
      const md=o.customMetadata||{},slug=String(o.key).slice('articles/'.length,-'.html'.length),isEnglish=String(md.lang||'').toLowerCase()==='en'||slug.startsWith('en-'),country=(md.c||md.country)==='AE'?'AE':'SA',rawTitle=md.t||md.title||slug,title=dec(rawTitle).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim(),href=(isEnglish?'/en/articles/':'/articles/')+enc(slug),uploaded=o.uploaded?new Date(o.uploaded).toISOString().slice(0,10):'';
      if(md.status&&md.status!=='published')return '';
      return `<article class="card" dir="${isEnglish?'ltr':'rtl'}"><small>${isEnglish?'English UAE':country==='AE'?'الإمارات':'السعودية'}${uploaded?' · '+esc(uploaded):''}</small><h2><a href="${href}">${esc(title)}</a></h2><p class="muted">R2 article object · ${esc(slug)}</p><a href="${href}"><strong>${isEnglish?'Open article →':'افتح المقال ←'}</strong></a></article>`;
    }).filter(Boolean).join('');
    const next=listing.truncated&&listing.cursor?'/blog/archive/all?cursor='+encodeURIComponent(listing.cursor):'',count=await read(env,'_ops/article-count.json',null),known=Number(count?.count||0);
    const pager=`<nav class="pager"><span>15 مقالًا لكل دفعة${known?' · آخر عدّ R2: '+known.toLocaleString('ar-EG'):''}</span>${next?`<a href="${next}">التالي ←</a>`:''}</nav>`;
    const body=`<header class="hero"><div class="w"><a href="/blog/archive">← الأرشيف</a><h1>كل ملفات المقالات المحفوظة</h1><p>تصفح مباشر لمحتوى articles/ في R2، 15 عنصرًا في الصفحة. هذا المسار لا يعتمد على عداد التوليد أو manifest، لذلك يغطي المقالات القديمة والجديدة المحفوظة فعليًا.</p><div class="back"><a href="/blog">أحدث المقالات</a><a href="/blog/archive/english">English UAE</a></div></div></header><main class="w"><section class="cards">${cards||'<p>لا توجد عناصر قابلة للعرض في هذه الدفعة.</p>'}</section>${pager}</main>`;
    return new Response(shell('كل المقالات المحفوظة',body),{headers:{...headers(120),'x-r2-direct-archive':'v1'}});
  }
  if(path==='/blog/archive/full'){
    const discovery=await read(env,DISCOVERY_CURRENT,null);
    if(!discovery?.complete||!discovery?.runId||Number(discovery?.shards||0)<1)return new Response('Archive index unavailable',{status:503,headers:{...headers(30),'x-robots-tag':'noindex,nofollow'}});
    const maxShard=Math.max(0,Number(discovery.shards)-1),shard=Math.max(0,Math.min(maxShard,Number(url.searchParams.get('shard')||0)||0));
    const data=await read(env,`maintenance/article-discovery-v1/${discovery.runId}/${shard}.json`,{articles:[]}),rows=(data.articles||[]).filter(a=>a?.slug),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE)),page=Math.max(1,Math.min(pages,Number(url.searchParams.get('page')||1)||1)),slice=rows.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    const href=(s,p)=>`/blog/archive/full?shard=${s}${p>1?'&page='+p:''}`,prev=page>1?href(shard,page-1):(shard>0?href(shard-1,1):''),next=page<pages?href(shard,page+1):(shard<maxShard?href(shard+1,1):'');
    const cards=slice.map(a=>`<article class="card"><small>${a.country==='AE'?'الإمارات':'السعودية'} · فهرس الجودة</small><h2><a href="/articles/${enc(a.slug)}">${esc(a.title||a.primaryKeyword||String(a.slug).replace(/[-_]+/g,' '))}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><a href="/articles/${enc(a.slug)}"><strong>افتح المقال ←</strong></a></article>`).join('');
    const pager=`<nav class="pager">${prev?`<a href="${prev}">السابق</a>`:''}<span>جزء ${shard+1} من ${maxShard+1} · صفحة ${page} من ${pages}</span>${next?`<a href="${next}">التالي</a>`:''}</nav>`;
    const body=`<header class="hero"><div class="w"><a href="/blog/archive">← الأرشيف</a><h1>الفهرس العربي الكامل</h1><p>${Number(discovery.articles||0).toLocaleString('ar-EG')} مقال مؤهل في طبقة الاكتشاف. 15 مقالًا في الصفحة، وروابط مباشرة للمحتوى بدون حذف.</p></div></header><main class="w"><section class="cards">${cards}</section>${pager}</main>`;
    return new Response(shell('الفهرس العربي الكامل',body),{headers:headers(300)});
  }
  if(path==='/blog/archive/english'){
    const state=await read(env,ENGLISH_STATE,{records:[]}),rows=[...(state.records||[])].filter(a=>a?.slug&&a.status==='published').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE)),page=Math.max(1,Math.min(pages,Number(url.searchParams.get('page')||1)||1)),slice=rows.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),href=p=>`/blog/archive/english${p>1?'?page='+p:''}`;
    const cards=slice.map(a=>`<article class="card" dir="ltr"><small>UAE · English</small><h2><a href="/en/articles/${enc(a.slug)}">${esc(a.title||a.primaryKeyword||a.slug)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><a href="/en/articles/${enc(a.slug)}"><strong>Open guide →</strong></a></article>`).join('');
    const pager=`<nav class="pager">${page>1?`<a href="${href(page-1)}">Newer</a>`:''}<span>Page ${page} / ${pages} · ${rows.length.toLocaleString('en-US')} guides</span>${page<pages?`<a href="${href(page+1)}">Older</a>`:''}</nav>`;
    const body=`<header class="hero"><div class="w"><a href="/blog/archive">← الأرشيف</a><h1>English UAE guides</h1><p>${rows.length.toLocaleString('en-US')} published English guides, 15 per page, each linked to its live article.</p></div></header><main class="w"><section class="cards">${cards}</section>${pager}</main>`;
    return new Response(shell('English UAE archive',body),{headers:headers(120)});
  }
  if(path==='/blog/archive'){
    const manifest=await read(env,'bulk/days.json',{days:[]}),days=(manifest.days||[]).filter(x=>validDay(x.day)&&Number(x.count)>0).slice(0,365);
    const rows=days.map(x=>`<article class="day"><a href="/blog/archive/${esc(x.day)}"><strong>${esc(x.day)}</strong><span>${Number(x.count).toLocaleString('ar-EG')} مقال · ${Number(x.shards)||Math.ceil(Number(x.count)/SHARD_SIZE)} أجزاء</span></a></article>`).join('');
    const body=`<header class="hero"><div class="w"><a href="/blog">← المدونة</a><h1>أرشيف أدلة نون</h1><p>تصفّح المحتوى الأقدم حسب يوم النشر. الأرشيف مخصص للمستخدم والربط الداخلي ولا ينافس المقالات في نتائج البحث.</p><div class="back"><a href="/blog/archive/all">كل المقالات المحفوظة</a><a href="/blog/archive/full">فهرس الجودة العربي</a><a href="/blog/archive/english">English UAE</a><a href="/topics/saudi">نون السعودية</a><a href="/topics/uae">نون الإمارات</a><a href="/topics/buying-guides">أدلة الشراء</a></div></div></header><main class="w"><section class="days">${rows||'<p>لا توجد أيام محفوظة في الأرشيف حتى الآن.</p>'}</section></main>`;
    return new Response(shell('أرشيف أدلة نون',body),{headers:headers(300)});
  }
  if(!path.startsWith('/blog/archive/'))return null;
  const day=path.slice('/blog/archive/'.length);
  if(!validDay(day))return new Response('Not Found',{status:404});
  const manifest=await read(env,'bulk/days.json',{days:[]}),row=(manifest.days||[]).find(x=>x.day===day);
  if(!row||!Number(row.count))return new Response('Not Found',{status:404});
  const total=Math.max(0,Number(row.count)||0),pages=Math.max(1,Math.ceil(total/PAGE_SIZE)),requested=Math.max(1,Number(url.searchParams.get('page')||1)||1),page=Math.min(requested,pages),newestOffset=(page-1)*PAGE_SIZE,high=total-1-newestOffset,low=Math.max(0,high-PAGE_SIZE+1),firstShard=Math.floor(low/SHARD_SIZE),lastShard=Math.floor(high/SHARD_SIZE),items=[];
  for(let shard=firstShard;shard<=lastShard;shard++){
    const data=await read(env,`bulk/day/${day}/${shard}.json`,{articles:[]});
    (data.articles||[]).forEach((a,pos)=>{const index=shard*SHARD_SIZE+pos;if(index>=low&&index<=high&&a?.slug&&a.indexable!==false)items.push({...a,_index:index})});
  }
  items.sort((a,b)=>b._index-a._index);
  const link=p=>`/blog/archive/${day}${p>1?'?page='+p:''}`;
  const pager=`<nav class="pager" aria-label="صفحات الأرشيف">${page>1?`<a href="${link(page-1)}">الأحدث</a>`:''}<span>صفحة ${page} من ${pages}</span>${page<pages?`<a href="${link(page+1)}">الأقدم</a>`:''}</nav>`;
  const body=`<header class="hero"><div class="w"><a href="/blog/archive">← كل الأيام</a><h1>مقالات ${esc(day)}</h1><p>${total.toLocaleString('ar-EG')} مقال منشور في هذا اليوم. نعرض 50 مقالًا في الصفحة مع قراءات R2 محدودة.</p><div class="back"><a href="/blog">أحدث المقالات</a><a href="/topics/saudi">السعودية</a><a href="/topics/uae">الإمارات</a></div></div></header><main class="w"><section class="cards">${items.map(card).join('')||'<p>لم نتمكن من تحميل عناصر هذه الصفحة.</p>'}</section>${pager}</main>`;
  return new Response(shell(`مقالات ${day}`,body),{headers:headers(day===new Date().toISOString().slice(0,10)?30:600)});
}
export function archiveNavLink(){return '<a href="/blog/archive">أرشيف المقالات</a>'}
export const ARCHIVE_INFO={version:3,directR2Archive:true,fullDiscoveryArchive:true,englishArchive:true,pageSize:PAGE_SIZE,shardSize:SHARD_SIZE,indexable:false,maxShardReadsPerPage:2};
