import app from './premium-entry.js';
import {isApprovedCoupon,normalizeApprovedCoupon} from './approved-coupons.js';
export {ControlPlane,GeneratorControl} from './premium-entry.js';

const GOOGLE_SITE_VERIFICATION='LmU-uUjdxfArIxwpCxeSn7eKDIcUrc3zU2CqS8zmxrQ';
const GA4_MEASUREMENT_ID='G-1551Z7DJ2C';
const NOON_MARKETS={
  'ar-AE':'https://www.noon.com/uae-ar/',
  'ar-SA':'https://www.noon.com/saudi-ar/'
};
let articleManifestCache={at:0,value:null};

function cleanPublicQa(html,path){
  let out=String(html||'');
  if(path.startsWith('/articles/'))out=out.replace(/<div class="quality-meta">[\s\S]*?<\/div>/gi,'');
  if(path==='/blog')out=out.replace(/<div class="meta">\s*Quality\s+[\s\S]*?<\/div>/gi,'');
  return out;
}

function injectGoogleVerification(html){
  const text=String(html||'');
  if(/<meta\s+name=["']google-site-verification["']/i.test(text))return text;
  const tag=`<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}">`;
  return /<\/head>/i.test(text)?text.replace(/<\/head>/i,tag+'</head>'):text;
}

function injectGoogleAnalytics(html){
  const text=String(html||'');
  if(text.includes(GA4_MEASUREMENT_ID)||/googletagmanager\.com\/gtag\/js/i.test(text))return text;
  const tag=`<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA4_MEASUREMENT_ID}');document.addEventListener('click',function(e){const el=e.target&&e.target.closest?e.target.closest('button,a,[data-copy-code],[data-copy],[data-sticky-copy]'):null;if(!el||el.matches?.('.copy-code,.shop-link'))return;const code=el.getAttribute('data-copy-code')||el.getAttribute('data-copy')||el.getAttribute('data-sticky-copy')||'';const market=el.getAttribute('data-market')||(location.pathname.startsWith('/uae')?'AE':location.pathname.startsWith('/saudi')?'SA':'');const placement=el.getAttribute('data-shop-placement')||(el.hasAttribute('data-sticky-copy')?'mobile_sticky':'page');if(code){gtag('event','copy_code',{coupon_code:String(code).toUpperCase(),market:market||undefined,page_path:location.pathname,placement})}if(el.tagName==='A'&&/https?:\\/\\/(?:www\\.)?noon\\.com\\//i.test(el.href||'')){gtag('event','shop_click',{destination:'noon',market:market||undefined,page_path:location.pathname,placement})}});</script>`;
  return /<\/head>/i.test(text)?text.replace(/<\/head>/i,tag+'</head>'):text;
}

function marketFromRecord(rec,contentLanguage=''){
  if(rec?.country==='AE')return 'AE';
  if(rec?.country==='SA')return 'SA';
  return String(contentLanguage||'').toLowerCase().includes('ae')?'AE':'SA';
}
function noonUrlForMarket(market){return market==='AE'?NOON_MARKETS['ar-AE']:NOON_MARKETS['ar-SA']}
function routeArticleNoonLinks(html,noonUrl){return String(html||'').replace(/https:\/\/www\.noon\.com\/(?!saudi-ar\/|uae-ar\/)/gi,noonUrl)}

function mobileCouponBar(html,noonUrl,fallbackCode='',market='SA'){
  if(html.includes('id="mobile-coupon-bar"'))return html;
  const patterns=[/data-copy-code="([A-Z0-9_-]{3,20})"/i,/data-copy="(OPS\d{2})"/i,/\b(OPS\d{2})\b/i];
  let code='';
  for(const re of patterns){const m=html.match(re);if(m?.[1]&&isApprovedCoupon(m[1])){code=m[1].toUpperCase();break}}
  code=normalizeApprovedCoupon(code||fallbackCode,market==='AE'?'NOV188':'NOV170');
  const bar=`<aside id="mobile-coupon-bar" aria-label="إجراء سريع لكوبون نون"><div class="mcb-copy"><small>كود نون للتجربة</small><strong>${code}</strong></div><button type="button" data-sticky-copy="${code}" data-market="${market}">نسخ الكود</button><a href="${noonUrl}" rel="noopener external sponsored" data-market="${market}" data-shop-placement="mobile_sticky">فتح نون</a><span class="mcb-status" aria-live="polite"></span></aside><style id="mobile-coupon-bar-style">#mobile-coupon-bar{display:none}@media(max-width:760px){body{padding-bottom:82px!important}#mobile-coupon-bar{position:fixed;z-index:9999;left:8px;right:8px;bottom:8px;display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 11px;background:rgba(17,24,39,.97);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 12px 34px rgba(0,0,0,.28);backdrop-filter:blur(10px)}#mobile-coupon-bar .mcb-copy{min-width:0;display:grid;line-height:1.15}#mobile-coupon-bar small{color:#d1d5db;font-size:11px}#mobile-coupon-bar strong{font-size:17px;letter-spacing:.6px}#mobile-coupon-bar button,#mobile-coupon-bar a{border:0;border-radius:12px;padding:11px 12px;font:inherit;font-weight:900;white-space:nowrap;text-decoration:none;cursor:pointer}#mobile-coupon-bar button{background:#facc15;color:#111827}#mobile-coupon-bar a{background:#fff;color:#111827}.mcb-status{position:absolute;right:12px;bottom:100%;margin-bottom:7px;background:#111827;color:#fff;border-radius:9px;padding:5px 8px;font-size:12px;opacity:0;pointer-events:none;transition:opacity .15s}.mcb-status.show{opacity:1}}@media(max-width:390px){#mobile-coupon-bar{grid-template-columns:1fr auto}#mobile-coupon-bar a{display:none}}</style><script id="mobile-coupon-bar-script">(()=>{const bar=document.getElementById('mobile-coupon-bar');if(!bar)return;const b=bar.querySelector('[data-sticky-copy]'),s=bar.querySelector('.mcb-status');b?.addEventListener('click',async()=>{const c=b.dataset.stickyCopy||'';let ok=false;try{await navigator.clipboard.writeText(c);ok=true}catch{try{const t=document.createElement('textarea');t.value=c;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();ok=document.execCommand('copy');t.remove()}catch{}}s.textContent=ok?'تم نسخ الكود':'الكود: '+c;s.classList.add('show');setTimeout(()=>s.classList.remove('show'),1800)})})()</script>`;
  return /<\/body>/i.test(html)?html.replace(/<\/body>/i,bar+'</body>'):html+bar;
}

async function latestArticleManifest(env){
  const now=Date.now();
  if(articleManifestCache.value&&now-articleManifestCache.at<120000)return articleManifestCache.value;
  try{
    if(!env?.CONTENT_FINAL)return articleManifestCache.value||{articles:[]};
    const obj=await env.CONTENT_FINAL.get('bulk/latest.json');
    const value=obj?await obj.json():{articles:[]};
    articleManifestCache={at:now,value};
    return value;
  }catch{return articleManifestCache.value||{articles:[]}}
}

async function articleRecord(env,path){
  const latest=await latestArticleManifest(env);
  const slug=decodeURIComponent(path.split('/').pop()||'');
  return (latest?.articles||[]).find(a=>a?.slug===slug)||null;
}

async function publicView(req,res,env){
  const u=new URL(req.url),path=u.pathname.replace(/\/+$/,'')||'/';
  if(req.method!=='GET')return res;
  const type=(res.headers.get('content-type')||'').toLowerCase();
  if(!res.ok||!type.includes('text/html'))return res;
  const isPublic=!path.startsWith('/admin')&&!path.startsWith('/api/');
  if(!isPublic)return res;
  let html=injectGoogleAnalytics(injectGoogleVerification(cleanPublicQa(await res.text(),path)));
  const h=new Headers(res.headers);
  if(path.startsWith('/articles/')){
    const rec=await articleRecord(env,path);
    const market=marketFromRecord(rec,h.get('content-language'));
    const noonUrl=noonUrlForMarket(market);
    html=routeArticleNoonLinks(html,noonUrl);
    const fallbackCode=normalizeApprovedCoupon(rec?.code||rec?.couponCode||'',market==='AE'?'NOV188':'NOV170');
    html=mobileCouponBar(html,noonUrl,fallbackCode,market);
    h.set('x-mobile-coupon-cta','v2');
    h.set('x-noon-market-route',market);
    h.set('x-coupon-source',rec?'article-metadata':'header-fallback');
    h.set('x-public-manifest-cache','120s-isolate');
    h.set('x-sticky-analytics-market',market);
  }
  h.delete('content-length');
  h.set('x-public-quality-ui','hidden-v1');
  h.set('x-google-site-verification','html-meta-v1');
  h.set('x-ga4-measurement','G-1551Z7DJ2C');
  h.set('x-ga4-dedupe','network-cta-owned');
  return new Response(html,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){return publicView(req,await app.fetch(req,env,ctx),env)},
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};

export const PUBLIC_ENTRY_INFO={version:11,internalQualityVisible:false,adminQualityPreserved:true,mobileCouponCta:true,marketAwareNoonLinks:true,articleMetadataMarketRouting:true,approvedCouponOnly:true,googleSiteVerification:true,ga4MeasurementId:GA4_MEASUREMENT_ID,conversionEventDedupe:true,stickyAnalyticsMarketAware:true,articleManifestCacheSeconds:120,conversionEvents:['copy_code','shop_click']};
