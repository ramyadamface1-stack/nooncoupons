import app from './platform.js';
import {couponSvg,featuredSvg,noonUrl} from './svg-engine.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const countryAr=c=>c==='SA'?'السعودية':'الإمارات';
const countryEn=c=>c==='SA'?'Saudi Arabia':'UAE';

async function getState(env,ctx,origin){
  const r=await app.fetch(new Request(origin+'/api/state',{headers:{accept:'application/json'}}),env,ctx);
  if(!r.ok)return {articles:[]};
  try{return await r.json()}catch{return {articles:[]}}
}

function couponVisual(rec,variant){
  const slug=encodeURIComponent(rec.slug),country=countryAr(rec.country),brand=noonUrl();
  const src=`/assets/coupon-svg/${slug}/${variant}.svg`;
  const alt=`كوبون نون ${country} ${rec.coupon} - تصميم ${variant} بنسبة 10% OFF للمستخدمين الجدد والحاليين`;
  return `<figure class="coupon-visual coupon-visual-${variant}" data-coupon="${esc(rec.coupon)}">
    <a class="coupon-image-link" href="${brand}" target="_blank" rel="noopener external sponsored" aria-label="فتح موقع نون الرسمي وتجربة الكوبون ${esc(rec.coupon)}">
      <img src="${src}" alt="${esc(alt)}" title="كوبون نون ${country} ${esc(rec.coupon)} - 10% OFF" width="1200" height="760" loading="${variant===1?'eager':'lazy'}" decoding="async">
    </a>
    <div class="coupon-live-actions" role="group" aria-label="إجراءات كوبون ${esc(rec.coupon)}">
      <button type="button" class="coupon-copy-btn" data-copy-code="${esc(rec.coupon)}">⧉ Copy it</button>
      <a class="coupon-try-btn" href="${brand}" target="_blank" rel="noopener external sponsored">↗ Try it</a>
    </div>
    <figcaption>كوبون ${esc(rec.coupon)} · نون ${country} · تحقق من القيمة والأهلية داخل سلة نون قبل الدفع.</figcaption>
  </figure>`;
}

function featuredBlock(rec){
  const slug=encodeURIComponent(rec.slug),country=countryAr(rec.country),brand=noonUrl();
  const src=`/assets/featured/${slug}.svg`;
  return `<figure class="article-featured">
    <a href="${brand}" target="_blank" rel="noopener external sponsored" aria-label="فتح موقع نون الرسمي">
      <img src="${src}" alt="صورة بارزة لمقال ${esc(rec.title)} - كوبون نون ${country} ${esc(rec.coupon)}" title="${esc(rec.title)}" width="1600" height="900" loading="eager" fetchpriority="high" decoding="async">
    </a>
    <figcaption>${esc(rec.title)} · ${esc(rec.coupon)} · نون ${country}</figcaption>
  </figure>`;
}

function injectFive(html,rec){
  if((html.match(/class="coupon-visual/g)||[]).length>=5)return html;
  const total=(html.match(/<\/p>/gi)||[]).length;
  if(total<5)return featuredBlock(rec)+couponVisual(rec,1)+html+[2,3,4,5].map(v=>couponVisual(rec,v)).join('');
  const positions=[.15,.33,.51,.69,.87].map(p=>Math.max(1,Math.min(total,Math.round(total*p))));
  const targets=[];for(const n of positions){let x=n;while(targets.includes(x)&&x<total)x++;while(targets.includes(x)&&x>1)x--;targets.push(x)}
  const parts=html.split(/(<\/p>)/i);let n=0,vi=0,out='';
  for(const part of parts){out+=part;if(/^<\/p>$/i.test(part)){n++;while(vi<5&&targets[vi]===n){out+=couponVisual(rec,vi+1);vi++;}}}
  while(vi<5){out+=couponVisual(rec,vi+1);vi++;}
  return out;
}

function css(){return `<style id="visual-v2">
.article-featured{margin:0 0 34px;background:#fff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 18px 46px rgba(15,23,42,.09)}.article-featured a{display:block}.article-featured img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.article-featured figcaption{padding:11px 18px 15px;color:#667085;text-align:center;font-size:13px}
.coupon-visual{margin:38px auto;background:#fff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;box-shadow:0 15px 38px rgba(15,23,42,.08)}.coupon-image-link{display:block}.coupon-visual img{display:block;width:100%;height:auto;aspect-ratio:1200/760;object-fit:cover}.coupon-live-actions{display:flex;gap:12px;justify-content:center;padding:16px 18px 8px}.coupon-copy-btn,.coupon-try-btn{min-width:155px;border:0;border-radius:14px;padding:13px 18px;font:800 16px/1 Arial,sans-serif;text-align:center;text-decoration:none;cursor:pointer}.coupon-copy-btn{background:#111;color:#fff}.coupon-try-btn{background:#FEEE00;color:#111}.coupon-copy-btn.copied{background:#087A3E}.coupon-visual figcaption{padding:7px 18px 18px;color:#667085;font-size:13px;text-align:center;line-height:1.6}.coupon-visual-2{border-color:#222}.coupon-visual-3{box-shadow:0 16px 42px rgba(59,130,246,.12)}.coupon-visual-4{box-shadow:0 16px 42px rgba(244,114,182,.11)}.coupon-visual-5{box-shadow:0 16px 42px rgba(16,185,129,.10)}
.article-featured+article h1{margin-top:18px}.a{font-size:18px}.a p{margin:0 0 20px}.a h2{margin-top:38px;line-height:1.55}.a h3{margin-top:26px}.a table{width:100%;border-collapse:collapse;display:block;overflow:auto}.a th,.a td{padding:10px;border:1px solid #e5e7eb}.a blockquote{border-right:4px solid #FEEE00;background:#fffcdf;padding:14px 18px;margin:26px 0}
.blog-shell{font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827;min-height:100vh}.blog-head{background:#111827;color:#fff;padding:26px 0}.blog-wrap{width:min(1180px,92%);margin:auto}.blog-nav{display:flex;gap:18px;flex-wrap:wrap}.blog-nav a{color:#fff;text-decoration:none;font-weight:700}.blog-hero{padding:42px 0 26px}.blog-hero h1{font-size:40px;margin:0 0 10px}.blog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding-bottom:55px}.blog-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.06)}.blog-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.blog-card-body{padding:18px}.blog-card h2{font-size:20px;line-height:1.65;margin:10px 0}.blog-card h2 a{color:#111827;text-decoration:none}.blog-card p{color:#667085;line-height:1.8}.tag{display:inline-block;padding:5px 10px;border-radius:999px;background:#fff8bf;font-weight:800;font-size:12px}.meta{font-size:12px;color:#667085;margin-top:12px}.read{display:inline-block;margin-top:12px;color:#5b21b6;font-weight:800;text-decoration:none}
@media(max-width:900px){.blog-grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.blog-grid{grid-template-columns:1fr}.blog-hero h1{font-size:31px}.coupon-visual{margin:28px 0;border-radius:16px}.coupon-live-actions{gap:8px}.coupon-copy-btn,.coupon-try-btn{min-width:0;flex:1;padding:12px 8px;font-size:14px}.article-featured{border-radius:16px}.a{font-size:16px}}
</style>`}

function js(){return `<script id="visual-actions">document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-code]');if(!b)return;const code=b.dataset.copyCode||'';try{await navigator.clipboard.writeText(code);b.classList.add('copied');const old=b.textContent;b.textContent='✓ Copied '+code;setTimeout(()=>{b.textContent=old;b.classList.remove('copied')},1600)}catch{b.textContent=code}});</script>`}

function imageSchema(rec,origin){
  const featured=`${origin}/assets/featured/${encodeURIComponent(rec.slug)}.svg`;
  const graph=[{'@type':'ImageObject','@id':featured+'#image',contentUrl:featured,url:featured,caption:rec.title,representativeOfPage:true,width:1600,height:900,inLanguage:'ar'},...Array.from({length:5},(_,i)=>{const u=`${origin}/assets/coupon-svg/${encodeURIComponent(rec.slug)}/${i+1}.svg`;return {'@type':'ImageObject','@id':u+'#image',contentUrl:u,url:u,caption:`Noon ${countryEn(rec.country)} coupon ${rec.coupon} - visual ${i+1}`,representativeOfPage:false,width:1200,height:760,inLanguage:'en'}})];
  return `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>`;
}

async function assetResponse(req,env,ctx){
  const u=new URL(req.url);let m=u.pathname.match(/^\/assets\/coupon-svg\/([^/]+)\/([1-5])\.svg$/);
  const s=await getState(env,ctx,u.origin);
  if(m){const slug=decodeURIComponent(m[1]),variant=Number(m[2]),rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');if(!rec)return new Response('Not found',{status:404});return new Response(couponSvg({coupon:rec.coupon||'NOON10',country:rec.country||'SA',variant,brand:'noon'}),{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}})}
  m=u.pathname.match(/^\/assets\/featured\/([^/]+)\.svg$/);
  if(m){const slug=decodeURIComponent(m[1]),rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');if(!rec)return new Response('Not found',{status:404});return new Response(featuredSvg({title:rec.title,coupon:rec.coupon||'NOON10',country:rec.country||'SA',brand:'noon'}),{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}})}
  return null;
}

async function blogPage(env,ctx,origin){
  const s=await getState(env,ctx,origin),articles=(s.articles||[]).filter(a=>a.status==='published');
  const cards=articles.map(a=>{const slug=encodeURIComponent(a.slug),country=countryAr(a.country);return `<article class="blog-card"><a href="/articles/${slug}"><img src="/assets/featured/${slug}.svg" alt="${esc(a.title)}" width="1600" height="900" loading="lazy" decoding="async"></a><div class="blog-card-body"><span class="tag">${country}</span><h2><a href="/articles/${slug}">${esc(a.title)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><div class="meta">${esc(a.coupon||'')} · Quality ${esc(a.quality||'—')}</div><a class="read" href="/articles/${slug}">اقرأ المقال ←</a></div></article>`}).join('');
  const h=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مدونة كوبونات نون | السعودية والإمارات</title><meta name="description" content="أدلة ومقالات كوبونات نون السعودية والإمارات مع صور بارزة، مقارنة أكواد، حل مشاكل القسائم وأدلة شراء عملية."><link rel="canonical" href="${origin}/blog">${css()}</head><body class="blog-shell"><header class="blog-head"><div class="blog-wrap"><nav class="blog-nav"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/saudi-arabia">السعودية</a><a href="/uae">الإمارات</a><a href="/categories">التصنيفات</a></nav></div></header><main class="blog-wrap"><section class="blog-hero"><h1>مدونة كوبونات نون</h1><p>أدلة عملية للسعودية والإمارات — ${articles.length} مقال منشور.</p></section><section class="blog-grid">${cards}</section></main></body></html>`;
  return new Response(h,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}});
}

function addFeaturedToHtml(h,rec,origin){
  const hero=featuredBlock(rec);
  if(!h.includes('class="article-featured"')){
    if(h.includes('<main class="a">'))h=h.replace('<main class="a">','<main class="a">'+hero);
    else if(h.includes('<body>'))h=h.replace('<body>','<body>'+hero);
    else h=hero+h;
  }
  h=injectFive(h,rec);
  const featured=`${origin}/assets/featured/${encodeURIComponent(rec.slug)}.svg`;
  const social=`<meta property="og:type" content="article"><meta property="og:image" content="${featured}"><meta property="og:image:type" content="image/svg+xml"><meta property="og:image:width" content="1600"><meta property="og:image:height" content="900"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${featured}"><link rel="preload" as="image" href="${featured}" type="image/svg+xml">`;
  h=h.replace('</head>',social+css()+imageSchema(rec,origin)+'</head>');
  h=h.replace('</body>',js()+'</body>');
  return h;
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname.startsWith('/assets/coupon-svg/')||u.pathname.startsWith('/assets/featured/')){const r=await assetResponse(req,env,ctx);if(r)return r;}
    if(u.pathname==='/blog'||u.pathname==='/blog/')return blogPage(env,ctx,u.origin);
    const res=await app.fetch(req,env,ctx);
    if(!u.pathname.startsWith('/articles/')||res.status!==200||(res.headers.get('content-type')||'').includes('text/html')===false)return res;
    const s=await getState(env,ctx,u.origin),slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()),rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');if(!rec)return res;
    const h=addFeaturedToHtml(await res.text(),rec,u.origin);const headers=new Headers(res.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','public,max-age=0,s-maxage=300');return new Response(h,{status:res.status,headers});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
