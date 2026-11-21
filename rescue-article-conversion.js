// Shared article presentation for the existing R2 rescue reader.
// No R2 rewrites, original article URLs, pricing claims or affiliate links.
import {PRIMARY_COUPON_BY_MARKET,normalizeMarketCoupon} from './approved-coupons.js';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const primaryCodeForMarket=country=>PRIMARY_COUPON_BY_MARKET[country==='AE'?'AE':'SA'];
export function presentMarketCouponText(source,country='SA',preferredCode=null){
  const code=preferredCode?normalizeMarketCoupon(preferredCode,country):primaryCodeForMarket(country);
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
      return part.replace(/(data-copy-code=["'])(?:NOV|RAMY|OPS)\d{2,4}(["'])/gi,'$1'+code+'$2')
        .replace(/((?:aria-label|title)=["'][^"']*)\b(?:NOV|RAMY|OPS)\d{2,4}\b/gi,'$1'+code);
    }
    return part;
  }).join('');
}
// Historic Arabic UAE articles used the English token "uae" immediately
// after the Arabic merchant name. Localize only visible text nodes, not
// URLs, data attributes, slugs, script/style contents or original R2 bytes.
export function normalizeArabicUaeMentions(source,country='SA',english=false){
 const raw=String(source??'');
 if(country!=='AE'||english||!/نون\s+uae\b/i.test(raw))return raw;
 return raw.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<[^>]+>)/gi)
   .map(part=>part.startsWith('<')?part:part.replace(/نون[\s\u00a0]+uae\b/gi,'نون الإمارات')).join('');
}
// Public QA found two specific legacy Arabic UAE articles with clothing
// advice incorrectly applied to backpacks or malformed "لـهدية" sentences.
// Repair the exact previously verified prose in visible text nodes ONLY.
// Restrict this to the two audited slugs, never all brand articles. Preserve
// scripts, structured data, hrefs, markup, the coupon and original R2 bytes.
export function repairAuditedLegacyBuyerGuidance(html,slug,country='SA',english=false){
 const source=String(html??'');
 if(country!=='AE'||english)return source;
 const key=String(slug??'');
 const backpack=key==='american-tourister-backpacks-السعر-النهائي-بعد-تجربة-الكود-نون-الإمارات';
 const adidas=key==='إرجاع-adidas-originals-للطلب-الأول-وكوبون-نون-الإمارات-من-المتصفح-هدية-اللون';
 if(!backpack&&!adidas)return source;
 const pairs=backpack?[
  ['فابدأ بصلاحية American Tourister Backpacks السعر النهائي بعد تجربة الكود لـالرياضة ثم راجع اللون والبائع والشحن.',
   'فابدأ بمقارنة سعة حقيبة الظهر ومقاسها وخامتها والبائع والشحن.'],
  ['وفي هذا الدليل نركز على مع أولوية سهولة الاستخدام.',
   'وفي هذا الدليل نركز على راحة حمل الحقيبة وملاءمتها للاستخدام.'],
  ['قبل التفكير في القسيمة، ثبّت ما تحتاجه فعلًا في American Tourister Backpacks السعر النهائي بعد تجربة الكود. في حالة الرياضة، ركّز أولًا على المقاس والخامة، ثم راجع القصة.',
   'قبل التفكير في القسيمة، حدد السعة المناسبة لحقيبة الظهر، ثم راجع المقاس والخامة وتوزيع الجيوب وراحة الحمل.'],
  ['افترض أنك وجدت خيارين من American Tourister Backpacks السعر النهائي بعد تجربة الكود مناسبين لـالرياضة.',
   'إذا وجدت حقيبتي ظهر مناسبتين لاحتياجك،'],
  ['أكمل عندما يكون American Tourister Backpacks السعر النهائي بعد تجربة الكود مناسبًا لـالرياضة،',
   'أكمل عندما تكون حقيبة الظهر مناسبة لاستخدامك،'],
  ['قارن ملاءمة المنتج لـالرياضة والبائع والإرجاع والشحن والإجمالي النهائي؛',
   'قارن سعة الحقيبة وراحة حملها والبائع والإرجاع والشحن والإجمالي النهائي؛']
 ]:[
  ['فابدأ بصلاحية adidas Originals للطلب الأول لـهدية ثم راجع اللون والبائع والشحن.',
   'فابدأ بمراجعة مقاس المنتج وخامته ولونه وشروط الإرجاع والبائع، خصوصًا عند شراء هدية.'],
  ['قبل التفكير في القسيمة، ثبّت ما تحتاجه فعلًا في adidas Originals للطلب الأول. في حالة هدية، ركّز أولًا على المقاس والخامة، ثم راجع القصة.',
   'قبل التفكير في القسيمة، راجع مقاس المنتج وخامته ولونه وشروط إرجاعه، خصوصًا إذا كان هدية.'],
  ['افترض أنك وجدت خيارين من adidas Originals للطلب الأول مناسبين لـهدية.',
   'إذا وجدت منتجين من adidas Originals مناسبين كهدية،'],
  ['أكمل عندما يكون adidas Originals للطلب الأول مناسبًا لـهدية،',
   'أكمل عندما يكون المنتج المختار مناسبًا للشخص الذي سيتلقى الهدية،'],
  ['قارن ملاءمة المنتج لـهدية',
   'قارن ملاءمة المنتج كهدية']
 ];
 return source.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<[^>]+>)/gi)
  .map(part=>{
   if(part.startsWith('<'))return part;
   let clean=part;
   for(const [oldText,newText] of pairs)clean=clean.replaceAll(oldText,newText);
   return clean.replaceAll('سوق uae','سوق الإمارات');
  }).join('');
}

// R2 stores older FAQ JSON-LD under the original promotion code. The public
// reader now displays the market primary code; keep FAQ schema in agreement
// with the *visible* FAQ without touching canonical URLs, item IDs or source R2.
export function reconcileSourceCouponJsonLd(html,country='SA',preferredCode=null,english=false){
  const code=preferredCode?normalizeMarketCoupon(preferredCode,country):primaryCodeForMarket(country);
  const tokens=/\b(?:NOV|RAMY|OPS)\d{2,4}\b/gi;
  const textualFields=new Set(['name','headline','description','text','alternateName','step','suggestedAnswer','itemText']);
  const replaceText=value=>{const current=String(value).replace(tokens,code);
    return country==='AE'&&!english?current.replace(/نون[\s\u00a0]+uae\b/gi,'نون الإمارات'):current;
  };
  function clean(node){
    if(Array.isArray(node))return node.map(clean);
    if(!node||typeof node!=='object')return node;
    const next={};
    for(const [key,value] of Object.entries(node)){
      next[key]=typeof value==='string'&&textualFields.has(key)
        ?replaceText(value)
        :Array.isArray(value)||value&&typeof value==='object'?clean(value):value;
    }
    return next;
  }
  return String(html??'').replace(/<script\b([^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,(full,attrs,json)=>{
    try{
      const data=JSON.parse(json);
      const safe=clean(data);
      const str=JSON.stringify(safe).replace(/</g,'\\u003c');
      return '<script '+attrs+'>'+str+'</script>';
    }catch{return full}
  });
}

// Legacy article bodies contain "/guides", a confirmed production 404.
// Repair only that exact internal destination according to the article market;
// original stored bytes, article URL and all other hrefs are unchanged.
export function repairLegacyGuideLinks(source,country='SA'){
  const target=country==='AE'?'/uae/shopping-guide':'/saudi/shopping-guide';
  // The old template also emitted an absolute same-site /guides URL.
  // Only repair the exact known-404 destination, never other hosts,
  // nested /guides paths or stored article/R2 bytes.
  return String(source??'').replace(
    /(<a\b[^>]*\bhref\s*=\s*)(["'])(?:(?:https?:\/\/(?:www\.)?noondealsnow\.com))?\/guides\/?\2/gi,
    (_all,attrs,quote)=>attrs+quote+target+quote
  );
}

// Repair only generic Noon homepage links stored in legacy article bodies.
// Preserve every product/deep link, article URL and source R2 object unchanged.
export function marketNoonHome(country='SA',english=false){
  return country==='AE'?(english?'https://www.noon.com/uae-en/':'https://www.noon.com/uae-ar/'):'https://www.noon.com/saudi-ar/';
}
export function repairGenericNoonLinks(source,country='SA',english=false){
  const target=marketNoonHome(country,english);
  return String(source??'').replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])https?:\/\/(?:www\.)?noon\.com\/?\2/gi,(_full,start,q)=>start+q+target+q);
}

export function renderCouponAction(country='SA',english=false,placement='top'){
  const market=country==='AE'?'AE':'SA',code=primaryCodeForMarket(market);
  const official=marketNoonHome(market,english);
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
  // Checkout-intent and location words can appear on completely unrelated
  // products ("final price" on a console, a laptop and skincare). None alone
  // establishes topical relevance for an internal "related article" link.
  const generic=new Set(['noon','saudi','arabia','uae','emirates','english','guide','guides','coupon','coupons','discount','promo','code','codes','price','prices','shopping','review','reviews','best','offers','offer','latest','today','final','total','checkout','eligibility','eligible','budget','decision','conditions','condition','seller','sellers','return','returns','shipping','delivery','comparison','compare','model','cart','payment','purchase','buying','buy','smart','help','working','online','mobile','desktop','sharjah','dubai','abu','dhabi','ain','ras','khaimah','nooncom','نون','السعودية','الإمارات','الامارات','كوبون','خصم','دليل','شراء','مقارنة','عروض','السعر','أفضل','افضل','منتج','منتجات','الشراء','التسوق']);
  const words=s=>String(s||'').toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter(x=>x.length>=4&&!generic.has(x));
  const consoleFamily=text=>{
    const value=String(text||'').toLowerCase().replace(/[_\s]+/g,'-');
    if(/(?:^|-)nintendo-switch(?:-2)?(?:-|$)/.test(value))return 'nintendo-switch';
    if(/(?:^|-)(?:ps5(?:-pro)?|playstation-5(?:-pro)?)(?:-|$)/.test(value))return 'playstation-5';
    if(/(?:^|-)xbox-series-[xs](?:-|$)/.test(value))return 'xbox-series';
    return '';
  };
  const family=english?consoleFamily(current):'';
  const focus=new Set(words(current)),seen=new Set(),choices=[];
  for(const x of source){
    if(!x?.slug||x.slug===current||seen.has(x.slug)||x.status!=='published'||x.indexable===false||x.slug.startsWith('en-')!==Boolean(english))continue;
    const itemMarket=x.country==='SA'?'SA':x.country==='AE'?'AE':
      (x.slug.startsWith('en-')||/الإمارات/.test(x.slug)?'AE':'SA');
    if(itemMarket!==market)continue;
    // A console query must not recommend unrelated laptops, skincare or
    // general checkout pages merely because their buying-intent terms match.
    const sameFamily=Boolean(family&&consoleFamily(String(x.title||'')+' '+x.slug)===family);
    if(family&&!sameFamily)continue;
    seen.add(x.slug);
    const shared=new Set(words(String(x.title||'')+' '+x.slug).filter(w=>focus.has(w)));
    // Keep PS5 ↔ PlayStation 5 aliases related even when token overlap is zero;
    // otherwise an intent-only match never justifies a related link.
    if(!shared.size&&!sameFamily)continue;
    choices.push({x,score:shared.size+(sameFamily?3:0)});
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
.rescue-mobile-offer .rescue-offer{margin:0;padding:0;border:0;box-shadow:none;background:transparent}
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
    try{if(typeof window.gtag==='function'){
      var common={page_path:eventData.path,coupon_code:coupon,market:market,placement:placement,cta_position:placement,destination_host:eventData.destination_host};
      window.gtag('event',type==='copy_code'?'coupon_copy':'noon_outbound',common);
      // This event means a successful copy, not an attributed Noon purchase.
      if(type==='copy_code')window.gtag('event','coupon_copy_success',common);
    }}catch(e){}
    try{if(navigator.sendBeacon&&navigator.sendBeacon('/api/track-event',new Blob([payload],{type:'application/json'})))return}catch(e){}
    try{fetch('/api/track-event',{method:'POST',headers:{'content-type':'application/json'},body:payload,keepalive:true}).catch(function(){})}catch(e){}
  }
  document.addEventListener('click',function(event){
    var anchor=event.target.closest('a[href]');if(!anchor)return;
    try{var dest=new URL(anchor.href,location.href);if(!/(^|\.)noon\.com$/i.test(dest.hostname))return}catch(e){return}
    var offer=anchor.closest('.rescue-offer');
    var root=offer||anchor.closest('[data-market]')||document.querySelector('.rescue-article[data-market]');
    var market=root&&root.getAttribute('data-market')==='AE'?'AE':'SA';
    // Never assign a coupon to generic Noon outbound links: they do not prove
    // that a shopper viewed or copied any specific code.
    var code=offer?.querySelector('button[data-rescue-copy]')?.getAttribute('data-rescue-copy')||anchor.getAttribute('data-shop-click')||'';
    track('open_noon',market,code,offer?.querySelector('[data-placement]')?.getAttribute('data-placement')||'article_link');
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
