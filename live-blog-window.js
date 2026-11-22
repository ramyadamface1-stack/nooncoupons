// Read-only live discovery page. One bounded R2 journal GET; no ledger scan,
// provider calls, writes, jobs, timers or Cloudflare static-asset rebuild.
// /blog and historic deep pagination stay static even under Worker Free 1027.
const JOURNAL='blog/latest-live-v1.json';
export const LIVE_BLOG_ROUTES=Object.freeze({
 '/blog/latest':null,
 '/blog/latest/saudi':'SA',
 '/blog/latest/uae':'AE'
});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const iso=x=>{const ms=Date.parse(String(x||''));return Number.isFinite(ms)?new Date(ms).toISOString():null};
const safeSlug=x=>typeof x==='string'&&/^[a-z0-9-]{16,120}$/.test(x)&&!x.includes('--');
const codeFor=country=>country==='AE'?'NOV188':'NOV170';
const displayDate=(at,english)=>new Intl.DateTimeFormat(english?'en-GB':'ar-EG',{
  day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'
 }).format(new Date(at));
const paths=Object.keys(LIVE_BLOG_ROUTES);
export function liveBlogWindowRows(journal,{market=null,now=Date.now(),limit=15}={}){
 if(!journal||journal.version!==1||!Array.isArray(journal.articles)||journal.articles.length>450)
  throw Error('LIVE_BLOG_JOURNAL_INVALID');
 if(market!==null&&!['SA','AE'].includes(market)||!Number.isFinite(now)||
    !Number.isInteger(limit)||limit<1||limit>30)throw Error('LIVE_BLOG_OPTIONS_INVALID');
 const seen=new Set(),rows=[];
 for(const a of journal.articles){
  if(a?.status!=='published'||a?.indexable===false||!['SA','AE'].includes(a?.country)||
     !safeSlug(a.slug)||seen.has(a.slug)||Number(a.quality)<95||Number(a.wordCount)<1500)continue;
  const publishedAt=iso(a.publishedAt||a.createdAt),when=Date.parse(publishedAt||'');
  if(!publishedAt||when>now+300000||when<Date.UTC(2020,0,1))continue;
  const title=String(a.title||'').trim(),description=String(a.metaDescription||'').trim();
  if(title.length<10||title.length>220||description.length<20)continue;
  seen.add(a.slug);
  if(market&&a.country!==market)continue;
  const code=codeFor(a.country);
  rows.push({slug:a.slug,country:a.country,title:title.slice(0,180),
   description:description.slice(0,180),publishedAt,code,
   href:'/articles/'+a.slug,
   image:'/assets/coupon-svg/'+a.slug+'/1.svg?v=12&country='+a.country+'&coupon='+code});
 }
 rows.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.slug.localeCompare(b.slug));
 return {latest:rows.slice(0,limit),observedLastHour:rows.filter(a=>now-Date.parse(a.publishedAt)<3600000).length,
  journalEligible:rows.length};
}
const unavailable=()=>new Response('Live publication journal temporarily unavailable',{
 status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store',
 'retry-after':'60','x-robots-tag':'noindex,nofollow','x-live-blog':'unavailable'}});
export async function liveBlogResponse(req,env,{now=Date.now()}={}){
 const u=new URL(req.url),path=u.pathname.replace(/\/+$/,'')||'/';
 if(!Object.prototype.hasOwnProperty.call(LIVE_BLOG_ROUTES,path)||req.method!=='GET')return null;
 if(!env?.CONTENT_FINAL?.get)return unavailable();
 let raw,result;
 try{
  const object=await env.CONTENT_FINAL.get(JOURNAL);
  if(!object)return unavailable();
  raw=await object.json();
  result=liveBlogWindowRows(raw,{market:LIVE_BLOG_ROUTES[path],now});
 }catch{return unavailable()}
 if(!result.latest.length)return unavailable();
 const market=LIVE_BLOG_ROUTES[path],english=market==='AE';
 const title=english?'Latest Noon UAE buying guides':market==='SA'?'أحدث مقالات نون السعودية':'أحدث مقالات كوبونات نون السعودية والإمارات';
 const description=english?'Recently published Noon UAE buyer guides with NOV188, model comparisons and real checkout advice.':
  'أحدث مقالات الشراء وكوبونات نون المنشورة، مع اختيار الدولة المناسبة والتحقق من المبلغ النهائي في متجر نون.';
 const origin='https://noondealsnow.com',canonical=origin+path;
 if(u.searchParams.get('format')==='json')
  return new Response(JSON.stringify({ok:true,source:'approved-public-r2-journal',market:market||'ALL',
   updatedAt:iso(raw.updatedAt),observedLastHour:result.observedLastHour,
   observedWindowLimit:300,articles:result.latest}),{headers:{
   'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=0,s-maxage=45',
   'x-robots-tag':'noindex','x-live-blog':'approved-r2-journal-v1'}});
 const nav=paths.map(p=>'<a'+(p===path?' aria-current="page" class="current"':'')+
    ' href="'+p+'">'+(p==='/blog/latest'?(english?'All newest':'الكل'):
    p.endsWith('saudi')?(english?'Saudi Arabia':'السعودية'):(english?'UAE':'الإمارات'))+'</a>').join('');
 const items=result.latest.map((a,i)=>{
  const local=a.country==='AE',label=english?(local?'Noon UAE':'Noon Saudi Arabia'):(local?'نون الإمارات':'نون السعودية');
  const at=displayDate(a.publishedAt,english),alt=a.title+' — '+label+' '+a.code;
  return '<article class="card" lang="'+(local?'en-AE':'ar-SA')+'" dir="'+(local?'ltr':'rtl')+'">'+
   '<a href="'+a.href+'" class="cover"><img src="'+esc(a.image).replace(/&/g,'&amp;')+
   '" width="1600" height="1000" alt="'+esc(alt)+'" loading="'+(i===0?'eager':'lazy')+'" decoding="async"></a>'+
   '<div class="copy"><small>'+esc(label)+' · <time datetime="'+a.publishedAt+'">'+esc(at)+'</time></small>'+
   '<h2><a href="'+a.href+'">'+esc(a.title)+'</a></h2>'+
   '<p>'+esc(a.description)+'</p><a class="read" href="'+a.href+'">'+(english?'Read the guide':'اقرأ المقال')+'</a></div></article>';
 }).join('');
 const jsonld={'@context':'https://schema.org','@type':'CollectionPage',url:canonical,name:title,
  inLanguage:english?'en-AE':'ar-SA',mainEntity:{'@type':'ItemList',itemListElement:result.latest.map((a,i)=>({
    '@type':'ListItem',position:i+1,url:origin+a.href,name:a.title}))}};
 const style='<style>*{box-sizing:border-box}body{margin:0;color:#101828;background:#f6f7fb;font-family:Tahoma,Arial,sans-serif;line-height:1.65}a{color:#1d4ed8}.w{width:min(1180px,94%);margin:auto}header{background:#fff;border-bottom:1px solid #e2e6ea}.top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:16px 0}.top a{text-decoration:none;font-weight:800;color:#182231}.logo{margin-inline-end:auto;font-size:21px}.intro{background:linear-gradient(120deg,#fff,#fffcef);padding:34px 0;border-bottom:1px solid #e5e7eb}.eyebrow{font-size:12px;color:#8a6500;font-weight:900}.intro h1{font-size:clamp(28px,4vw,43px);margin:8px 0}.intro p{max-width:720px;color:#475467}.market{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.market a{border:1px solid #d5dae2;background:#fff;border-radius:11px;padding:9px 13px;font-weight:800;text-decoration:none;color:#1e293b}.market a.current{background:#feee00;border-color:#d8c500}.meta{color:#475467;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;padding:27px 0 50px}.card{background:white;border:1px solid #e3e6ed;border-radius:17px;overflow:hidden;min-width:0}.cover{display:block;aspect-ratio:8/5;background:#fffbdd}.cover img{width:100%;height:100%;object-fit:cover}.copy{padding:16px}.copy small{color:#5f6c7e}.copy h2{font-size:18px;line-height:1.55}.copy h2 a{color:#101828;text-decoration:none}.copy p{font-size:13px;color:#4b5563}.read{display:inline-block;background:#feee00;color:#101828;text-decoration:none;padding:9px 14px;border-radius:9px;font-weight:900}.disclaimer{font-size:12px;color:#667085;padding-bottom:20px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}.intro{padding:22px 0}.logo{width:100%}}</style>';
 const html='<!doctype html><html lang="'+(english?'en-AE':'ar-SA')+'" dir="'+(english?'ltr':'rtl')+'"><head>'+
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'">'+
  '<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="'+canonical+'">'+
  '<script type="application/ld+json">'+JSON.stringify(jsonld).replace(/</g,'\\u003c')+'</script>'+style+
  '</head><body><header><div class="w top"><a class="logo" href="/">NOON DEALS NOW</a><a href="/blog">'+
  (english?'Full blog archive':'المدونة الكاملة')+'</a><a href="/golden-keywords">'+(english?'Shopping guides':'أدلة الشراء')+
  '</a></div></header><section class="intro"><div class="w"><div class="eyebrow">'+
  (english?'LIVE PUBLICATION JOURNAL':'سجل المقالات المنشورة مباشرة')+'</div><h1>'+esc(title)+'</h1>'+
  '<p>'+esc(description)+'</p><nav class="market" aria-label="'+(english?'Choose market':'اختر الدولة')+'">'+nav+'</nav>'+
  '<p class="meta">'+(english?'Observed in the last hour: ':'المرصود خلال آخر ساعة في سجل النشر: ')+
  '<strong>'+result.observedLastHour+'</strong> · '+
  (english?'Latest 15 quality-approved publications':'أحدث 15 مقالة اجتازت فحوص الجودة')+
  '</p></div></section><main class="w"><section class="grid">'+items+'</section>'+
  '<p class="disclaimer">'+(english?'The official Noon checkout determines eligibility. The full historical blog remains available.':
  'الأهلية وقيمة الخصم يحددهما متجر نون عند الدفع. الأرشيف الكامل محفوظ ويمكن تصفحه من المدونة.')+
  '</p></main></body></html>';
 return new Response(html,{headers:{'content-type':'text/html; charset=utf-8',
  'cache-control':'public,max-age=0,s-maxage=45','x-robots-tag':'index,follow',
  'x-live-blog':'approved-r2-journal-v1'}});
}
