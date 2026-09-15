const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=s=>encodeURI(String(s||''));
const PAGE_SIZE=50,SHARD_SIZE=100;
async function read(env,key,fallback){try{const o=await env.CONTENT_FINAL?.get(key);return o?await o.json():fallback}catch{return fallback}}
function shell(title,body){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | كوبونات نون</title><meta name="robots" content="noindex,follow"><meta name="description" content="أرشيف تصفح لأدلة نون المنشورة. صفحات الأرشيف غير مفهرسة وتستخدم للوصول للمحتوى الأقدم."><style>body{margin:0;background:#f8fafc;color:#111827;font-family:Tahoma,Arial,sans-serif}.w{width:min(1100px,92%);margin:auto}.hero{padding:36px 0;background:#111827;color:#fff}.hero a{color:#fff}.hero p{color:#d1d5db;line-height:1.8}.days,.cards{display:grid;gap:12px;padding:24px 0}.days{grid-template-columns:repeat(3,1fr)}.day,.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px}.day a,.card a{text-decoration:none;color:#111827}.day strong{display:block;font-size:18px}.day span,.card p,.muted{color:#667085}.card h2{font-size:19px;line-height:1.6}.card p{line-height:1.8}.pager{display:flex;justify-content:center;align-items:center;gap:12px;padding:8px 0 40px}.pager a{padding:9px 14px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#111827;text-decoration:none;font-weight:800}.back{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.back a{background:#fff;color:#111827!important;padding:8px 12px;border-radius:999px;text-decoration:none;font-weight:800}@media(max-width:800px){.days{grid-template-columns:1fr 1fr}}@media(max-width:540px){.days{grid-template-columns:1fr}}</style></head><body>${body}</body></html>`}
function headers(maxAge=120){return {'content-type':'text/html; charset=utf-8','cache-control':`public,max-age=${maxAge},s-maxage=${maxAge}`,'x-robots-tag':'noindex, follow','x-content-archive':'v1'}}
function validDay(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')}
function card(a){return `<article class="card"><small>${a.country==='AE'?'الإمارات':'السعودية'} · ${esc(a.intentLabel||a.intent||'دليل')}</small><h2><a href="/articles/${enc(a.slug)}">${esc(a.title||a.primaryKeyword||a.slug)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><a href="/articles/${enc(a.slug)}"><strong>اقرأ الدليل ←</strong></a></article>`}
export async function archiveLanding(path,url,env){
  if(path==='/blog/archive'){
    const manifest=await read(env,'bulk/days.json',{days:[]}),days=(manifest.days||[]).filter(x=>validDay(x.day)&&Number(x.count)>0).slice(0,365);
    const rows=days.map(x=>`<article class="day"><a href="/blog/archive/${esc(x.day)}"><strong>${esc(x.day)}</strong><span>${Number(x.count).toLocaleString('ar-EG')} مقال · ${Number(x.shards)||Math.ceil(Number(x.count)/SHARD_SIZE)} أجزاء</span></a></article>`).join('');
    const body=`<header class="hero"><div class="w"><a href="/blog">← المدونة</a><h1>أرشيف أدلة نون</h1><p>تصفّح المحتوى الأقدم حسب يوم النشر. الأرشيف مخصص للمستخدم والربط الداخلي ولا ينافس المقالات في نتائج البحث.</p><div class="back"><a href="/topics/saudi">نون السعودية</a><a href="/topics/uae">نون الإمارات</a><a href="/topics/buying-guides">أدلة الشراء</a></div></div></header><main class="w"><section class="days">${rows||'<p>لا توجد أيام محفوظة في الأرشيف حتى الآن.</p>'}</section></main>`;
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
export const ARCHIVE_INFO={version:1,pageSize:PAGE_SIZE,shardSize:SHARD_SIZE,indexable:false,maxShardReadsPerPage:2};
