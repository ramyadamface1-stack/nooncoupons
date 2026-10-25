// Shared article presentation for the existing R2 rescue reader.
// No R2 rewrites, original article URLs, pricing claims or affiliate links.
import {PRIMARY_COUPON_BY_MARKET} from './approved-coupons.js';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const primaryCodeForMarket=country=>PRIMARY_COUPON_BY_MARKET[country==='AE'?'AE':'SA'];
export function presentMarketCouponText(source,country='SA'){
  const code=primaryCodeForMarket(country);
  // Rewrite rendered text, not link destinations, scripts, styles, or archived source bytes.
  // Article headings/paragraphs/FAQ must agree with the prominent code CTA.
  return String(source||'').split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<[^>]+>)/gi).map(part=>{
    if(!part.startsWith('<'))return part.replace(/\b(?:NOV|RAMY|OPS)\d{2,4}\b/gi,code);
    if(/^<(?:img|source)\b/i.test(part)&&/\/assets\/coupon-svg\//i.test(part)){
      // Keep existing product/brand image and src intact, but display the SAME
      // market code on its SVG query and visible accessible alt/title labels.
      return part.replace(/(\b(?:\?|&amp;|&)coupon=)(?:NOV|RAMY|OPS)\d{2,4}/gi,'$1'+code)
        .replace(/((?:alt|title)=["'][^"']*)\b(?:NOV|RAMY|OPS)\d{2,4}\b/gi,'$1'+code);
    }
    if(/^<button\b/i.test(part)&&/data-copy-code/i.test(part)){
      return part.replace(/(data-copy-code=["'])(?:NOV|RAMY|OPS)\d{2,4}(["'])/gi,'$1'+code+'$2');
    }
    return part;
  }).join('');
}
export function renderCouponAction(country='SA',english=false,placement='top'){
  const market=country==='AE'?'AE':'SA',code=primaryCodeForMarket(market);
  const official=market==='AE'?'https://www.noon.com/uae-en/':'https://www.noon.com/saudi-ar/';
  const label=english?'Copy code':'نسخ الكوبون';
  const open=english?'Open Noon checkout':'الانتقال إلى نون وتجربة الكود';
  const note=english?'No guaranteed amount or eligibility. Check the code and final total in your Noon cart.':'الكود للتجربة حسب أهلية الحساب والمنتجات. تأكد من المبلغ النهائي في سلة نون.';
  return '<aside class="rescue-offer rescue-offer--'+escapeHtml(placement)+'" aria-label="'+(english?'Noon coupon':'كوبون خصم نون')+'" data-market="'+market+'">'+
   '<div class="rescue-offer__heading"><span>'+(english?'Noon '+(market==='AE'?'UAE':'Saudi Arabia')+' coupon':'كوبون نون '+(market==='AE'?'الإمارات':'السعودية'))+'</span><strong dir="ltr">'+code+'</strong></div>'+
   '<div class="rescue-offer__buttons"><button type="button" class="rescue-copy" data-rescue-copy="'+code+'" data-copy-code="'+code+'" data-placement="'+escapeHtml(placement)+'" aria-label="'+label+' '+code+'">'+label+' '+code+'</button>'+
   '<a class="rescue-shop" href="'+official+'" target="_blank" rel="noopener noreferrer sponsored">'+open+'</a></div>'+
   '<p class="rescue-offer__note">'+note+'</p><span class="rescue-copy-status" role="status" aria-live="polite"></span></aside>';
}
export function renderRelatedArticles(items,slug,country,english=false){
  const source=Array.isArray(items)?items:[];
  const current=String(slug||''),market=country==='AE'?'AE':'SA';
  const words=s=>String(s||'').toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter(x=>x.length>=4&&!/^(?:noon|نون|السعودية|الإمارات|كوبون|خصم|دليل|شراء|مقارنة)$/.test(x));
  const focus=new Set(words(current)),seen=new Set(),choices=[];
  for(const x of source){
    if(!x?.slug||x.slug===current||seen.has(x.slug)||x.status!=='published'||x.indexable===false||x.slug.startsWith('en-')!==Boolean(english))continue;
    const isAE=x.country==='AE'||x.slug.startsWith('en-')||/الإمارات/.test(x.slug);
    if(isAE!==(market==='AE'))continue;
    seen.add(x.slug);
    const overlap=words(String(x.title||'')+' '+x.slug).filter(w=>focus.has(w)).length;
    choices.push({x,score:overlap});
  }
  choices.sort((a,b)=>b.score-a.score||String(b.x.publishedAt||b.x.createdAt||'').localeCompare(String(a.x.publishedAt||a.x.createdAt||'')));
  const rows=choices.slice(0,4);
  if(!rows.length)return '';
  return '<section class="rescue-similar" aria-label="'+(english?'Related guides':'مقالات مرتبطة')+'"><h2>'+(english?'Related Noon shopping guides':'مقالات نون مرتبطة')+'</h2><ul>'+
    rows.map(({x})=>'<li><a href="'+(english?'/en/articles/':'/articles/')+encodeURI(x.slug)+'">'+escapeHtml(String(x.title||x.slug).replace(/[-_]/g,' '))+'</a></li>').join('')+'</ul></section>';
}
export const rescueArticleStyles=String.raw`
<style id="rescue-article-ux">
main{max-width:980px} .rescue-article{min-width:0;overflow-wrap:anywhere;color:#172334;font-size:1.0625rem;line-height:1.92}
.rescue-article h1{font-size:clamp(1.75rem,4.5vw,2.55rem);line-height:1.4;letter-spacing:-.015em;margin:1rem 0 1.5rem;color:#0f172a}
.rescue-article h2{font-size:clamp(1.3rem,3vw,1.68rem);line-height:1.5;margin:2.3rem 0 .8rem;padding-block-end:.55rem;border-block-end:1px solid #e5e7eb;color:#142237}
.rescue-article h3{font-size:1.17rem;margin:1.7rem 0 .55rem;line-height:1.6;color:#142237}
.rescue-article p{margin:0 0 1.25rem}.rescue-article ul,.rescue-article ol{margin:0 0 1.4rem;padding-inline-start:1.65rem}
.rescue-article li{margin:.45rem 0}.rescue-article blockquote{border-inline-start:4px solid #2563eb;background:#f1f5f9;padding:1rem;margin:1.5rem 0;border-radius:8px}
.rescue-article a:not(.rescue-shop):not(.rescue-copy),.rescue-similar a{color:#1558c0!important;text-decoration:underline!important;text-underline-offset:3px;font-weight:600}
.rescue-article a:not(.rescue-shop):not(.rescue-copy):visited{color:#6b36ab!important}
.rescue-article a:hover,.rescue-similar a:hover{color:#0a3b91!important}
.rescue-article a:focus-visible,.rescue-copy:focus-visible,.rescue-shop:focus-visible{outline:3px solid #f59e0b;outline-offset:3px}
.rescue-article table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:1.2rem 0}
.rescue-article td,.rescue-article th{padding:.75rem;border:1px solid #cbd5e1;min-width:100px}
.rescue-article img,.rescue-article video,.rescue-article iframe{max-width:100%;height:auto}
.rescue-article .toc,.rescue-article .table-of-contents,.rescue-article [class*="toc-sticky"]{position:static!important;opacity:1!important;transform:none!important}
.rescue-article [style*="position:sticky"]{position:static!important}
.rescue-offer{background:#fffaf0;border:2px solid #facc15;box-shadow:0 6px 18px rgba(15,23,42,.06);border-radius:16px;padding:19px;margin:1.1rem 0 2rem;color:#172334;line-height:1.55}
.rescue-offer__heading{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;font-size:1rem}
.rescue-offer__heading strong{font:800 1.5rem/1.3 system-ui,sans-serif;letter-spacing:1px;color:#0f172a}
.rescue-offer__buttons{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 8px}
.rescue-offer__buttons>*{flex:1 1 190px;display:inline-flex;justify-content:center;align-items:center;min-height:48px;border-radius:10px;padding:10px 15px;text-align:center;font-size:1rem;font-weight:800;cursor:pointer;text-decoration:none!important}
.rescue-copy{border:2px solid #1d4ed8;background:#1d4ed8;color:#fff}.rescue-copy:hover{background:#153aab}
.rescue-shop{border:2px solid #0f172a;background:#fff;color:#0f172a!important}.rescue-shop:hover{background:#f1f5f9}
.rescue-offer__note{font-size:.85rem;color:#475569;margin:.5rem 0 0}.rescue-copy-status{display:block;font-weight:700;color:#166534;min-height:1.4em;font-size:.9rem}
.rescue-similar{background:#f8fafc;padding:18px;border-radius:12px;margin:2rem 0}.rescue-similar ul{padding-inline-start:1.4rem}
.rescue-mobile-offer{display:none}
@media(max-width:650px){main{padding:14px}.rescue-article{font-size:1rem;line-height:1.85}.rescue-offer{padding:14px}.rescue-offer__buttons>*{flex-basis:100%}.rescue-mobile-offer{display:block;position:fixed;z-index:25;inset-inline:0;bottom:0;background:#fff;box-shadow:0 -3px 18px #0f172a30;border-top:1px solid #ddd;padding:9px 12px;max-width:100vw}.rescue-mobile-offer .rescue-offer__heading,.rescue-mobile-offer .rescue-offer__note,.rescue-mobile-offer .rescue-copy-status{display:none}.rescue-mobile-offer .rescue-offer__buttons{display:flex;flex-wrap:nowrap;margin:0;gap:8px}.rescue-mobile-offer .rescue-offer__buttons>*{min-height:44px;padding:8px 6px;flex:1 1 50%;font-size:.85rem}body:has(.rescue-mobile-offer){padding-bottom:90px}}
</style>
`;
export const rescueCopyScript=String.raw`
<script id="rescue-coupon-copy">
(function(){
  // Match the site's existing privacy-safe aggregate endpoint. The rescue
  // renderer bypasses the old brand-runtime conversion listener entirely.
  // Count real copy success and outbound Noon clicks; never collect buyer PII.
  function track(type,market,coupon,placement){
    if(navigator.doNotTrack==='1'||window.doNotTrack==='1')return;
    var eventData={type:type,path:location.pathname,label:type==='copy_code'?coupon:'www.noon.com',market:market,coupon_code:coupon,placement:placement,destination_host:type==='open_noon'?'www.noon.com':''};
    var payload=JSON.stringify(eventData);
    try{if(navigator.sendBeacon&&navigator.sendBeacon('/api/track-event',new Blob([payload],{type:'application/json'})))return}catch(e){}
    try{fetch('/api/track-event',{method:'POST',headers:{'content-type':'application/json'},body:payload,keepalive:true}).catch(function(){})}catch(e){}
  }
  document.addEventListener('click',function(event){
    var anchor=event.target.closest('a[href]');if(!anchor)return;
    try{var dest=new URL(anchor.href,location.href);if(!/(^|\.)noon\.com$/i.test(dest.hostname))return}catch(e){return}
    var root=anchor.closest('[data-market]')||document.querySelector('.rescue-article[data-market]');
    var market=root&&root.getAttribute('data-market')==='AE'?'AE':'SA';
    track('open_noon',market,market==='AE'?'NOV188':'NOV170',anchor.closest('.rescue-offer')?.querySelector('[data-placement]')?.getAttribute('data-placement')||'article_link');
  },true);
  document.addEventListener('click',async function(event){
    var button=event.target.closest('button[data-rescue-copy],button[data-copy-code]');
    if(!button)return;
    var root=button.closest('[data-market]')||document.querySelector('.rescue-article[data-market]');
    if(!root)return;
    var code=root.getAttribute('data-market')==='AE'?'NOV188':'NOV170';
    event.preventDefault();
    event.stopImmediatePropagation();
    var copied=false;
    try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(code);copied=true}}catch(e){}
    if(!copied){try{var box=document.createElement('textarea');box.value=code;box.setAttribute('readonly','');box.style.position='fixed';box.style.opacity='0';document.body.appendChild(box);box.select();copied=document.execCommand('copy');box.remove()}catch(e){}}
    var status=button.closest('.rescue-offer')?.querySelector('.rescue-copy-status')||document.querySelector('.rescue-copy-status');
    if(status)status.textContent=copied?(document.documentElement.lang.startsWith('en')?'Copied '+code:'تم نسخ '+code):(document.documentElement.lang.startsWith('en')?'Select and copy: '+code:'انسخ الكود: '+code);
    if(copied)button.textContent=(document.documentElement.lang.startsWith('en')?'Copied ':'تم النسخ: ')+code;
    if(copied)track('copy_code',root.getAttribute('data-market')==='AE'?'AE':'SA',code,button.dataset.placement||'article');
    if(copied)document.dispatchEvent(new CustomEvent('noon:coupon-copied',{detail:{market:root.getAttribute('data-market'),placement:button.dataset.placement||'article'}}));
  },true);
})();
</script>
`;
