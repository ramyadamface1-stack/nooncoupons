import app from './premium-entry.js';
export {ControlPlane,GeneratorControl} from './premium-entry.js';

const NOON_MARKETS={
  'ar-AE':'https://www.noon.com/uae-ar/',
  'ar-SA':'https://www.noon.com/saudi-ar/'
};

function cleanPublicQa(html,path){
  let out=String(html||'');
  if(path.startsWith('/articles/'))out=out.replace(/<div class="quality-meta">[\s\S]*?<\/div>/gi,'');
  if(path==='/blog')out=out.replace(/<div class="meta">\s*Quality\s+[\s\S]*?<\/div>/gi,'');
  return out;
}

function noonMarketUrl(contentLanguage=''){
  return NOON_MARKETS[String(contentLanguage||'').trim()]||NOON_MARKETS['ar-SA'];
}

function routeArticleNoonLinks(html,noonUrl){
  return String(html||'').replace(/https:\/\/www\.noon\.com\/(?!saudi-ar\/|uae-ar\/)/gi,noonUrl);
}

function mobileCouponBar(html,noonUrl){
  if(html.includes('id="mobile-coupon-bar"'))return html;
  const patterns=[
    /data-copy-code="([A-Z0-9_-]{3,20})"/i,
    /data-copy="(OPS\d{2})"/i,
    /\b(OPS\d{2})\b/i
  ];
  let code='';
  for(const re of patterns){const m=html.match(re);if(m?.[1]){code=m[1].toUpperCase();break}}
  if(!/^OPS\d{2}$/.test(code))return html;
  const bar=`<aside id="mobile-coupon-bar" aria-label="إجراء سريع لكوبون نون"><div class="mcb-copy"><small>كود نون للتجربة</small><strong>${code}</strong></div><button type="button" data-sticky-copy="${code}">نسخ الكود</button><a href="${noonUrl}" rel="noopener external sponsored">فتح نون</a><span class="mcb-status" aria-live="polite"></span></aside><style id="mobile-coupon-bar-style">#mobile-coupon-bar{display:none}@media(max-width:760px){body{padding-bottom:82px!important}#mobile-coupon-bar{position:fixed;z-index:9999;left:8px;right:8px;bottom:8px;display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 11px;background:rgba(17,24,39,.97);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 12px 34px rgba(0,0,0,.28);backdrop-filter:blur(10px)}#mobile-coupon-bar .mcb-copy{min-width:0;display:grid;line-height:1.15}#mobile-coupon-bar small{color:#d1d5db;font-size:11px}#mobile-coupon-bar strong{font-size:17px;letter-spacing:.6px}#mobile-coupon-bar button,#mobile-coupon-bar a{border:0;border-radius:12px;padding:11px 12px;font:inherit;font-weight:900;white-space:nowrap;text-decoration:none;cursor:pointer}#mobile-coupon-bar button{background:#facc15;color:#111827}#mobile-coupon-bar a{background:#fff;color:#111827}.mcb-status{position:absolute;right:12px;bottom:100%;margin-bottom:7px;background:#111827;color:#fff;border-radius:9px;padding:5px 8px;font-size:12px;opacity:0;pointer-events:none;transition:opacity .15s}.mcb-status.show{opacity:1}}@media(max-width:390px){#mobile-coupon-bar{grid-template-columns:1fr auto}#mobile-coupon-bar a{display:none}}</style><script id="mobile-coupon-bar-script">(()=>{const bar=document.getElementById('mobile-coupon-bar');if(!bar)return;const b=bar.querySelector('[data-sticky-copy]'),s=bar.querySelector('.mcb-status');b?.addEventListener('click',async()=>{const c=b.dataset.stickyCopy||'';let ok=false;try{await navigator.clipboard.writeText(c);ok=true}catch{try{const t=document.createElement('textarea');t.value=c;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();ok=document.execCommand('copy');t.remove()}catch{}}s.textContent=ok?'تم نسخ الكود':'الكود: '+c;s.classList.add('show');setTimeout(()=>s.classList.remove('show'),1800)})})()</script>`;
  return /<\/body>/i.test(html)?html.replace(/<\/body>/i,bar+'</body>'):html+bar;
}

async function publicView(req,res){
  const u=new URL(req.url),path=u.pathname.replace(/\/+$/,'')||'/';
  if(req.method!=='GET'||!(path.startsWith('/articles/')||path==='/blog'))return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!res.ok||!type.includes('text/html'))return res;
  let html=cleanPublicQa(await res.text(),path);
  const h=new Headers(res.headers);
  if(path.startsWith('/articles/')){
    const noonUrl=noonMarketUrl(h.get('content-language'));
    html=routeArticleNoonLinks(html,noonUrl);
    html=mobileCouponBar(html,noonUrl);
    h.set('x-mobile-coupon-cta','v1');
    h.set('x-noon-market-route',noonUrl.includes('/uae-ar/')?'AE':'SA');
  }
  h.delete('content-length');
  h.set('x-public-quality-ui','hidden-v1');
  return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){return publicView(req,await app.fetch(req,env,ctx))},
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const PUBLIC_ENTRY_INFO={version:4,internalQualityVisible:false,adminQualityPreserved:true,mobileCouponCta:true,marketAwareNoonLinks:true};
