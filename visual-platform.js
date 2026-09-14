import app from './platform.js';
import {couponSvg,featuredSvg,noonUrl} from './svg-engine.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const countryAr=c=>c==='SA'?'السعودية':'الإمارات';
const countryEn=c=>c==='SA'?'Saudi Arabia':'UAE';
const validCountry=c=>c==='AE'?'AE':'SA';
const validCoupon=c=>/^NOV\d{3}$/i.test(String(c||''))?String(c).toUpperCase():'NOV170';

async function getState(env,ctx,origin){
  const r=await app.fetch(new Request(origin+'/api/state',{headers:{accept:'application/json'}}),env,ctx);
  if(!r.ok)return {articles:[]};
  try{return await r.json()}catch{return {articles:[]}}
}

function fallbackRec(html,slug){
  const h1=(String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||slug;
  const title=strip(h1)||slug;
  const coupon=(String(html).match(/\bNOV\d{3}\b/i)||[])[0]||'NOV170';
  const hay=(slug+' '+title+' '+html.slice(0,1800));
  const country=/الإمارات|الامارات|UAE/i.test(hay)?'AE':'SA';
  return {slug,title,coupon:validCoupon(coupon),country,status:'published',metaDescription:''};
}

function params(rec,includeTitle=false){
  const q=new URLSearchParams({coupon:validCoupon(rec.coupon),country:validCountry(rec.country)});
  if(includeTitle)q.set('title',String(rec.title||'Noon Coupon Guide').slice(0,180));
  return q.toString();
}
function couponSrc(rec,v){return `/assets/coupon-svg/${encodeURIComponent(rec.slug)}/${v}.svg?${params(rec)}`}
function featuredSrc(rec){return `/assets/featured/${encodeURIComponent(rec.slug)}.svg?${params(rec,true)}`}

function couponVisual(rec,v){
  const country=countryAr(rec.country),brand=noonUrl(),src=couponSrc(rec,v),code=validCoupon(rec.coupon);
  return `<figure class="coupon-visual coupon-visual-${v}"><a class="coupon-image-link" href="${brand}" target="_blank" rel="noopener external sponsored"><img src="${src}" alt="تصميم كوبون نون ${country} ${code} بنسبة 10% OFF - التصميم ${v}" title="كوبون نون ${country} ${code}" width="1200" height="760" loading="${v===1?'eager':'lazy'}" decoding="async"></a><div class="coupon-live-actions"><button type="button" class="coupon-copy-btn" data-copy-code="${code}">⧉ Copy it</button><a class="coupon-try-btn" href="${brand}" target="_blank" rel="noopener external sponsored">↗ Try it</a></div><figcaption>كوبون ${code} · نون ${country} · تحقق من الأهلية والقيمة النهائية داخل سلة نون.</figcaption></figure>`;
}
function featuredBlock(rec){
  const country=countryAr(rec.country),code=validCoupon(rec.coupon),src=featuredSrc(rec);
  return `<figure class="article-featured"><a href="${noonUrl()}" target="_blank" rel="noopener external sponsored"><img src="${src}" alt="صورة بارزة لمقال ${esc(rec.title)} - كوبون نون ${country} ${code}" title="${esc(rec.title)}" width="1600" height="900" loading="eager" fetchpriority="high" decoding="async"></a><figcaption>${esc(rec.title)} · ${code} · نون ${country}</figcaption></figure>`;
}

function injectFive(h,rec){
  if((h.match(/class="coupon-visual/g)||[]).length>=5)return h;
  const total=(h.match(/<\/p>/gi)||[]).length;
  if(total<5)return couponVisual(rec,1)+h+[2,3,4,5].map(v=>couponVisual(rec,v)).join('');
  const pos=[.15,.33,.51,.69,.87].map(p=>Math.max(1,Math.min(total,Math.round(total*p))));
  const targets=[];for(const n of pos){let x=n;while(targets.includes(x)&&x<total)x++;while(targets.includes(x)&&x>1)x--;targets.push(x)}
  const parts=h.split(/(<\/p>)/i);let n=0,vi=0,out='';
  for(const part of parts){out+=part;if(/^<\/p>$/i.test(part)){n++;while(vi<5&&targets[vi]===n){out+=couponVisual(rec,vi+1);vi++;}}}
  while(vi<5){out+=couponVisual(rec,vi+1);vi++;}return out;
}

function css(){return `<style id="visual-v3">.article-featured{margin:0 0 34px;background:#fff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 18px 46px rgba(15,23,42,.09)}.article-featured img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.article-featured figcaption,.coupon-visual figcaption{padding:10px 18px 16px;color:#667085;text-align:center;font-size:13px}.coupon-visual{margin:38px auto;background:#fff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;box-shadow:0 15px 38px rgba(15,23,42,.08)}.coupon-visual img{display:block;width:100%;height:auto;aspect-ratio:1200/760;object-fit:cover}.coupon-live-actions{display:flex;gap:12px;justify-content:center;padding:16px 18px 8px}.coupon-copy-btn,.coupon-try-btn{min-width:155px;border:0;border-radius:14px;padding:13px 18px;font:800 16px/1 Arial,sans-serif;text-align:center;text-decoration:none;cursor:pointer}.coupon-copy-btn{background:#111;color:#fff}.coupon-try-btn{background:#FEEE00;color:#111}.coupon-copy-btn.copied{background:#087A3E}.a{font-size:18px;line-height:2}.a p{margin-bottom:20px}.a h2{margin-top:38px;line-height:1.55}.a h3{margin-top:26px}.blog-shell{font-family:Tahoma,Arial,sans-serif;background:#f8fafc;color:#111827;min-height:100vh}.blog-head{background:#111827;color:#fff;padding:26px 0}.blog-wrap{width:min(1180px,92%);margin:auto}.blog-nav{display:flex;gap:18px;flex-wrap:wrap}.blog-nav a{color:#fff;text-decoration:none;font-weight:700}.blog-hero{padding:42px 0 26px}.blog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding-bottom:55px}.blog-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.06)}.blog-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.blog-card-body{padding:18px}.blog-card h2{font-size:20px;line-height:1.65;margin:10px 0}.blog-card h2 a{color:#111827;text-decoration:none}.blog-card p{color:#667085;line-height:1.8}.tag{display:inline-block;padding:5px 10px;border-radius:999px;background:#fff8bf;font-weight:800;font-size:12px}.meta{font-size:12px;color:#667085;margin-top:12px}.read{display:inline-block;margin-top:12px;color:#5b21b6;font-weight:800;text-decoration:none}@media(max-width:900px){.blog-grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.blog-grid{grid-template-columns:1fr}.coupon-live-actions{gap:8px}.coupon-copy-btn,.coupon-try-btn{min-width:0;flex:1;padding:12px 8px;font-size:14px}.a{font-size:16px}}</style>`}
function js(){return `<script>document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-code]');if(!b)return;const code=b.dataset.copyCode||'';try{await navigator.clipboard.writeText(code);const old=b.textContent;b.classList.add('copied');b.textContent='✓ Copied '+code;setTimeout(()=>{b.textContent=old;b.classList.remove('copied')},1600)}catch{b.textContent=code}});</script>`}

function imageSchema(rec,origin){
  const featured=origin+featuredSrc(rec);const graph=[{'@type':'ImageObject','@id':featured+'#image',contentUrl:featured,url:featured,caption:rec.title,representativeOfPage:true,width:1600,height:900,inLanguage:'ar'},...Array.from({length:5},(_,i)=>{const u=origin+couponSrc(rec,i+1);return {'@type':'ImageObject','@id':u+'#image',contentUrl:u,url:u,caption:`Noon ${countryEn(rec.country)} coupon ${validCoupon(rec.coupon)} visual ${i+1}`,representativeOfPage:false,width:1200,height:760,inLanguage:'en'}})];
  return `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>`;
}

async function assetResponse(req,env,ctx){
  const u=new URL(req.url),s=await getState(env,ctx,u.origin);let m=u.pathname.match(/^\/assets\/coupon-svg\/([^/]+)\/([1-5])\.svg$/);
  if(m){const slug=decodeURIComponent(m[1]),v=Number(m[2]);let rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');if(!rec)rec={slug,coupon:validCoupon(u.searchParams.get('coupon')),country:validCountry(u.searchParams.get('country')),title:u.searchParams.get('title')||slug,status:'published'};return new Response(couponSvg({coupon:rec.coupon,country:rec.country,variant:v,brand:'noon'}),{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}})}
  m=u.pathname.match(/^\/assets\/featured\/([^/]+)\.svg$/);if(m){const slug=decodeURIComponent(m[1]);let rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');if(!rec)rec={slug,coupon:validCoupon(u.searchParams.get('coupon')),country:validCountry(u.searchParams.get('country')),title:u.searchParams.get('title')||slug,status:'published'};return new Response(featuredSvg({title:rec.title,coupon:rec.coupon,country:rec.country,brand:'noon'}),{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}})}return null;
}

async function blogPage(env,ctx,origin){
  const s=await getState(env,ctx,origin),articles=(s.articles||[]).filter(a=>a.status==='published');
  const cards=articles.map(a=>{const slug=encodeURIComponent(a.slug);return `<article class="blog-card"><a href="/articles/${slug}"><img src="${featuredSrc(a)}" alt="${esc(a.title)}" width="1600" height="900" loading="lazy" decoding="async"></a><div class="blog-card-body"><span class="tag">${countryAr(a.country)}</span><h2><a href="/articles/${slug}">${esc(a.title)}</a></h2><p>${esc((a.metaDescription||'').slice(0,180))}</p><div class="meta">${esc(a.coupon||'')} · Quality ${esc(a.quality||'—')}</div><a class="read" href="/articles/${slug}">اقرأ المقال ←</a></div></article>`}).join('');
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مدونة كوبونات نون | السعودية والإمارات</title><meta name="description" content="مقالات وأدلة كوبونات نون السعودية والإمارات بصور بارزة وأدلة شراء عملية."><link rel="canonical" href="${origin}/blog">${css()}</head><body class="blog-shell"><header class="blog-head"><div class="blog-wrap"><nav class="blog-nav"><a href="/">الرئيسية</a><a href="/coupons">الكوبونات</a><a href="/saudi-arabia">السعودية</a><a href="/uae">الإمارات</a><a href="/categories">التصنيفات</a></nav></div></header><main class="blog-wrap"><section class="blog-hero"><h1>مدونة كوبونات نون</h1><p>${articles.length} مقال منشور بصور بارزة وتصميمات كوبون موزعة داخل المحتوى.</p></section><section class="blog-grid">${cards}</section></main></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}});
}

function enhance(h,rec,origin){
  if(!h.includes('class="article-featured"'))h=h.includes('<main class="a">')?h.replace('<main class="a">','<main class="a">'+featuredBlock(rec)):h.replace('<body>','<body>'+featuredBlock(rec));
  h=injectFive(h,rec);const featured=origin+featuredSrc(rec);const social=`<meta property="og:type" content="article"><meta property="og:image" content="${featured}"><meta property="og:image:width" content="1600"><meta property="og:image:height" content="900"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${featured}"><link rel="preload" as="image" href="${featured}" type="image/svg+xml">`;h=h.replace('</head>',social+css()+imageSchema(rec,origin)+'</head>');h=h.replace('</body>',js()+'</body>');return h;
}

export default{async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname.startsWith('/assets/coupon-svg/')||u.pathname.startsWith('/assets/featured/')){const r=await assetResponse(req,env,ctx);if(r)return r}if(u.pathname==='/blog'||u.pathname==='/blog/')return blogPage(env,ctx,u.origin);const res=await app.fetch(req,env,ctx);if(!u.pathname.startsWith('/articles/')||res.status!==200||!(res.headers.get('content-type')||'').includes('text/html'))return res;let h=await res.text();const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()),s=await getState(env,ctx,u.origin);let rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');if(!rec)rec=fallbackRec(h,slug);h=enhance(h,rec,u.origin);const headers=new Headers(res.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','public,max-age=0,s-maxage=300');return new Response(h,{status:res.status,headers})},async scheduled(e,env,ctx){if(app.scheduled)return app.scheduled(e,env,ctx)}};
