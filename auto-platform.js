import app from './final-platform.js';
export {ControlPlane} from './platform.js';
export {GeneratorControl} from './admin-runtime.js';
import {renderAdmin} from './admin-page.js';
import {secureLogin} from './secure-admin-auth.js';
import {handleAdminApi,getGeneratorConfig,getGeneratorStatus,updateGeneratorStatus,generatorLock,generatorUnlock,isAdmin,bulkTick} from './admin-runtime.js';
import {readState,pickTopic,publishGenerated} from './generator-core-v2.js';
import {generateWithWorkersAI,workersAiBudget,isWorkersAiFreeQuotaError} from './workers-ai-generator.js';
import {BULK_ENGINE_INFO,BULK_RUNTIME_LIMITS} from './bulk-generator.js';
import {normalizeApprovedCoupon,replaceUnapprovedCouponTokens} from './approved-coupons.js';

const VERSION='generator-5.0-quality-first';
const PLATFORM_VERSION='platform-1.6-quality-first';
const STATIC_SITEMAPS=['pages','guides','coupons','coupons-saudi','coupons-uae'];
const now=()=>new Date().toISOString();
const json=(x,s=200)=>new Response(JSON.stringify(x,null,2),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dec=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
const xml=s=>new Response(s,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300,s-maxage=300'}});
async function r2json(env,key,fallback){try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}}

function normalizeArticleHeadingDensity(html,maxH2=12){
  const source=String(html||''),matches=[...source.matchAll(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi)];
  if(matches.length<=maxH2)return {html:source,before:matches.length,after:matches.length,changed:false};
  const keep=new Set(),important=/الأسئلة الشائعة|الخلاصة|القرار النهائي|منهجية|المصدر|مصفوفة|قبل الدفع|استخدام الكود|اختبر|لم يعمل الكود|السعر النهائي/i;
  for(let i=0;i<Math.min(5,matches.length);i++)keep.add(i);
  for(let i=0;i<matches.length&&keep.size<maxH2-2;i++){
    const text=String(matches[i][2]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    if(important.test(text))keep.add(i);
  }
  keep.add(Math.max(0,matches.length-2));keep.add(matches.length-1);
  if(keep.size<maxH2){
    const remaining=Array.from({length:matches.length},(_,i)=>i).filter(i=>!keep.has(i));
    const needed=maxH2-keep.size,step=Math.max(1,remaining.length/Math.max(1,needed));
    for(let k=0;k<needed&&remaining.length;k++)keep.add(remaining[Math.min(remaining.length-1,Math.floor(k*step))]);
  }
  let idx=0;
  const out=source.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi,(whole,attrs,inner)=>{
    const current=idx++;
    return keep.has(current)?whole:`<h3${attrs} class="demoted-h2">${inner}</h3>`;
  });
  return {html:out,before:matches.length,after:keep.size,changed:true};
}

function decorateArticleBody(html){
  const items=[];let n=0;
  const body=String(html||'').replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi,(whole,attrs,inner)=>{
    const text=String(inner).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    if(!text)return whole;
    const existing=String(attrs||'').match(/\bid=(["'])([^"']+)\1/i);
    const id=existing?.[2]||('section-'+(++n));
    items.push({id,text});
    return existing?whole:`<h2${attrs} id="${id}">${inner}</h2>`;
  });
  const toc=items.length>1?`<nav class="article-toc" aria-label="محتويات المقال"><strong>محتويات المقال</strong><ol>${items.map(x=>`<li><a href="#${esc(x.id)}">${esc(x.text)}</a></li>`).join('')}</ol></nav>`:'';
  return {body,toc};
}

function articleCss(){return `<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827}.site-head{background:rgba(255,255,255,.97);color:#111827;border-bottom:1px solid #e7e9ee;position:sticky;top:0;z-index:30;backdrop-filter:blur(12px)}.head-in{width:min(1120px,94%);margin:auto;min-height:70px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}.brand{font-weight:900;font-size:20px;display:flex;align-items:center;gap:9px}.article-logo{width:38px;height:38px;border-radius:11px 11px 11px 4px;background:#111827;color:#ffe34f;display:grid;place-items:center;font-weight:900}.article-markets{display:flex;gap:4px;padding:4px;background:#f4f4f5;border-radius:10px}.article-markets a{margin:0!important;padding:5px 7px;border-radius:7px}.article-markets a:hover{background:#fff}.site-head a{color:#111827;text-decoration:none;margin-inline-end:14px}.crumbs{width:min(940px,94%);margin:20px auto 0;font-size:14px;color:#64748b}.crumbs a{color:#5b21b6}.wrap{width:min(940px,94%);margin:18px auto 48px;background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:clamp(18px,4vw,42px);line-height:2;box-shadow:0 16px 42px rgba(15,23,42,.06)}.hero{margin:-8px 0 26px}.hero img,.article-visual img{display:block;width:100%;height:auto;aspect-ratio:1200/760;object-fit:contain;background:#fffdf0;border-radius:18px;border:1px solid #e5e7eb}.hero figcaption,.article-visual figcaption{font-size:13px;color:#64748b;text-align:center;padding:9px 8px}.article-public-meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 20px}.article-public-meta span{font-size:12px;padding:6px 9px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:999px;color:#475569}.demoted-h2{font-size:19px!important;line-height:1.65;margin-top:28px!important;color:#344054}.wrap h1{font-size:clamp(28px,5vw,42px);line-height:1.45;margin-top:8px}.wrap h2{font-size:clamp(22px,3vw,29px);line-height:1.55;margin-top:42px}.wrap h3{font-size:19px;line-height:1.6}.wrap p,.wrap li{font-size:17px}.direct-answer{background:#fffbea;border-right:5px solid #FEEE00;padding:18px;border-radius:14px}.article-toc{background:#fffbea;border:1px solid #f0dc73;padding:16px 18px;border-radius:14px;margin:20px 0}.article-toc strong{display:block;margin-bottom:8px}.article-toc ol{margin:0;padding-right:20px;columns:2;gap:28px}.article-toc li{break-inside:avoid;margin:5px 0}.article-toc a{text-decoration:none;color:#344054;font-size:14px}@media(max-width:680px){.article-toc ol{columns:1}}.wrap a{color:#5b21b6}.wrap table{width:100%;border-collapse:collapse;display:table;margin:18px 0}.wrap td,.wrap th{border:1px solid #dbe3ec;padding:10px;text-align:right}.wrap th{background:#f8fafc}.article-visual{margin:34px auto;max-width:840px}.coupon-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px;background:#f8fafc;border-radius:14px}.coupon-actions button,.coupon-actions a{border:0;border-radius:11px;padding:12px 15px;font-weight:800;text-decoration:none}.coupon-actions button{background:#111827;color:#fff;cursor:pointer}.coupon-actions a{background:#FEEE00;color:#111}.copy-feedback{min-height:1.3em;color:#087a3e;font-weight:700}.faq details{border:1px solid #e5e7eb;border-radius:13px;padding:10px 14px;margin:10px 0}.faq summary{cursor:pointer}.faq summary h3{display:inline}.methodology,.sources{background:#f8fafc;border:1px solid #e5e7eb;padding:16px;border-radius:14px}.eyebrow{font-size:13px!important;color:#64748b;font-weight:800}.article-byline{margin:16px 0 24px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;color:#475569;line-height:1.8}.article-byline a{color:#344054;font-weight:800}.coupon-summary{margin:18px 0 22px;background:#fffbea;border:1px solid #f0dc73;border-radius:16px;padding:17px}.coupon-summary>strong{display:block;font-size:20px;margin-bottom:10px}.coupon-summary dl{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0}.coupon-summary div{background:#fff;border:1px solid #f2e7a8;border-radius:12px;padding:10px}.coupon-summary dt{font-size:12px;color:#667085}.coupon-summary dd{margin:4px 0 0;font-weight:900}.coupon-summary small{display:block;color:#667085;margin-top:10px;line-height:1.7}@media(max-width:680px){.coupon-summary dl{grid-template-columns:1fr 1fr}}.article-footer{background:#111827;color:#e5e7eb;padding:30px 0}.article-footer .af-in{width:min(940px,94%);margin:auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:22px}.article-footer p{color:#cbd5e1;line-height:1.8}.article-footer a{color:#e5e7eb;text-decoration:none;display:block;margin:7px 0}.article-visual img[loading="lazy"]{content-visibility:auto}@media(max-width:680px){.wrap{width:96%;padding:18px;border-radius:16px}.wrap p,.wrap li{font-size:16px}.wrap table{display:block;overflow-x:auto}.head-in{padding:12px 3%}.head-in nav{display:none}.article-footer .af-in{grid-template-columns:1fr}}
</style>`}
function copyJs(){return `<script>document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-code]');if(!b)return;const code=b.dataset.copyCode||'';const box=b.parentElement?.querySelector('.copy-feedback');try{await navigator.clipboard.writeText(code);if(box)box.textContent='تم نسخ '+code+' بنجاح';const old=b.textContent;b.textContent='✓ تم النسخ';setTimeout(()=>{b.textContent=old;if(box)box.textContent=''},1800)}catch{if(box)box.textContent='الكود: '+code}});</script>`}

async function bulkArticlePage(u,env){
  if(!env.CONTENT_FINAL)return null;
  const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
  if(!slug)return null;
  const o=await env.CONTENT_FINAL.get('articles/'+slug+'.html');
  if(!o)return null;
  const md=o.customMetadata||{};
  if(md.status&&md.status!=='published')return null;
  const country=(md.c||md.country)==='AE'?'AE':'SA',fallbackCoupon=country==='AE'?'NOV188':'NOV170';
  const title=dec(md.t||md.title)||slug,rawMeta=dec(md.m||md.metaDescription||''),coupon=normalizeApprovedCoupon(md.cp||md.coupon,fallbackCoupon),keyword=dec(md.kw||md.primaryKeyword)||title,quality=Number(md.q||md.quality||0),qualityFloor=Number(md.qf||md.qualityFloor||0),checks=Number(md.qc||md.qualityChecks||0),origin=env.SITE_ORIGIN||u.origin;
  const rawText=await o.text(),safeRaw=replaceUnapprovedCouponTokens(rawText,coupon),plainMeta=safeRaw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),meta=rawMeta||plainMeta.slice(0,165)||title,headingDensity=normalizeArticleHeadingDensity(safeRaw,12),decorated=decorateArticleBody(headingDensity.html),body=decorated.body,canonical=origin+'/articles/'+encodeURI(slug),market=country==='SA'?'السعودية':'الإمارات',lang=country==='SA'?'ar-SA':'ar-AE',marketPath=country==='SA'?'/saudi':'/uae',published=md.at||md.createdAt||(o.uploaded?new Date(o.uploaded).toISOString():now()),modified=o.uploaded?new Date(o.uploaded).toISOString():published;
  const imgPath=`/assets/coupon-svg/${encodeURIComponent(slug)}/1.svg?v=8&coupon=${encodeURIComponent(coupon)}&country=${country}`,featured=origin+imgPath;
  const images=[1,2,3,4,5].map(v=>origin+`/assets/coupon-svg/${encodeURIComponent(slug)}/${v}.svg?v=8&coupon=${encodeURIComponent(coupon)}&country=${country}`);
  const graph={'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':origin+'/#organization',name:'كوبونات نون',url:origin},
    {'@type':'Organization','@id':origin+'/authors/editorial-team#team',name:'فريق تحرير كوبونات نون',url:origin+'/authors/editorial-team',parentOrganization:{'@id':origin+'/#organization'}},
    {'@type':'WebSite','@id':origin+'/#website',url:origin,name:'كوبونات نون',inLanguage:'ar'},
    {'@type':'ImageObject','@id':featured+'#image',url:featured,contentUrl:featured,width:1200,height:760,caption:keyword,inLanguage:lang},
    {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'الرئيسية',item:origin+'/'},{'@type':'ListItem',position:2,name:market,item:origin+marketPath},{'@type':'ListItem',position:3,name:title,item:canonical}]},
    {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:title,description:meta,inLanguage:lang,isPartOf:{'@id':origin+'/#website'},breadcrumb:{'@id':canonical+'#breadcrumb'},primaryImageOfPage:{'@id':featured+'#image'}},
    {'@type':'Article','@id':canonical+'#article',headline:title,description:meta,inLanguage:lang,mainEntityOfPage:{'@id':canonical+'#webpage'},datePublished:published,dateModified:modified,author:{'@id':origin+'/authors/editorial-team#team'},publisher:{'@id':origin+'/#organization'},image:images,about:[{'@type':'Thing',name:'Noon'},{'@type':'Thing',name:keyword},{'@type':'Thing',name:'Noon coupon code '+coupon,identifier:coupon},{'@type':'Place',name:market}]}
  ]};
  const schema=JSON.stringify(graph).replace(/</g,'\\u003c');
  const qualityBits=`<div class="article-public-meta"><span>تمت مراجعة الصفحة تحريرياً</span><span>${esc(coupon)}</span><span>نون ${market}</span></div>`;
  const byline=`<aside class="article-byline" aria-label="معلومات التحرير"><strong><a href="/authors/editorial-team">فريق تحرير كوبونات نون</a></strong><span> · نُشر ${esc(new Date(published).toLocaleDateString('ar-EG'))} · آخر تحديث ${esc(new Date(modified).toLocaleDateString('ar-EG'))}</span><br><small>محتوى مستقل وفق <a href="/editorial-policy">السياسة التحريرية</a> و<a href="/coupon-verification">منهجية التحقق من الكوبونات</a>.</small></aside>`;
  const couponSummary=`<aside class="coupon-summary" aria-label="خلاصة الكوبون"><strong>خلاصة الكوبون</strong><dl><div><dt>الكود</dt><dd>${esc(coupon)}</dd></div><div><dt>السوق</dt><dd>نون ${market}</dd></div><div><dt>الخصم</dt><dd>تحقق داخل السلة</dd></div><div><dt>آخر تحديث</dt><dd>${esc(new Date(modified).toLocaleDateString('ar-EG'))}</dd></div></dl><small>ظهور الكود هنا يعني أنه ضمن قائمة الأكواد المعتمدة للموقع للتجربة. لا نثبت نسبة خصم أو تاريخ انتهاء أو أهلية مضمونة بدون دليل موثوق.</small></aside>`;
  const h=`<!doctype html><html lang="${lang}" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(meta)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(meta)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(featured)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="760"><meta property="og:locale" content="${country==='SA'?'ar_SA':'ar_AE'}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(meta)}"><meta name="twitter:image" content="${esc(featured)}"><link rel="preload" as="image" href="${esc(imgPath)}" type="image/svg+xml"><script type="application/ld+json" data-schema="article">${schema}</script>${articleCss()}</head><body><header class="site-head"><div class="head-in"><a class="brand" href="/"><span class="article-logo">ك</span><span>كوبونات نون</span></a><div class="article-markets" aria-label="اختيار السوق"><a href="/saudi" aria-label="السعودية">🇸🇦</a><a href="/uae" aria-label="الإمارات">🇦🇪</a></div><nav aria-label="التنقل الرئيسي"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/blog">المدونة</a><a href="${marketPath}">${market}</a></nav></div></header><nav class="crumbs" aria-label="مسار الصفحة"><a href="/">الرئيسية</a> ← <a href="${marketPath}">${market}</a> ← <span aria-current="page">${esc(title)}</span></nav><main class="wrap"><figure class="hero"><img src="${imgPath}" alt="${esc(keyword)} — كوبون نون ${market} ${esc(coupon)}" title="${esc(title)}" width="1200" height="760" loading="eager" fetchpriority="high" decoding="async"><figcaption>${esc(keyword)} · ${esc(coupon)} · نون ${market}</figcaption></figure>${byline}${couponSummary}${decorated.toc}${qualityBits}${body}</main><footer class="article-footer"><div class="af-in"><div><strong>كوبونات نون</strong><p>موقع مستقل لتنظيم أكواد نون وأدلة التسوق في السعودية والإمارات. نتيجة السلة هي المرجع النهائي للأهلية والخصم.</p></div><div><strong>استكشف</strong><a href="/coupons">الكوبونات</a><a href="/blog">المقالات</a><a href="${marketPath}/categories">الأقسام</a></div><div><strong>الثقة</strong><a href="/coupon-verification">منهجية التحقق</a><a href="/editorial-policy">السياسة التحريرية</a><a href="/authors/editorial-team">فريق التحرير</a><a href="/research">البيانات والمنهجية</a><a href="/glossary">قاموس المصطلحات</a></div></div></footer>${copyJs()}</body></html>`;
  return new Response(h,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=0,s-maxage=600','x-content-type-options':'nosniff','x-article-heading-density':headingDensity.before+'->'+headingDensity.after}});
}

async function bulkBlogPage(req,env,ctx){
  const latest=await r2json(env,'bulk/latest.json',{articles:[]});
  if(!(latest.articles||[]).length)return null;
  let legacy=[];
  try{const r=await app.fetch(new Request(new URL('/api/state',req.url),{headers:{accept:'application/json'}}),env,ctx);if(r.ok){const s=await r.json();legacy=(s.articles||[]).filter(a=>a.status==='published')}}catch{}
  const seen=new Set(),all=[];
  for(const a of [...(latest.articles||[]),...legacy]){if(!a?.slug||seen.has(a.slug))continue;seen.add(a.slug);all.push(a)}
  all.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const u=new URL(req.url),perPage=12,totalPages=Math.max(1,Math.ceil(all.length/perPage)),requested=Math.max(1,Number.parseInt(u.searchParams.get('page')||'1',10)||1),page=Math.min(requested,totalPages),offset=(page-1)*perPage,rows=all.slice(offset,offset+perPage);
  const cards=rows.map((a,idx)=>{const country=a.country==='AE'?'AE':'SA',market=country==='SA'?'السعودية':'الإمارات',img=`/assets/coupon-svg/${encodeURIComponent(a.slug)}/1.svg?v=8&coupon=${encodeURIComponent(a.coupon||(country==='AE'?'NOV188':'NOV170'))}&country=${country}`,date=a.updatedAt||a.createdAt||'',dateText=date?new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Cairo'}).format(new Date(date)):'';return `<article class="card${idx===0&&page===1?' leadCard':''}"><a class="thumb" href="/articles/${encodeURI(a.slug)}"><img src="${img}" alt="${esc(a.primaryKeyword||a.title)}" title="${esc(a.title||a.primaryKeyword||'')}" width="1200" height="760" loading="${idx<3?'eager':'lazy'}" fetchpriority="${idx===0?'high':'auto'}" decoding="async"></a><div class="cardBody"><div class="cardMeta"><span class="tag">${market}</span><span>${esc(dateText)}</span></div><h2><a href="/articles/${encodeURI(a.slug)}">${esc(a.title)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><div class="cardFoot"><span>فريق تحرير كوبونات نون</span><a class="read" href="/articles/${encodeURI(a.slug)}">اقرأ الدليل ←</a></div></div></article>`}).join('');
  const origin=env.SITE_ORIGIN||u.origin,canonical=page===1?`${origin}/blog`:`${origin}/blog?page=${page}`,prev=page>1?(page===2?`${origin}/blog`:`${origin}/blog?page=${page-1}`):'',next=page<totalPages?`${origin}/blog?page=${page+1}`:'';
  const pageLinks=Array.from({length:Math.min(5,totalPages)},(_,i)=>{
    let n;if(totalPages<=5)n=i+1;else if(page<=3)n=i+1;else if(page>=totalPages-2)n=totalPages-4+i;else n=page-2+i;
    return `<a class="${n===page?'current':''}" href="${n===1?'/blog':'/blog?page='+n}" aria-label="صفحة ${n}"${n===page?' aria-current="page"':''}>${n}</a>`;
  }).join('');
  const pagination=totalPages>1?`<nav class="pagination" aria-label="صفحات المدونة">${page>1?`<a href="${page===2?'/blog':'/blog?page='+(page-1)}">السابق</a>`:''}${pageLinks}${page<totalPages?`<a href="/blog?page=${page+1}">التالي</a>`:''}</nav>`:'';
  const blogTitle=page===1?'مدونة كوبونات نون | أحدث أدلة السعودية والإمارات':'مدونة كوبونات نون | صفحة '+page;
  const blogDesc='أحدث أدلة نون السعودية والإمارات: استخدام الكوبون، اختيار المنتجات، مقارنة السعر النهائي، وحل مشاكل الأهلية قبل الدفع.';
  const blogGraph={'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':origin+'/#organization',name:'Noon Deals Now',alternateName:'كوبونات نون',url:origin+'/'},
    {'@type':'WebSite','@id':origin+'/#website',name:'Noon Deals Now',alternateName:'كوبونات نون',url:origin+'/',inLanguage:['ar','en'],publisher:{'@id':origin+'/#organization'}},
    {'@type':'CollectionPage','@id':canonical+'#page',url:canonical,name:blogTitle,description:blogDesc,inLanguage:'ar',isPartOf:{'@id':origin+'/#website'},publisher:{'@id':origin+'/#organization'},mainEntity:{'@id':canonical+'#list'}},
    {'@type':'ItemList','@id':canonical+'#list',numberOfItems:rows.length,itemListElement:rows.map((a,i)=>({'@type':'ListItem',position:offset+i+1,url:origin+'/articles/'+encodeURI(a.slug),name:a.title||a.primaryKeyword||a.slug}))},
    {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[
      {'@type':'ListItem',position:1,name:'الرئيسية',item:origin+'/'},
      {'@type':'ListItem',position:2,name:page===1?'المدونة':'المدونة — صفحة '+page,item:canonical}
    ]}
  ]};
  const blogSchema=JSON.stringify(blogGraph).replace(/</g,'\\u003c');
  const h=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${blogTitle}</title><meta name="description" content="${blogDesc}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${canonical}"><link rel="alternate" type="application/rss+xml" title="كوبونات نون — RSS" href="${origin}/feed.xml"><script type="application/ld+json" data-schema="blog-collection">${blogSchema}</script>${prev?`<link rel="prev" href="${prev}">`:''}${next?`<link rel="next" href="${next}">`:''}<style>:root{--ink:#101828;--muted:#667085;--line:#e7e9ee;--gold:#f5c400}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial;background:#f8fafc;color:var(--ink)}.w{width:min(1180px,94%);margin:auto}header{background:#fff;color:#111827;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}header .w{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:18px}header nav{display:flex;gap:18px;flex-wrap:wrap}header a{color:#111827;text-decoration:none;font-weight:800}.brand{font-size:21px;display:flex;align-items:center;gap:9px}.brandMark{width:40px;height:40px;border-radius:12px 12px 12px 4px;background:#111827;color:#ffe34f;display:grid;place-items:center}.hero{padding:48px 0 30px;background:radial-gradient(circle at 15% 10%,rgba(245,196,0,.17),transparent 30%),#fff;border-bottom:1px solid var(--line)}.hero small{font-weight:900;color:#7b6200}.hero h1{font-size:clamp(36px,5vw,54px);margin:10px 0}.hero p{max-width:760px;color:var(--muted);line-height:1.9;font-size:17px}.heroActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.heroActions a{padding:10px 14px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;font-weight:900}.pageMeta{margin-top:14px;color:#667085;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:34px 0 26px}.card{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 14px 40px rgba(16,24,40,.06);transition:.18s}.card:hover{transform:translateY(-2px);box-shadow:0 20px 54px rgba(16,24,40,.10)}.leadCard{grid-column:span 2;display:grid;grid-template-columns:1.15fr .85fr}.leadCard .thumb{border-bottom:0;border-left:1px solid #edf0f4}.thumb{display:block;background:#fffdf2;border-bottom:1px solid #edf0f4}.thumb img{display:block;width:100%;height:auto;aspect-ratio:1200/760;object-fit:contain}.cardBody{padding:17px}.cardMeta,.cardFoot{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--muted)}.tag{background:#fff8d5;color:#6f5700;border:1px solid #f0df83;padding:5px 9px;border-radius:999px;font-weight:900}.card h2{font-size:19px;line-height:1.62;margin:12px 0}.leadCard h2{font-size:26px}.card h2 a,.read{text-decoration:none;color:var(--ink)}.card p{color:var(--muted);line-height:1.8;margin:0 0 16px}.read{font-weight:900;color:#344054}.cardFoot{padding-top:12px;border-top:1px solid #f0f1f3}.pagination{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:10px 0 48px}.pagination a{min-width:40px;min-height:40px;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:#fff;color:#344054;text-decoration:none;font-weight:900;text-align:center}.pagination a.current{background:#111827;color:#fff;border-color:#111827}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}.leadCard{grid-column:1/-1}}@media(max-width:640px){header .w{display:block;padding:14px 0}header nav{margin-top:10px}.grid{grid-template-columns:1fr}.leadCard{display:block}.leadCard .thumb{display:none}.hero{padding-top:34px}}</style></head><body><header><div class="w"><a class="brand" href="/"><span class="brandMark">ك</span><span>كوبونات نون</span></a><nav><a href="/coupons">الكوبونات</a><a href="/saudi">السعودية</a><a href="/uae">الإمارات</a><a href="/saudi/categories">الأقسام</a><a href="/editorial-policy">السياسة التحريرية</a></nav></div></header><section class="hero"><div class="w"><small>أدلة عملية قبل الدفع</small><h1>مدونة كوبونات نون</h1><p>أدلة شراء واستخدام للكوبونات في السعودية والإمارات، يراجعها فريق التحرير للتأكد من وضوح السوق والكود والمعلومات الأساسية قبل النشر.</p><div class="heroActions"><a href="/saudi/categories">أقسام السعودية</a><a href="/uae/categories">أقسام الإمارات</a><a href="/coupon-verification">كيف نتحقق من الأكواد؟</a></div><div class="pageMeta">الصفحة ${page} من ${totalPages} · ${all.length} مقال متاح في الأرشيف</div></div></section><main class="w"><section class="grid">${cards}</section>${pagination}</main></body></html>`;
  return new Response(h,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-blog-schema':'collection-v1','x-blog-page-size':String(perPage)}});
}

async function sitemapIndex(env,origin){
  const days=await r2json(env,'bulk/days.json',{days:[]});
  const items=[];
  for(const d of days.days||[])for(let i=Number(d.shards||0)-1;i>=0;i--)items.push({loc:`${origin}/sitemap-articles-${d.day}-${i}.xml`,lastmod:d.updatedAt||`${d.day}T23:59:59.000Z`});
  for(const n of STATIC_SITEMAPS)items.push({loc:`${origin}/sitemap-${n}.xml`,lastmod:null});
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.map(x=>`<sitemap><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:''}</sitemap>`).join('')}</sitemapindex>`;
}

async function articleSitemap(path,env,origin){
  const m=path.match(/^\/sitemap-articles-(\d{4}-\d{2}-\d{2})-(\d+)\.xml$/);if(!m)return null;
  const day=m[1],shard=Number(m[2]),d=await r2json(env,`bulk/day/${day}/${shard}.json`,null);if(!d)return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  const urls=(d.articles||[]).map(a=>`<url><loc>${esc(origin+'/articles/'+encodeURI(a.slug))}</loc><lastmod>${esc(a.updatedAt||a.createdAt||day)}</lastmod></url>`).join('');
  return xml(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

function aiUsage(status,callsUsed=0){
  const day=now().slice(0,10);
  const base=String(status?.workersAiDay||'')===day?Math.max(0,Number(status?.workersAiCallsToday||0)):0;
  return {workersAiDay:day,workersAiCallsToday:base+Math.max(0,Number(callsUsed||0))};
}

async function runOnce(env,{manual=false}={}){
  const cfg=await getGeneratorConfig(env);
  if(!cfg.enabled&&!manual)return {skipped:'paused'};
  const runId=crypto.randomUUID(),lock=await generatorLock(env,runId);
  if(lock.status===409)return {skipped:'already_running'};
  const started=Date.now(),status=await getGeneratorStatus(env),attempt=Number(status.attempts||0);
  let workersAiCallsUsed=0;
  try{
    const st=await readState(env),topic=pickTopic(st,attempt);
    if(!topic)throw new Error('topic_pool_exhausted');
    const budget=workersAiBudget(env,st,status);
    if(!budget.binding){
      const next={...aiUsage(status,0),attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0),skippedNoAI:Number(status.skippedNoAI||0)+1,lastRun:now(),lastError:'workers_ai_binding_missing',lastOperationalState:'workers-ai-unavailable',lastDurationMs:Date.now()-started};
      await updateGeneratorStatus(env,next);return {ok:true,skipped:'workers_ai_binding_missing',budget};
    }
    if(!budget.available){
      const reason=budget.quotaBlocked?'workers_ai_free_quota_exhausted':budget.remaining<=0?'workers_ai_daily_article_cap':'workers_ai_daily_call_cap';
      if(budget.quotaBlocked)return {ok:true,skipped:reason,budget,resumesAt:budget.quotaResetAt};
      if(String(status.lastError||'')===reason&&String(status.workersAiDay||'')===now().slice(0,10))return {ok:true,skipped:reason,budget};
      const next={...aiUsage(status,0),attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0),skippedNoAI:Number(status.skippedNoAI||0)+1,lastRun:now(),lastError:reason,lastOperationalState:'workers-ai-capped',lastDurationMs:Date.now()-started};
      await updateGeneratorStatus(env,next);return {ok:true,skipped:reason,budget};
    }
    let out;
    try{out=await generateWithWorkersAI(env,topic,cfg,st,attempt,status);workersAiCallsUsed=Number(out.callsUsed||0)}
    catch(e){workersAiCallsUsed=Number(e?.workersAiCallsUsed||0);throw e}
    if(out.skipped){
      const next={...aiUsage(status,workersAiCallsUsed),attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0),skippedNoAI:Number(status.skippedNoAI||0)+1,lastRun:now(),lastError:String(out.reason||'workers_ai_skipped'),lastOperationalState:'workers-ai-skipped',lastDurationMs:Date.now()-started};
      await updateGeneratorStatus(env,next);return {ok:true,skipped:out.reason||'workers_ai_skipped',budget:out.budget};
    }
    const usage=aiUsage(status,workersAiCallsUsed);
    if(!out.audit.productionReady)throw Object.assign(new Error('quality_gate_'+out.audit.score+'_words_'+out.audit.wordCount),{workersAiCallsUsed});
    const rec=await publishGenerated(env,out.article,topic,out.audit,out.provider);
    const next={...usage,attempts:attempt+1,published:Number(status.published||0)+1,drafted:Number(status.drafted||0),failed:Number(status.failed||0),lastRun:now(),lastSuccess:now(),lastError:null,lastOperationalState:'published',lastSlug:rec.slug,lastTitle:rec.title,lastKeyword:rec.primaryKeyword,lastProvider:out.provider,lastQuality:out.audit.score,lastWordCount:out.audit.wordCount,lastDurationMs:Date.now()-started};
    await updateGeneratorStatus(env,next);
    return {ok:true,record:rec,audit:out.audit,provider:out.provider,workersAiCallsUsed,budget:out.budget};
  }catch(e){
    const usage=aiUsage(status,workersAiCallsUsed||Number(e?.workersAiCallsUsed||0)),quotaHit=isWorkersAiFreeQuotaError(e);
    const next={...usage,attempts:attempt+1,published:Number(status.published||0),drafted:Number(status.drafted||0),failed:Number(status.failed||0)+(quotaHit?0:1),skippedNoAI:Number(status.skippedNoAI||0)+(quotaHit?1:0),lastRun:now(),lastError:quotaHit?'workers_ai_free_quota_exhausted':String(e?.message||e),lastOperationalState:quotaHit?'workers-ai-free-quota-exhausted':'workers-ai-error',lastDurationMs:Date.now()-started,...(quotaHit?{workersAiQuotaDay:now().slice(0,10),workersAiQuotaBlockedAt:now()}:{})};
    await updateGeneratorStatus(env,next);
    return {ok:false,error:next.lastError,resumesAt:quotaHit?new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()+1)).toISOString():undefined};
  }finally{await generatorUnlock(env,runId)}
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
    if(u.pathname==='/sitemap.xml')return xml(await sitemapIndex(env,origin));
    if(u.pathname.startsWith('/sitemap-articles-')){const r=await articleSitemap(u.pathname,env,origin);if(r)return r}
    if(u.pathname==='/blog'){const r=await bulkBlogPage(req,env,ctx);if(r)return r}
    if(u.pathname.startsWith('/articles/')){const r=await bulkArticlePage(u,env);if(r)return r}
    if(u.pathname==='/api/ai/generate')return json({error:'legacy_external_generation_disabled',version:VERSION,provider:'workers-ai',externalProviders:false,use:'/api/admin/generate-now'},410);
    if(u.pathname==='/api/platform-health')return json({ok:true,version:PLATFORM_VERSION,generatorVersion:VERSION,control:Boolean(env.CONTROL),r2:Boolean(env.CONTENT_FINAL),workersAI:Boolean(env.AI),bulkProgrammatic:true,bulkEngine:BULK_ENGINE_INFO.version,qualityFirst:true,bulkDailyTarget:Number(env.BULK_DAILY_TARGET||0),ai:{provider:'workers-ai',externalProviders:false,legacyProvidersRemoved:true},time:now()});
    if(u.pathname==='/api/state'&&req.method==='GET'){
      const r=await app.fetch(req,env,ctx);if(!r.ok)return r;
      try{const s=await r.json();s.settings={...(s.settings||{}),aiPrimary:'workers-ai',aiFallback:null,targetWords:1500,minWords:1000,qualityThreshold:95};return json(s,r.status)}catch{return r}
    }
    if(u.pathname==='/admin'||u.pathname==='/admin/')return renderAdmin(req,env);
    if(u.pathname==='/api/admin/login'&&req.method==='POST')return secureLogin(req,env);
    if(u.pathname==='/api/admin/generate-now'&&req.method==='POST'){
      if(!(await isAdmin(req,env)))return json({error:'unauthorized'},401);
      return json(await runOnce(env,{manual:true}));
    }
    if(u.pathname==='/api/admin/bulk-now'&&req.method==='POST'){
      if(!(await isAdmin(req,env)))return json({error:'unauthorized'},401);
      return json(await bulkTick(env));
    }
    if(u.pathname==='/api/admin/status'){
      const r=await handleAdminApi(req,env);if(!r)return r;if(!r.ok)return r;
      try{const d=await r.json();delete d.groqReady;d.workersAIReady=Boolean(env.AI);d.generatorVersion=VERSION;d.activeProvider='workers-ai + '+BULK_ENGINE_INFO.version;d.externalProviders=false;d.qualityFirst=true;d.config={...(d.config||{}),model:env.WORKERS_AI_MODEL||'@cf/zai-org/glm-4.7-flash'};return json(d,r.status)}catch{return r}
    }
    if(u.pathname.startsWith('/api/admin/')){const r=await handleAdminApi(req,env);if(r)return r}
    if(u.pathname==='/api/generator-health'){
      const [cfg,status]=await Promise.all([getGeneratorConfig(env),getGeneratorStatus(env)]);
      let st={articles:[]},controlStateAvailable=true,controlStateError=null;
      try{st=await readState(env)}catch(e){controlStateAvailable=false;controlStateError=String(e?.message||e).slice(0,220)}
      const workersAI=workersAiBudget(env,st,status);
      const workersAiArticles=(st.articles||[]).filter(a=>a.status==='published'&&String(a.provider||'').startsWith('workers-ai:')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),lastWorkersAiSuccess=workersAiArticles[0]||null;
      const bulkTotal=Math.max(0,Number(status.bulkPublishedTotal||0)),bulkToday=String(status.bulkDay||'')===now().slice(0,10)?Math.max(0,Number(status.bulkPublishedToday||0)):0;
      const catchupGoal=Math.max(0,Number(env.BULK_CATCHUP_TOTAL||30000)),steadyBatch=Math.max(1,Number(env.BULK_BATCH_SIZE||16)),catchupBatch=Math.max(steadyBatch,Math.min(BULK_RUNTIME_LIMITS.maxBatchSize,Number(env.BULK_CATCHUP_BATCH_SIZE||48))),effectiveBatch=bulkTotal<catchupGoal?catchupBatch:steadyBatch,catchupRemaining=Math.max(0,catchupGoal-bulkTotal),catchupHours=Math.max(1,Number(env.BULK_CATCHUP_WINDOW_HOURS||8)),windowMinutes=catchupHours*60,requiredPerMinute=catchupRemaining/windowMinutes,theoreticalPerHour=effectiveBatch*60,theoreticalWindowCapacity=effectiveBatch*windowMinutes,theoreticalHoursAtFullBatch=effectiveBatch?catchupRemaining/effectiveBatch/60:null,dailyTarget=Math.max(0,Number(env.BULK_DAILY_TARGET||32000)),dailyHeadroom=Math.max(0,dailyTarget-bulkToday);
      const catchupPlan={target:catchupGoal,current:bulkTotal,remaining:catchupRemaining,windowHours:catchupHours,requiredPerMinute:Number(requiredPerMinute.toFixed(2)),steadyBatchSize:steadyBatch,catchupBatchSize:catchupBatch,effectiveBatchSize:effectiveBatch,theoreticalPerHour,theoreticalWindowCapacity,theoreticalHoursAtFullBatch:theoreticalHoursAtFullBatch==null?null:Number(theoreticalHoursAtFullBatch.toFixed(2)),dailyTarget,dailyHeadroom,qualityThresholdFloor:BULK_RUNTIME_LIMITS.qualityThresholdFloor,minArticleWords:BULK_RUNTIME_LIMITS.minArticleWords,capacityMeetsEightHourGoal:theoreticalWindowCapacity>=catchupRemaining&&dailyHeadroom>=Math.min(catchupRemaining,theoreticalWindowCapacity)};
      const legacyCount=(st.articles||[]).length,legacyPublished=(st.articles||[]).filter(a=>a.status==='published').length;
      return json({ok:true,degraded:!controlStateAvailable,version:VERSION,cron:'* * * * *',enabled:cfg.enabled,statusBackend:status.backend||'r2-v1',publishPolicy:'Quality first: publish only useful unique articles that pass score>=95, no P0 issues, core group floor>=88, 1000-2000 words, country/coupon/brand locks; daily target is a maximum not a quota',preferredProvider:'workers-ai',providers:{workersAI:workersAI.binding,programmaticCloudflare:true,external:false},legacyProvidersRemoved:true,workersAI,workersAiPublishedTotal:workersAiArticles.length,lastWorkersAiSuccess:lastWorkersAiSuccess?{slug:lastWorkersAiSuccess.slug,createdAt:lastWorkersAiSuccess.createdAt,provider:lastWorkersAiSuccess.provider,quality:lastWorkersAiSuccess.quality,country:lastWorkersAiSuccess.country,coupon:lastWorkersAiSuccess.coupon}:null,models:{workersAI:env.WORKERS_AI_MODEL||'@cf/zai-org/glm-4.7-flash'},bulk:{enabled:Number(env.BULK_DAILY_TARGET||0)>0,engine:status.bulkEngine||BULK_ENGINE_INFO.version,qualityFirst:true,topicSpace:BULK_ENGINE_INFO.topicSpace,blueprints:BULK_ENGINE_INFO.blueprints,dailyTarget,batchSize:steadyBatch,catchupPlan,publishedToday:bulkToday,publishedTotal:bulkTotal,lastRun:status.bulkLastRun||null,lastError:status.bulkLastError||null,lastSlug:status.bulkLastSlug||null,lastQuality:status.bulkLastQuality??null,lastQualityFloor:status.bulkLastQualityFloor??null,lastGroups:status.bulkLastGroups||null,lastWordCount:status.bulkLastWordCount??null,rejectedQuality:Number(status.bulkRejectedQuality||0),rejectedDuplicate:Number(status.bulkRejectedDuplicate||0)},r2Ready:Boolean(env.CONTENT_FINAL),controlReady:controlStateAvailable,generatorControlReady:false,controlStateError,articleCount:legacyCount+bulkTotal,publishedCount:legacyPublished+bulkTotal,draftCount:(st.articles||[]).filter(a=>a.status==='draft').length,status});
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(event,env,ctx){
    if(app.scheduled)ctx.waitUntil(app.scheduled(event,env,ctx));
    ctx.waitUntil(bulkTick(env));
  }
};
