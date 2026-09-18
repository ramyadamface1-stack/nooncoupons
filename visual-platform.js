import app from './platform.js';
export {ControlPlane} from './platform.js';
import {couponSvg,noonUrl} from './svg-engine.js';
import {normalizeApprovedCoupon} from './approved-coupons.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const countryAr=c=>c==='SA'?'السعودية':'الإمارات';
const countryEn=c=>c==='SA'?'Saudi Arabia':'UAE';
const validCountry=c=>c==='AE'?'AE':'SA';
const validCoupon=(c,country='SA')=>normalizeApprovedCoupon(c,country==='AE'?'NOV188':'NOV170');
const keywordOf=rec=>String(rec?.primaryKeyword||rec?.title||rec?.slug||'كود خصم نون').trim();

async function getState(env,ctx,origin){
  try{
    const r=await app.fetch(new Request(origin+'/api/state',{headers:{accept:'application/json'}}),env,ctx);
    if(!r.ok)return {articles:[]};
    try{return await r.json()}catch{return {articles:[]}}
  }catch{return {articles:[]}}
}

function fallbackRec(html,slug){
  const h1=(String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||slug;
  const title=strip(h1)||slug;
  const hay=(slug+' '+title+' '+html.slice(0,1800));
  const country=/الإمارات|الامارات|UAE/i.test(hay)?'AE':'SA';
  const coupon=(String(html).match(/\b(?:NOV\d+|OPS\d+)\b/i)||[])[0]||'';
  return {slug,title,primaryKeyword:title,coupon:validCoupon(coupon,country),country,status:'published',metaDescription:''};
}

async function r2ArticleMeta(env,slug){
  try{
    const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.head('articles/'+slug+'.html'):null;
    const md=o?.customMetadata||{};
    if(!o)return null;
    const dec=x=>{try{return decodeURIComponent(String(x||''))}catch{return String(x||'')}};
    const country=md.c==='AE'?'AE':'SA';
    return {slug,title:dec(md.t)||slug,primaryKeyword:dec(md.kw)||dec(md.t)||slug,coupon:validCoupon(md.cp,country),country,status:'published'};
  }catch{return null}
}

function params(rec){
  return new URLSearchParams({v:'9',coupon:validCoupon(rec.coupon,validCountry(rec.country)),country:validCountry(rec.country)}).toString();
}
function couponSrc(rec,v){return `/assets/coupon-svg/${encodeURIComponent(rec.slug)}/${v}.svg?${params(rec)}`}
function featuredSrc(rec){return couponSrc(rec,1)}

function couponVisual(rec,v){
  const country=countryAr(rec.country),brand=noonUrl(),src=couponSrc(rec,v),code=validCoupon(rec.coupon,validCountry(rec.country)),keyword=keywordOf(rec);
  return `<figure class="coupon-visual coupon-visual-${v}">
    <a class="coupon-image-link" href="${brand}" target="_blank" rel="noopener external sponsored" data-shop-click="${code}" data-market="${validCountry(rec.country)}" data-placement="article_visual_image_${v}" aria-label="فتح موقع نون الرسمي وتجربة ${esc(keyword)}">
      <img src="${src}" alt="${esc(keyword)} - كوبون نون ${country} ${code}" title="${esc(keyword)}" width="1200" height="760" loading="lazy" decoding="async">
    </a>
    <div class="coupon-live-actions" role="group" aria-label="إجراءات ${esc(keyword)}">
      <button type="button" class="coupon-copy-btn" data-copy-code="${code}" data-market="${validCountry(rec.country)}" data-placement="article_visual_${v}">نسخ الكود</button>
      <a class="coupon-try-btn" href="${brand}" target="_blank" rel="noopener external sponsored" data-shop-click="${code}" data-market="${validCountry(rec.country)}" data-placement="article_visual_${v}">فتح نون</a>
    </div>
    <figcaption>${esc(keyword)} · كوبون ${code} · نون ${country}</figcaption>
  </figure>`;
}

function featuredBlock(rec){
  const country=countryAr(rec.country),code=validCoupon(rec.coupon,validCountry(rec.country)),src=featuredSrc(rec),keyword=keywordOf(rec);
  return `<figure class="article-featured">
    <a href="${noonUrl()}" target="_blank" rel="noopener external sponsored" data-shop-click="${code}" data-market="${validCountry(rec.country)}" data-placement="article_featured_image" aria-label="فتح نون الرسمي - ${esc(keyword)}">
      <img src="${src}" alt="${esc(keyword)} - كوبون نون ${country} ${code}" title="${esc(keyword)}" width="1200" height="760" loading="eager" fetchpriority="high" decoding="async">
    </a>
    <figcaption>${esc(keyword)} · ${code} · نون ${country}</figcaption>
  </figure>`;
}

function injectInternalVisuals(h,rec){
  if((h.match(/class="coupon-visual/g)||[]).length>=4)return h;
  const variants=[2,3,4,5];
  const total=(h.match(/<\/p>/gi)||[]).length;
  if(total<4)return h+variants.map(v=>couponVisual(rec,v)).join('');
  const pos=[.20,.41,.62,.83].map(p=>Math.max(1,Math.min(total,Math.round(total*p))));
  const targets=[];
  for(const n of pos){let x=n;while(targets.includes(x)&&x<total)x++;while(targets.includes(x)&&x>1)x--;targets.push(x)}
  const parts=h.split(/(<\/p>)/i);let n=0,vi=0,out='';
  for(const part of parts){
    out+=part;
    if(/^<\/p>$/i.test(part)){
      n++;
      while(vi<variants.length&&targets[vi]===n){out+=couponVisual(rec,variants[vi]);vi++;}
    }
  }
  while(vi<variants.length){out+=couponVisual(rec,variants[vi]);vi++;}
  return out;
}

function css(){return `<style id="visual-v5">
.a,.a *{box-sizing:border-box}.a{font-size:18px;line-height:2;overflow-wrap:anywhere}.a p{margin-bottom:20px}.a h2{margin-top:38px;line-height:1.55}.a h3{margin-top:26px}
.article-featured,.coupon-visual,.article-visual{box-sizing:border-box;width:min(860px,100%);max-width:100%;margin:30px auto;background:#fff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;box-shadow:0 16px 42px rgba(15,23,42,.08);padding:0}
.article-featured{margin-top:18px;margin-bottom:38px}.coupon-visual{width:min(840px,100%);margin-top:38px;margin-bottom:38px}
.article-featured a,.coupon-image-link{display:block;width:100%;max-width:100%;background:#fffdf0;overflow:hidden}
.article-featured img,.coupon-visual img,.article-visual img,.a>figure img{display:block;width:100%!important;max-width:100%!important;height:auto!important;min-width:0;object-fit:contain!important;object-position:center center;background:#fffdf0;margin:0 auto}
.article-featured figcaption,.coupon-visual figcaption,.article-visual figcaption{padding:10px 18px 16px;color:#667085;text-align:center;font-size:13px;line-height:1.65;overflow-wrap:anywhere}
.coupon-live-actions{display:flex;gap:12px;justify-content:center;padding:16px 18px 8px}.coupon-copy-btn,.coupon-try-btn{min-width:155px;border:0;border-radius:14px;padding:13px 18px;font:800 16px/1 Arial,sans-serif;text-align:center;text-decoration:none;cursor:pointer}.coupon-copy-btn{background:#111;color:#fff}.coupon-try-btn{background:#FEEE00;color:#111}.coupon-copy-btn.copied{background:#087A3E}
.blog-shell{font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827;min-height:100vh}.blog-head{background:#111827;color:#fff;padding:26px 0}.blog-wrap{width:min(1180px,92%);margin:auto}.blog-nav{display:flex;gap:18px;flex-wrap:wrap}.blog-nav a{color:#fff;text-decoration:none;font-weight:700}.blog-hero{padding:42px 0 26px}.blog-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding-bottom:55px}.blog-card{min-width:0;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.06)}.blog-thumb{width:100%;aspect-ratio:1200/760;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fffdf0;border-bottom:1px solid #eee}.blog-thumb img{display:block;width:100%;height:100%!important;object-fit:contain!important;object-position:center}.blog-card-body{padding:18px}.blog-card h2{font-size:20px;line-height:1.65;margin:10px 0}.blog-card h2 a{color:#111827;text-decoration:none}.blog-card p{color:#667085;line-height:1.8}.tag{display:inline-block;padding:5px 10px;border-radius:999px;background:#fff8bf;font-weight:800;font-size:12px}.meta{font-size:12px;color:#667085;margin-top:12px}.read{display:inline-block;margin-top:12px;color:#5b21b6;font-weight:800;text-decoration:none}
@media(max-width:900px){.blog-grid{grid-template-columns:1fr 1fr}.article-featured,.coupon-visual,.article-visual{width:100%;max-width:100%}}
@media(max-width:640px){.blog-grid{grid-template-columns:1fr}.coupon-live-actions{gap:8px;padding-inline:10px}.coupon-copy-btn,.coupon-try-btn{min-width:0;flex:1;padding:12px 8px;font-size:14px}.a{font-size:16px;width:min(100%,calc(100% - 24px))!important}.article-featured,.coupon-visual,.article-visual{width:100%;max-width:100%;margin:22px 0;border-radius:14px}.article-featured figcaption,.coupon-visual figcaption,.article-visual figcaption{font-size:12px;padding-inline:12px}}
</style>`}

function js(){return `<script>(()=>{const fire=(name,data)=>{try{if(typeof window.gtag==='function')window.gtag('event',name,data);else{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:name,...data})}}catch{}};document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.fallbackApplied==='1')return;const m=location.pathname.match(/^\/articles\/(.+)$/);if(!m)return;img.dataset.fallbackApplied='1';const code=document.querySelector('[data-copy-code]')?.dataset.copyCode||'NOV170',market=document.querySelector('[data-market]')?.dataset.market||'SA';img.src='/assets/coupon-svg/'+m[1]+'/1.svg?v=9&coupon='+encodeURIComponent(code)+'&country='+encodeURIComponent(market)},true);document.addEventListener('click',async e=>{const shop=e.target.closest('[data-shop-click]');if(shop)fire('shop_click',{coupon_code:shop.dataset.shopClick||'',market:shop.dataset.market||'UNSPECIFIED',page_path:location.pathname,placement:shop.dataset.placement||'article_visual',destination:shop.href||''});const b=e.target.closest('[data-copy-code]');if(!b)return;const code=b.dataset.copyCode||'',market=b.dataset.market||'UNSPECIFIED',placement=b.dataset.placement||'article_visual';let ok=false;try{await navigator.clipboard.writeText(code);ok=true;const old=b.textContent;b.classList.add('copied');b.textContent='تم النسخ ✓';setTimeout(()=>{b.textContent=old;b.classList.remove('copied')},1600)}catch{b.textContent=code}fire('copy_code',{coupon_code:code,market,page_path:location.pathname,placement,copy_success:ok})})})();</script>`}

function imageSchema(rec,origin){
  const keyword=keywordOf(rec),featured=origin+featuredSrc(rec);
  const graph=[
    {'@type':'ImageObject','@id':featured+'#image',name:keyword,description:`${keyword} - ${validCoupon(rec.coupon)} - Noon ${countryEn(rec.country)}`,contentUrl:featured,url:featured,caption:keyword,representativeOfPage:true,width:1200,height:760,inLanguage:'ar'},
    ...[2,3,4,5].map(v=>{const u=origin+couponSrc(rec,v);return {'@type':'ImageObject','@id':u+'#image',name:keyword,description:`${keyword} - coupon visual ${v}`,contentUrl:u,url:u,caption:keyword,representativeOfPage:false,width:1200,height:760,inLanguage:'ar'}})
  ];
  return `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>`;
}

function safeFallbackSvg({slug='',coupon='NOV170',country='SA'}={}){
  const label=countryAr(validCountry(country)),code=validCoupon(coupon,validCountry(country)),title=esc(String(slug||'دليل كوبونات نون').replace(/[-_]+/g,' ').slice(0,90));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid meet" overflow="hidden"><rect width="1200" height="760" fill="#fffdf0"/><rect x="35" y="35" width="1130" height="690" rx="32" fill="#fff" stroke="#eadb72"/><text x="1080" y="120" text-anchor="end" direction="rtl" font-family="Arial,Tahoma,sans-serif" font-size="34" font-weight="800" fill="#111827">كوبونات نون · ${esc(label)}</text><text x="1080" y="245" text-anchor="end" direction="rtl" font-family="Arial,Tahoma,sans-serif" font-size="42" font-weight="900" fill="#111827">${title}</text><rect x="70" y="355" width="350" height="150" rx="24" fill="#feee00"/><text x="245" y="450" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="900" fill="#111">${esc(code)}</text><text x="1080" y="610" text-anchor="end" direction="rtl" font-family="Arial,Tahoma,sans-serif" font-size="22" fill="#667085">تحقق من الكود والنتيجة داخل سلة نون</text></svg>`;
}

async function assetResponse(req,env,ctx){
  const u=new URL(req.url);
  let m=u.pathname.match(/^\/assets\/coupon-svg\/([^/]+)\/([1-5])\.svg$/);
  if(m){
    const slug=decodeURIComponent(m[1]),v=Number(m[2]),queryCountry=validCountry(u.searchParams.get('country'));
    let rec=null;
    try{rec=await r2ArticleMeta(env,slug)}catch{}
    if(!rec)rec={slug,coupon:validCoupon(u.searchParams.get('coupon'),queryCountry),country:queryCountry,title:slug,primaryKeyword:String(slug).replace(/[-_]+/g,' '),status:'published'};
    try{
      const svg=couponSvg({coupon:validCoupon(rec.coupon,validCountry(rec.country)),country:validCountry(rec.country),variant:v,brand:'noon',title:keywordOf(rec)});
      return new Response(svg,{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff','x-image-source':'r2-or-safe-v8'}});
    }catch{
      return new Response(safeFallbackSvg({slug,coupon:rec.coupon,country:rec.country}),{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public,max-age=3600','x-content-type-options':'nosniff','x-image-source':'fallback-v8'}});
    }
  }
  m=u.pathname.match(/^\/assets\/featured\/([^/]+)\.svg$/);
  if(m){
    const slug=decodeURIComponent(m[1]),country=validCountry(u.searchParams.get('country'));
    let rec=null;
    try{rec=await r2ArticleMeta(env,slug)}catch{}
    if(!rec)rec={slug,coupon:validCoupon(u.searchParams.get('coupon'),country),country,title:slug,primaryKeyword:String(slug).replace(/[-_]+/g,' '),status:'published'};
    return Response.redirect(new URL(couponSrc(rec,1),u.origin).toString(),308);
  }
  return null;
}

async function blogPage(env,ctx,origin){
  const s=await getState(env,ctx,origin),articles=(s.articles||[]).filter(a=>a.status==='published');
  const cards=articles.map(a=>{
    const slug=encodeURIComponent(a.slug),keyword=keywordOf(a);
    return `<article class="blog-card"><a class="blog-thumb" href="/articles/${slug}"><img src="${featuredSrc(a)}" alt="${esc(keyword)}" title="${esc(keyword)}" width="1200" height="760" loading="lazy" decoding="async"></a><div class="blog-card-body"><span class="tag">${countryAr(a.country)}</span><h2><a href="/articles/${slug}">${esc(a.title)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><div class="meta">${esc(a.coupon||'')} · ${countryAr(a.country)}</div><a class="read" href="/articles/${slug}">اقرأ المقال ←</a></div></article>`;
  }).join('');
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مدونة كوبونات نون | السعودية والإمارات</title><meta name="description" content="مقالات وأدلة كوبونات نون السعودية والإمارات بصور كوبونات احترافية وأدلة شراء عملية."><link rel="canonical" href="${origin}/blog">${css()}</head><body class="blog-shell"><header class="blog-head"><div class="blog-wrap"><nav class="blog-nav"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/saudi">السعودية</a><a href="/uae">الإمارات</a><a href="/saudi/categories">الأقسام</a></nav></div></header><main class="blog-wrap"><section class="blog-hero"><h1>مدونة كوبونات نون</h1><p>أحدث أدلة نون السعودية والإمارات، مرتبة لتسهيل الوصول إلى الكوبونات والأقسام قبل الدفع.</p></section><section class="blog-grid">${cards}</section></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=30,s-maxage=60'}});
}

function enhance(h,rec,origin){
  h=String(h).replace(/(\/assets\/coupon-svg\/[^"'\s<>]+\/[1-5]\.svg\?)v=\d+/g,(m,prefix)=>prefix+'v=9');
  if(!h.includes('class="article-featured"'))h=h.includes('<main class="a">')?h.replace('<main class="a">','<main class="a">'+featuredBlock(rec)):h.replace('<body>','<body>'+featuredBlock(rec));
  h=injectInternalVisuals(h,rec);
  const featured=origin+featuredSrc(rec),keyword=keywordOf(rec);
  const social=`<meta property="og:type" content="article"><meta property="og:image" content="${featured}"><meta property="og:image:alt" content="${esc(keyword)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="760"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${featured}"><meta name="twitter:image:alt" content="${esc(keyword)}"><link rel="preload" as="image" href="${featured}" type="image/svg+xml">`;
  h=h.replace('</head>',social+css()+imageSchema(rec,origin)+'</head>');
  h=h.replace('</body>',js()+'</body>');
  return h;
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname.startsWith('/assets/coupon-svg/')||u.pathname.startsWith('/assets/featured/')){const r=await assetResponse(req,env,ctx);if(r)return r}
    if(u.pathname==='/blog'||u.pathname==='/blog/')return blogPage(env,ctx,u.origin);
    const res=await app.fetch(req,env,ctx);
    if(!u.pathname.startsWith('/articles/')||res.status!==200||!(res.headers.get('content-type')||'').includes('text/html'))return res;
    let h=await res.text();
    const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()),s=await getState(env,ctx,u.origin);
    let rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');
    if(!rec)rec=fallbackRec(h,slug);
    h=enhance(h,rec,u.origin);
    const headers=new Headers(res.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','public,max-age=0,s-maxage=60');headers.set('x-visual-layout','responsive-v9');headers.set('x-svg-safe-area','70px');
    return new Response(h,{status:res.status,headers});
  },
  async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}
};
