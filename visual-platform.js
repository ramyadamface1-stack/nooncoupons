import app from './platform.js';
import {couponSvg,noonUrl} from './svg-engine.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const label=c=>c==='SA'?'السعودية':'الإمارات';

async function getState(env,ctx,origin){
  const r=await app.fetch(new Request(origin+'/api/state',{headers:{accept:'application/json'}}),env,ctx);
  if(!r.ok)return {articles:[]};
  try{return await r.json()}catch{return {articles:[]}}
}

function visualBlock(rec,variant){
  const slug=encodeURIComponent(rec.slug);
  const src=`/assets/coupon-svg/${slug}/${variant}.svg`;
  const brand=noonUrl();
  const country=label(rec.country);
  const alt=`تصميم كوبون نون ${country} ${rec.coupon} بنسبة 10% OFF للمستخدمين الجدد والحاليين - التصميم ${variant}`;
  return `<figure class="coupon-visual coupon-visual-${variant}" data-coupon="${esc(rec.coupon)}">
    <a class="coupon-image-link" href="${brand}" target="_blank" rel="noopener external" aria-label="فتح موقع Noon الرسمي">
      <img src="${src}" alt="${esc(alt)}" title="كوبون نون ${country} ${esc(rec.coupon)} - 10% OFF" width="1200" height="760" loading="${variant===1?'eager':'lazy'}" decoding="async">
    </a>
    <div class="coupon-live-actions" role="group" aria-label="إجراءات كوبون ${esc(rec.coupon)}">
      <button type="button" class="coupon-copy-btn" data-copy-code="${esc(rec.coupon)}"><span aria-hidden="true">⧉</span> Copy it</button>
      <a class="coupon-try-btn" href="${brand}" target="_blank" rel="noopener external"><span aria-hidden="true">↗</span> Try it</a>
    </div>
    <figcaption>كوبون ${esc(rec.coupon)} · نون ${country} · تحقق من الأهلية والقيمة النهائية داخل سلة Noon قبل الدفع.</figcaption>
  </figure>`;
}

function injectByParagraphs(html,rec){
  const total=(html.match(/<\/p>/gi)||[]).length;
  if(!total)return visualBlock(rec,1)+html+Array.from({length:4},(_,i)=>visualBlock(rec,i+2)).join('');
  const raw=[.12,.31,.50,.70,.88].map(p=>Math.max(1,Math.min(total,Math.round(total*p))));
  const targets=[];for(const n of raw){let x=n;while(targets.includes(x)&&x<total)x++;while(targets.includes(x)&&x>1)x--;targets.push(x)}
  const parts=html.split(/(<\/p>)/i);let n=0,vi=0,out='';
  for(const part of parts){out+=part;if(/^<\/p>$/i.test(part)){n++;while(vi<5&&targets[vi]===n){out+=visualBlock(rec,vi+1);vi++;}}}
  while(vi<5){out+=visualBlock(rec,vi+1);vi++;}
  return out;
}

function styles(){return `<style id="coupon-visual-styles">
.coupon-visual{margin:36px auto;max-width:100%;padding:0;background:#fff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;box-shadow:0 14px 38px rgba(15,23,42,.08)}
.coupon-image-link{display:block;background:#fff}.coupon-visual img{display:block;width:100%;height:auto;aspect-ratio:1200/760;object-fit:cover}.coupon-live-actions{display:flex;gap:12px;justify-content:center;align-items:center;padding:16px 18px 8px}.coupon-copy-btn,.coupon-try-btn{min-width:150px;border:0;border-radius:14px;padding:12px 18px;font:800 16px/1.2 Arial,sans-serif;cursor:pointer;text-decoration:none;text-align:center;transition:transform .15s ease,box-shadow .15s ease}.coupon-copy-btn{background:#111;color:#fff}.coupon-try-btn{background:#FEEE00;color:#111}.coupon-copy-btn:hover,.coupon-try-btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(0,0,0,.12)}.coupon-copy-btn.copied{background:#087A3E}.coupon-visual figcaption{padding:6px 18px 18px;text-align:center;color:#667085;font-size:13px;line-height:1.7}.coupon-visual-2{border-color:#222}.coupon-visual-3{box-shadow:0 16px 42px rgba(59,130,246,.11)}.coupon-visual-4{box-shadow:0 16px 42px rgba(244,114,182,.10)}.coupon-visual-5{box-shadow:0 16px 42px rgba(16,185,129,.09)}
@media(max-width:640px){.coupon-visual{margin:26px -2px;border-radius:16px}.coupon-live-actions{gap:8px}.coupon-copy-btn,.coupon-try-btn{min-width:0;flex:1;padding:11px 10px;font-size:14px}.coupon-visual figcaption{font-size:12px}}
</style>`}

function behavior(){return `<script id="coupon-visual-behavior">document.addEventListener('click',async function(e){const b=e.target.closest('[data-copy-code]');if(!b)return;const code=b.getAttribute('data-copy-code')||'';try{await navigator.clipboard.writeText(code);const old=b.innerHTML;b.classList.add('copied');b.textContent='Copied: '+code;setTimeout(()=>{b.innerHTML=old;b.classList.remove('copied')},1800)}catch{b.textContent=code}});</script>`}

function imageSchema(rec,origin){
  const graph=Array.from({length:5},(_,i)=>({
    '@type':'ImageObject',
    '@id':`${origin}/assets/coupon-svg/${encodeURIComponent(rec.slug)}/${i+1}.svg#image`,
    contentUrl:`${origin}/assets/coupon-svg/${encodeURIComponent(rec.slug)}/${i+1}.svg`,
    url:`${origin}/assets/coupon-svg/${encodeURIComponent(rec.slug)}/${i+1}.svg`,
    caption:`Noon ${rec.country==='SA'?'Saudi Arabia':'UAE'} coupon ${rec.coupon} - 10% OFF design ${i+1}`,
    representativeOfPage:i===0,
    inLanguage:'en',
    width:1200,
    height:760
  }));
  return `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>`;
}

async function svgResponse(req,env,ctx){
  const u=new URL(req.url);const m=u.pathname.match(/^\/assets\/coupon-svg\/([^/]+)\/([1-5])\.svg$/);if(!m)return null;
  const slug=decodeURIComponent(m[1]),variant=Number(m[2]);const s=await getState(env,ctx,u.origin);const rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');
  if(!rec)return new Response('Not found',{status:404});
  const svg=couponSvg({coupon:rec.coupon||'NOON10',country:rec.country||'SA',variant,brand:'noon'});
  return new Response(svg,{headers:{'content-type':'image/svg+xml; charset=utf-8','cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
}

export default{
  async fetch(req,env,ctx){
    const u=new URL(req.url);
    if(u.pathname.startsWith('/assets/coupon-svg/')){const r=await svgResponse(req,env,ctx);if(r)return r;}
    const res=await app.fetch(req,env,ctx);
    if(!u.pathname.startsWith('/articles/')||res.status!==200||(res.headers.get('content-type')||'').indexOf('text/html')<0)return res;
    const s=await getState(env,ctx,u.origin);const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop());const rec=(s.articles||[]).find(a=>a.slug===slug&&a.status==='published');if(!rec)return res;
    let h=await res.text();h=injectByParagraphs(h,rec);h=h.replace('</head>',styles()+imageSchema(rec,u.origin)+'</head>');h=h.replace('</body>',behavior()+'</body>');
    const headers=new Headers(res.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','public, max-age=0, s-maxage=300');return new Response(h,{status:res.status,headers});
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
