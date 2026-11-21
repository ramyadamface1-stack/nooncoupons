import {completeBlogResponse} from './complete-blog-listing.js';
import {refreshLiveTemporalArticleHtml} from './article-temporal-freshness.js';
import {primaryCodeForMarket,presentMarketCouponText,reconcileSourceCouponJsonLd,repairLegacyGuideLinks,repairGenericNoonLinks,normalizeArabicUaeMentions,repairAuditedLegacyBuyerGuidance,repairLegacyArabicBlueprintText,clarifyAuditedEnglishConsoleLaptopPage,renderCouponAction,renderRelatedArticles,rescueArticleStyles,rescueCopyScript} from './rescue-article-conversion.js';
// Temporary, READ-ONLY fallback for public pages when the old account's R2 is NotEntitled (10042).
// Source of article bytes: existing mirrored R2 in destination Cloudflare account.
// No writes, no new Durable Objects, no extra publisher, no DNS changes, no private endpoints.
const ACCOUNT='e4c35f8a50a7b2e4cfb9d6c534962603';
const BUCKET='nooncoupons-content-v2';
const enc=new TextEncoder();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const encode=s=>encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const bin=b=>typeof b==='string'?enc.encode(b):b;
const htmlHeaders={
  'content-type':'text/html; charset=utf-8',
  'cache-control':'public,max-age=30,s-maxage=300,stale-while-revalidate=600',
  'x-r2-rescue':'new-account-readonly-v1',
  // Rescue pages bypass premium-entry/public-entry. Apply equivalent protections here.
  'x-content-type-options':'nosniff',
  'x-frame-options':'SAMEORIGIN',
  'referrer-policy':'strict-origin-when-cross-origin',
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy':'same-origin',
  'x-permitted-cross-domain-policies':'none',
  'content-security-policy':"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com; upgrade-insecure-requests",
  'x-ga4-measurement':'G-1551Z7DJ2C'
};
const manifestCache=new Map();
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',bin(s)))}
async function mac(key,msg){const k=await crypto.subtle.importKey('raw',bin(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,bin(msg)))}
function resource(env){return {id:String(env.NOON_RESCUE_R2_ACCESS_KEY_ID||'').trim(),secret:String(env.NOON_RESCUE_R2_SECRET_ACCESS_KEY||'').trim()}}
export async function signedR2Read(env,key='',params={}){
  const credentials=resource(env);
  if(!credentials.id||!credentials.secret)throw new Error('rescue_credentials_not_configured');
  if(key&&!(/^(?:articles|bulk|_ops|english-canary|seo-rescue|blog)\//.test(key)))throw new Error('rescue_prefix_not_public');
  const host=ACCOUNT+'.r2.cloudflarestorage.com',path='/'+encode(BUCKET)+(key?'/'+key.split('/').map(encode).join('/'):'');
  const query=Object.keys(params).sort().map(k=>encode(k)+'='+encode(params[k])).join('&');
  const now=new Date(),stamp=now.toISOString().replace(/[:-]|\.\d{3}/g,''),day=stamp.slice(0,8);
  const empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const canonicalHeaders='host:'+host+'\n'+'x-amz-content-sha256:'+empty+'\n'+'x-amz-date:'+stamp+'\n';
  const signed='host;x-amz-content-sha256;x-amz-date';
  const request=['GET',path,query,canonicalHeaders,signed,empty].join('\n');
  const scope=day+'/auto/s3/aws4_request';
  const stringToSign=['AWS4-HMAC-SHA256',stamp,scope,await digest(request)].join('\n');
  let signingKey=await mac('AWS4'+credentials.secret,day);
  signingKey=await mac(signingKey,'auto');
  signingKey=await mac(signingKey,'s3');
  signingKey=await mac(signingKey,'aws4_request');
  const signature=hex(await mac(signingKey,stringToSign));
  const headers={
    'x-amz-date':stamp,
    'x-amz-content-sha256':empty,
    'authorization':'AWS4-HMAC-SHA256 Credential='+credentials.id+'/'+scope+', SignedHeaders='+signed+', Signature='+signature
  };
  return fetch('https://'+host+path+(query?'?'+query:''),{method:'GET',headers,redirect:'manual'});
}
// Retry ONE transient read failure only. Do not retry NotEntitled/403 or
// missing/404, and never issue HEAD checks. Public edge cache remains first.
export async function rescueSignedReadBounded(env,key,params={}){
  let response;
  for(let attempt=0;attempt<2;attempt++){
    try{
      response=await signedR2Read(env,key,params);
      if(![429,500,502,503,504].includes(response.status)||attempt===1)return response;
      try{await response.body?.cancel()}catch{}
    }catch(error){
      if(attempt===1)throw error;
    }
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  return response;
}
async function getObject(env,key,cacheMs=0){
  const prev=cacheMs?manifestCache.get(key):null;
  if(prev&&prev.until>Date.now())return prev.value;
  // After DNS cutover, destination R2 is natively bound to the Worker.
  // Prefer it to historical cross-account signed fetches: no access secrets,
  // no external subrequest, and no extra bandwidth or HMAC CPU overhead.
  let value;
  if(env.CONTENT_FINAL?.get){
    const object=await env.CONTENT_FINAL.get(key);
    if(!object)return null;
    value={body:await object.text(),meta:object.customMetadata||{},
      modified:object.uploaded?.toISOString?.()||'',contentType:object.httpMetadata?.contentType||''};
  }else{
    const r=await rescueSignedReadBounded(env,key);
    if(r.status===404)return null;
    if(!r.ok)throw new Error('rescue_r2_get_status_'+r.status);
    value={body:await r.text(),meta:Object.fromEntries([...r.headers].filter(([name])=>name.startsWith('x-amz-meta-')).map(([name,val])=>[name.slice('x-amz-meta-'.length),val])),modified:r.headers.get('last-modified')||'',contentType:r.headers.get('content-type')||''};
  }
  if(cacheMs){manifestCache.set(key,{value,until:Date.now()+cacheMs});if(manifestCache.size>5)manifestCache.delete(manifestCache.keys().next().value)}
  return value;
}
async function getJson(env,key){const result=await getObject(env,key,key==='blog/latest-live-v1.json'?15000:120000);return result?JSON.parse(result.body):null}

const rescueImageUrl=(slug,country='SA',coupon='',variant=1,title='')=>'/assets/coupon-svg/'+encodeURIComponent(String(slug))+'/'+variant+'.svg?v=11&country='+encodeURIComponent(country==='AE'?'AE':'SA')+(coupon?'&coupon='+encodeURIComponent(String(coupon)):'')+(title?'&kw='+encodeURIComponent(String(title).slice(0,120)):'');
const marketOf=a=>a?.country==='AE'||/^en-/.test(String(a?.slug||''))||/\buae\b|الإمارات/i.test(String(a?.slug||''))?'AE':'SA';
const dateIso=s=>{const d=new Date(s||'');return Number.isFinite(d.getTime())?d.toISOString():null};
const dateLabel=s=>{try{return new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(s))}catch{return ''}};
// Only editorially verified content changes may set dateModified. Storage
// migration times, automatic month labels and future scheduling do not count.
export function verifiedEditorialModifiedAt(meta,publishedAt,now=new Date()){
  const raw=meta?.editorialUpdatedAt||meta?.substantiveUpdatedAt;
  const updated=dateIso(raw),published=dateIso(publishedAt);
  if(!updated||!published)return null;
  const ms=Date.parse(updated),created=Date.parse(published),current=now.getTime();
  return ms>created&&ms<=current?updated:null;
}
// Readers and crawlers see the same date semantics: the original publication
// time remains intact, while a genuinely revised article may separately show
// its verified editorial update. Automatic month-label repairs don't qualify.
export function visibleEditorialDates(publishedAt,modifiedAt,english=false){
  const published=dateIso(publishedAt),modified=dateIso(modifiedAt);
  if(!published)return '';
  const locale=english?'en-GB':'ar-EG';
  const format=date=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(date));
  return '<p class="article-published">'+(english?'Published: ':'تاريخ النشر: ')+
    '<time datetime="'+esc(published)+'">'+esc(format(published))+'</time>'+
    '<span class="article-timezone"> · '+(english?'Cairo time':'بتوقيت القاهرة (Cairo time)')+'</span>'+
    (modified&&Date.parse(modified)>Date.parse(published)&&Date.parse(modified)<=Date.now()
      ?' <span class="article-editorial-updated">· '+(english?'Substantially updated: ':'آخر تحديث تحريري: ')+
        '<time itemprop="dateModified" datetime="'+esc(modified)+'">'+esc(format(modified))+'</time></span>'
      :'')+'</p>';
}
// Migrated R2 articles sometimes contain an entire stand-alone HTML page.
// Nesting its head/body into the rescue page duplicates title, canonical and
// schema tags and can point Google at the OLD domain. Keep the actual article
// content, but never embed the obsolete document shell.
export function unwrapLegacyArticleDocument(source){
  const raw=String(source??'');
  if(!/(?:<!doctype\s+html\b|<html\b)/i.test(raw))return raw;
  const body=raw.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  if(body){
    const main=body[1].match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i);
    return (main&&/<(?:article|h1)\b/i.test(main[1])?main[1]:body[1]).trim();
  }
  return raw.replace(/<!doctype\s+html[^>]*>/i,'')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i,'')
    .replace(/<\/?(?:html|body)\b[^>]*>/gi,'').trim();
}

// Only the exact known former self-domain, and only mapped on-site paths.
// Product/store/external domains and all original article URLs stay untouched.
export function localizeLegacySiteNavigation(source,slug,country='SA'){
  const currentSlug=String(slug??'');
  const market=country==='AE'?'uae':'saudi';
  const map=new Map([
    ['/','/'],['/blog','/blog'],['/coupons','/coupons'],
    ['/categories','/'+market+'/categories'],
    ['/saudi','/saudi'],['/saudi-arabia','/saudi'],
    ['/uae','/uae'],['/united-arab-emirates','/uae']
  ]);
  return String(source??'').replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])(https?:\/\/(?:www\.)?couponsnoon\.com(?:\/[^"'<>]*)?)\2/gi,(full,prefix,q,rawUrl)=>{
    let url;try{url=new URL(rawUrl)}catch{return full}
    const path=url.pathname.replace(/\/+$/,'')||'/';
    const internal=path==='/'?'/':map.get(path);
    let decodedPath=path;try{decodedPath=decodeURIComponent(path)}catch{}
    const self=decodedPath==='/'+currentSlug?'/articles/'+encodeURIComponent(currentSlug):null;
    if(!internal&&!self)return full;
    return prefix+q+(self||internal)+(url.search||'')+(url.hash||'')+q;
  });
}
const imgTag=(slug,country,coupon,variant=1,title='')=>'<img src="'+esc(rescueImageUrl(slug,country,coupon,variant,title))+'" alt="'+esc('Noon '+(country==='AE'?'UAE':'Saudi Arabia')+' coupon guide — '+title)+'" width="1600" height="1000" loading="'+(variant===1?'eager':'lazy')+'" decoding="async" style="width:100%;height:auto;aspect-ratio:8/5;object-fit:contain;background:#f8fafc;border-radius:12px">';

// Existing R2 objects are immutable. Apply narrowly scoped, evidence-led GSC
// snippet improvements at render time, never changing the H1, slug or article.
// Unverified discounts, real-time price figures and claims are intentionally absent.
const RESCUE_GSC_SNIPPETS={
  'en-iphone-18-pro-max-noon-abu-dhabi-price':{
    title:'iPhone 18 Pro Max in Abu Dhabi on Noon UAE | Price Guide',
    description:'Compare iPhone 18 Pro Max listings on Noon UAE in Abu Dhabi. Check the exact model, seller, delivery, NOV188 eligibility and final cart total.'
  },
  'en-iphone-18-pro-max-noon-abu-dhabi-buying-guide':{
    title:'iPhone 18 Pro Max on Noon UAE | Abu Dhabi Buying Guide',
    description:'Planning to buy iPhone 18 Pro Max in Abu Dhabi? Review the model, seller, warranty, delivery and final Noon UAE checkout total with NOV188.'
  },
  'en-iphone-duo-noon-abu-dhabi-coupon-code':{
    title:'iPhone Duo Noon UAE Coupon Code | Abu Dhabi Guide',
    description:'Compare iPhone Duo listings on Noon UAE in Abu Dhabi. Check the seller, model, NOV188 coupon eligibility and final checkout total.'
  },
  'en-samsung-galaxy-s26-ultra-noon-dubai-deals':{
    title:'Samsung Galaxy S26 Ultra on Noon Dubai | UAE Guide',
    description:'Review Samsung Galaxy S26 Ultra listings on Noon UAE in Dubai. Compare the seller, warranty, shipping and final total with NOV188.'
  },
  'en-noon-cart-coupon-uae-grocery-checkout-guide':{
    title:'Noon UAE Grocery Coupon Code | Checkout Guide',
    description:'Shopping for groceries on Noon UAE? Check pack sizes, seller, delivery and NOV188 coupon eligibility before confirming the cart total.'
  }
};
export function rescueGscSnippet(slug,title,description,english){
  const row=english?RESCUE_GSC_SNIPPETS[String(slug||'')]:null;
  return row?{title:row.title,description:row.description,optimized:true}:{title,description,optimized:false};
}
// Legacy generated articles sometimes claim an individual human review that
// is not substantiated by the article's recorded provenance. Do not fabricate
// a reviewer or freshness date: neutralize only this exact historical label
// at read time, leaving the R2 source and all article identifiers intact.
export function neutralizeUnverifiedEditorialReview(html){
  return String(html??'')
    .replace(/Reviewed by Noon Deals Now Editorial Team/gi,'Noon Deals Now shopping guide')
    // An earlier article template used a different site's name as its
    // publisher. Repair that exact prose claim, never URLs or stored R2.
    .replace(/\bNoonCoupons treats coupon outcomes\b/gi,'Noon Deals Now treats coupon outcomes');
}

// Existing archived English articles sometimes label a gaming console as
// "laptops and computing" and explain keyboard/processor specifications.
// Correct only unmistakable console slugs with that exact wrong category;
// preserve every title, slug, coupon, link, source record and other article.
export function repairArchivedProductCategoryHtml(html,slug,english=false){
  const source=String(html??'');
  if(!english||
    !/(?:^|-)(?:nintendo-switch(?:-2)?|ps5(?:-pro)?|playstation-5(?:-pro)?|xbox-series-[xs])(?:-|$)/i.test(String(slug||''))||
    !/laptops and computing/i.test(source))return source;
  const baseline=/<h2\b[^>]*>\s*Category baseline for laptops and computing\s*<\/h2>(?:\s*<p\b[^>]*>[^<]*<\/p>){2}/i;
  const specifics=/<h2\b[^>]*>\s*Category-specific checks for laptops and computing\s*<\/h2>(?:\s*<p\b[^>]*>[^<]*<\/p>){2}/i;
  if(!baseline.test(source)||!specifics.test(source))return source;
  const corrected=source
    .replace(baseline,'<h2>Category baseline for gaming consoles</h2>'+
      '<p>Before comparing console prices, confirm the exact model or edition, included controller and accessories, storage, game compatibility and the seller warranty. A bundle and a standalone console are not equivalent when their contents differ.</p>'+
      '<p>Keep the seller, region, included items and quantity fixed during coupon tests. Check delivery, return terms and the final payable total for the exact listing instead of assuming a coupon makes an unsuitable bundle better value.</p>')
    .replace(specifics,'<h2>Category-specific checks for gaming consoles</h2>'+
      '<p>Check the exact console edition, included controllers and games, storage needs, compatible accessories and regional support. Verify bundle contents in the actual seller listing rather than assuming extras are included.</p>'+
      '<p>Compare only like-for-like console listings and warranty terms. Apply the coupon to a stable cart and use the current Noon checkout to confirm the outcome.</p>');
  // If either old two-paragraph section has unexpected markup, do not replace
  // a label alone and leave the unrelated laptop buying advice in place.
  if(baseline.test(corrected)||specifics.test(corrected))return source;
  return corrected.replace(/laptops and computing/gi,'gaming consoles');
}
// R2 custom metadata from historical native publishers may be URI-encoded
// twice (e.g. %25D8%25AF rather than the Arabic description itself). Decode
// boundedly for human-readable title/meta/OG only; never decode canonical URLs,
// slugs, coupon codes, dates or the persisted article object.
export function decodeNativeMetadataText(value){
 let current=String(value??'');
 for(let i=0;i<3&&/%[0-9a-f]{2}/i.test(current);i++){
  let next;
  try{next=decodeURIComponent(current)}catch{break}
  if(next===current)break;
  current=next;
 }
 return current;
}
// Some archived R2 metadata was CUT mid-percent-encoded UTF-8 (e.g. %D8%AF
// ... %D8%). decodeURIComponent cannot recover malformed truncated bytes,
// so do not publish the percent escapes as a Google snippet. Reuse the
// description already present in that exact article's Article JSON-LD.
// No crawler assertions, new claims, R2 writes, or unknown publisher data.
export function articleJsonLdDescription(html){
 const source=String(html??'');
 const pattern=/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
 let match,seen=0;
 while((match=pattern.exec(source))&&++seen<=5){
  let data;
  try{data=JSON.parse(match[1])}catch{continue}
  const entries=Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data];
  for(const obj of entries){
   if(!obj||typeof obj!=='object')continue;
   const types=Array.isArray(obj['@type'])?obj['@type']:[obj['@type']];
   if(!types.includes('Article')&&!types.includes('BlogPosting'))continue;
   const desc=String(obj.description||'').replace(/\s+/g,' ').trim();
   if(desc.length>=30&&!/%(?:25)*(?:d8|d9)/i.test(desc))return desc;
  }
 }
 return '';
}
export function nativeMetaDescription(value,source){
 const decoded=decodeNativeMetadataText(value);
 const unreadable=/%(?:25)*(?:d8|d9|c[2-9a-f]|e[0-9a-f])/i.test(decoded);
 const grounded=unreadable?articleJsonLdDescription(source):'';
 return readableMetaDescription(grounded||decoded);
}
// Old R2 descriptions were cut at an arbitrary character, sometimes leaving
// half of an Arabic or English word in the public Google snippet. Keep source
// bytes untouched; prefer a complete nearby sentence and otherwise cut on a
// word boundary. This is formatting, not an invented editorial update date.
export function readableMetaDescription(value,maxLength=170){
  const raw=String(value||'').replace(/\s+/g,' ').trim();
  // An older publisher cut some fields before a trailing connective (for
  // example "...قبل الدفع، مع"). Finish at the last complete thought, without
  // pretending the underlying R2 article received a substantive edit.
  if(raw.length<=maxLength&&/[،,;:]\s*(?:مع|ثم|أو|و|and|with|or|if)$/i.test(raw)){
    return raw.replace(/[،,;:]\s*(?:مع|ثم|أو|و|and|with|or|if)$/i,'').replace(/[.؟!?\s]+$/u,'').trim()+'.';
  }
  if(raw.length<=maxLength)return raw;
  const slice=raw.slice(0,maxLength);
  let finish=-1;
  for(const mark of ['.','!','؟','?','؛']){
    const at=slice.lastIndexOf(mark);
    if(at>=Math.floor(maxLength*.4)&&at>finish)finish=at;
  }
  if(finish>=0)return slice.slice(0,finish+1).trim();
  const space=slice.lastIndexOf(' ');
  const boundary=space>=Math.floor(maxLength*.65)?space:maxLength;
  return slice.slice(0,boundary).replace(/[\s،,;:.-]+$/u,'').trim()+'…';
}
// Archive templates occasionally ended Arabic H1 with dangling "مع".
// Repair only plain-text H1; preserve slugs, other content and R2 bytes.
export function tidyLegacyArabicH1(html,english=false){
  const source=String(html??'');
  if(english)return source;
  return source.replace(/(<h1\b[^>]*>)([^<>]{25,240})(<\/h1>)/i,(whole,open,inner,close)=>{
    if(!/\sمع\s*$/u.test(inner))return whole;
    const repaired=inner.replace(/\s+مع\s*$/u,'').trimEnd();
    return repaired.length>=25?open+repaired+close:whole;
  });
}
// Legacy snippets repeated article eyebrow and H1 instead of explaining the
// buyer decision. Prefer the actual checkout sentence already visible in
// a direct-answer paragraph, restricted to the article's opening HTML.
export function legacyDirectAnswerSnippet(html,title,english=false){
  const source=String(html??'').slice(0,12000);
  const match=source.match(/<p\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bdirect-answer\b)[^>]*>([\s\S]*?)<\/p>/i);
  if(!match)return null;
  const intro=cleanText(match[1]);
  const sentence=intro.split(/(?<=[.!؟])\s+/u).reverse().find(part=>
    /^(?:جرّب|اختبر|راجع|تحقق|انسخ|Try|Check|Compare|Apply)\s/i.test(part)&&
    /(?:\bNOV\d{3}\b|سلة|checkout|cart)/i.test(part)&&part.length>=55&&part.length<=235
  );
  const heading=String(title||'').replace(/\s+/g,' ').trim();
  if(!sentence||heading.length<22)return null;
  const shortTitle=heading.length>90?heading.slice(0,91).replace(/\s+\S*$/u,'').trim():heading;
  const originalSentence=sentence.replace(/\s+/g,' ').trim();
  // The inherited template repeated this unsupported-savings disclaimer after
  // an already complete buyer action. Keep that existing action intact and
  // end at a complete thought instead of cutting off "ادعاء..." in the SERP.
  const usefulSentence=originalSentence.replace(
    /\s+بدل\s+أي\s+ادعاء\s+غير\s+موثق\s+عن\s+نسبة\s+الخصم\s*[.!؟]*$/u,'.');
  const complete=shortTitle+' — '+usefulSentence;
  if(complete.length<=170)return complete;
  // On unusually long article titles, preserve a real checkout instruction
  // rather than chopping an Arabic word halfway through its sentence.
  const firstClause=usefulSentence.split('،')[0]?.replace(/[.!؟\s]+$/u,'').trim();
  if(firstClause&&firstClause.length>=34){
    const compact=shortTitle+' — '+firstClause+'.';
    if(compact.length<=170)return compact;
  }
  return readableMetaDescription(complete,165);
}
// When native publisher metadata is visibly cut mid-sentence, use only the
// actual checkout sentence in that article's direct-answer. Restrict reading
// to the first 12 KB; no fabricated discount, date, link or R2 mutation.
export function nativeCompleteSearchSnippet(source,title,english=false){
 const html=String(source??'').slice(0,12000);
 if(!english){
   const candidate=legacyDirectAnswerSnippet(html,title,false);
   return candidate&&candidate.length<=170&&/[.!؟]$/u.test(candidate)?candidate:null;
 }
 const match=html.match(/<p\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bdirect-answer\b)[^>]*>([\s\S]*?)<\/p>/i);
 if(!match)return null;
 const text=cleanText(match[1]).replace(/^Quick answer:\s*/i,'');
 const original=text.split(/(?<=[.!?])\s+/u).reverse().find(v=>
   /^(?:Start|Copy|Check|Apply|Compare|Try)\s/i.test(v)&&
   /\bNOV\d{3}\b/i.test(v)&&v.length>=45&&v.length<=240
 );
 if(!original)return null;
 const sentence=original.replace(/\s+instead\s+of\s+assuming\s+a\s+fixed\s+discount[.!?]*$/i,'.');
 const heading=String(title??'').trim(),product=heading.match(/^Noon UAE final price guide (.+) coupon eligibility$/i);
 const subject=product?product[1]+' on Noon UAE':heading;
 const candidate=subject+' — '+sentence.trim();
 return candidate.length>=55&&candidate.length<=170&&/[.!?]$/.test(candidate)?candidate:null;
}
export function refreshArtworkUrlsInHtml(html){
  return String(html||'').replace(/(\/assets\/coupon-svg\/[^"'\s<>]+\/[1-5]\.svg\?)v=\d+/g,'$1v=11');
}
const topicLinks=(country='SA',english=false)=>{
  const market=country==='AE'?'uae':'saudi';
  const landing=country==='AE'?'/uae/noon-coupon-code':'/saudi-arabia/noon-coupon-code';
  const label=english?'Useful shopping links':'روابط ذات صلة';
  // Keep English UAE readers within verified, indexable English landing pages.
  // /en/uae/categories is a 404; /uae/categories and /topics/uae are Arabic.
  // Arabic readers retain their existing approved navigation and original URLs.
  const links=english?[
    ['/en/uae/noon-coupon-code','Noon UAE coupon conditions'],
    ['/en/uae','UAE shopping hub'],
    ['/en/uae/saving-guide','UAE saving guide'],
    ['/blog/archive/english','Browse English shopping guides']
  ]:[
    [landing,'كود خصم نون'],
    ['/'+market,'تسوق نون حسب الدولة'],
    ['/'+market+'/categories','أقسام المنتجات'],
    ['/blog','أحدث المقالات'],
    ['/blog/archive/all','أرشيف المقالات'],
    ['/blog/archive','فهرس المقالات القديمة'],
    ['/topics/'+market,'مقالات هذا السوق'],
    ['/topics/buying-guides','أدلة الشراء'],
    ['/topics/coupon-help','مشاكل الكوبونات']
  ];
  return '<nav id="article-topic-path" class="related" aria-label="'+esc(label)+'"><h2>'+esc(label)+'</h2><div class="related-links">'+
    links.map(([href,title])=>'<a href="'+esc(href)+'">'+esc(title)+'</a>').join('')+'</div></nav>';
};
function page(title,content,{lang='ar',dir='rtl',canonical='',description='',robots='noindex,follow',image=''}={}){
  const header='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="'+esc(robots)+'">'+
    '<title>'+esc(title)+(String(lang).startsWith('en')?' | Noon Deals Now':' | كوبونات نون')+'</title><meta name="description" content="'+esc(description||title)+'">'+
    (canonical?'<link rel="canonical" href="'+esc(canonical)+'">':'')+
    (image?'<meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description||title)+'"><meta property="og:url" content="'+esc(canonical||'https://noondealsnow.com/blog')+'"><meta property="og:image" content="'+esc(image)+'"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="'+esc(image)+'">':'');
  // These rescue responses exit before public-entry.js's original injection.
  // Reuse this site's *existing* verified GA4 property; no new data backend.
  const analytics='<meta name="google-site-verification" content="LmU-uUjdxfArIxwpCxeSn7eKDIcUrc3zU2CqS8zmxrQ">'+
    '<script id="rescue-site-analytics">(function(){'+
    'if(navigator.doNotTrack==="1"||window.doNotTrack==="1")return;'+
    'var g=document.createElement("script");g.async=true;g.src="https://www.googletagmanager.com/gtag/js?id=G-1551Z7DJ2C";document.head.appendChild(g);'+
    'window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};'+
    'window.gtag("js",new Date());window.gtag("config","G-1551Z7DJ2C");'+
    '})();</script>';
  const css='<style>body{margin:0;color:#152033;background:#f8fafc;font-family:Tahoma,Arial,sans-serif;line-height:1.8}header{background:#111827;color:white;padding:20px 4%}header a{color:#fff;margin-inline-end:20px}main{max-width:950px;margin:26px auto;padding:22px;background:white;border-radius:14px}a{color:#4032a2}article img,article svg{max-width:100%;height:auto}.card>a img{width:100%;aspect-ratio:1200/760;object-fit:cover;border-radius:10px}.featured{margin:12px 0 28px}.featured figcaption{color:#475569;font-size:14px}.related{border-top:1px solid #e2e8f0;margin-top:32px;padding-top:18px}.related-links{display:flex;gap:12px;flex-wrap:wrap}.related-links a{display:inline-block;background:#fffbea;padding:8px 12px;border-radius:10px}.cards{display:grid;gap:12px}.card{padding:18px;border:1px solid #eee;border-radius:12px}.pager{display:flex;gap:14px;justify-content:center;margin:30px 0}.pager a{padding:8px 12px;background:#eee;border-radius:8px}footer{margin:35px auto;padding:15px;max-width:950px;color:#475569}@media(max-width:640px){main{margin:0;border-radius:0;padding:16px}}</style>';
  const isEnglish=String(lang).toLowerCase().startsWith('en');
  const menu=isEnglish?'<a href="/">Home</a><a href="/blog">Blog</a><a href="/blog/archive/english">English Guides</a><a href="/saudi">Saudi Arabia</a><a href="/uae">UAE</a>':'<a href="/">الرئيسية</a><a href="/blog">المدونة</a><a href="/blog/saudi">مقالات السعودية</a><a href="/blog/uae">مقالات الإمارات</a><a href="/blog/archive/all">كل المقالات</a>';
  const disclaimer=isEnglish?'Independent guide. Verify each coupon against your Noon checkout total.':'محتوى مستقل. تحقق من صلاحية الكود داخل سلة نون قبل الدفع.';
  return '<!doctype html><html lang="'+lang+'" dir="'+dir+'"><head>'+header+css+analytics+'</head><body><header><nav>'+menu+'</nav></header><main>'+content+'</main><footer>'+disclaimer+'</footer></body></html>';
}
function response(title,content,opts={},status=200){return new Response(page(title,content,opts),{status,headers:htmlHeaders})}
function link(a){const slug=String(a.slug||'');return (slug.startsWith('en-')?'/en/articles/':'/articles/')+encodeURI(slug)}
function cards(rows){
  return '<section class="cards">'+rows.map(a=>{
    const title=String(a.title||a.slug||'').replace(/[-_]/g,' '),country=marketOf(a),slug=String(a.slug||'');
    const date=dateIso(a.publishedAt||a.createdAt||a.updatedAt);
    return '<article class="card"><a href="'+esc(link(a))+'">'+imgTag(slug,country,primaryCodeForMarket(country),1,title)+'</a><small>'+esc(country==='AE'?'الإمارات':'السعودية')+'</small><h2><a href="'+esc(link(a))+'">'+esc(title)+'</a></h2><p>'+esc(String(a.metaDescription||'').slice(0,170))+'</p>'+(date?'<time datetime="'+esc(date)+'">'+esc(dateLabel(date))+'</time>':'')+'</article>';
  }).join('')+'</section>';
}
function nav(previous,next,label){
  return '<nav class="pager">'+(previous?'<a href="'+esc(previous)+'">السابق</a>':'')+'<span>'+esc(label)+'</span>'+(next?'<a href="'+esc(next)+'">التالي</a>':'')+'</nav>';
}
function xmlVal(xml,name){const match=xml.match(new RegExp('<(?:[a-z0-9]+:)?'+name+'>([\\s\\S]*?)<\\/(?:[a-z0-9]+:)?'+name+'>','i'));return match?match[1]:''}
function decodeXml(s){return String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
async function listArticlePage(env,token){
  const params={'list-type':'2','max-keys':'15','prefix':'articles/','encoding-type':'url'};
  if(token)params['continuation-token']=token;
  const r=await rescueSignedReadBounded(env,'',params);
  if(!r.ok)throw new Error('rescue_r2_list_status_'+r.status);
  const xml=await r.text(),matches=[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];
  const keys=matches.map(x=>decodeXml(xmlVal(x[1],'Key'))).map(k=>{try{return decodeURIComponent(k)}catch{return k}}).filter(k=>k.endsWith('.html'));
  return {keys,more:xmlVal(xml,'IsTruncated')==='true',token:decodeXml(xmlVal(xml,'NextContinuationToken'))};
}
function cleanText(html){return String(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
function codeFromBody(body){return (body.match(/\b(?:NOV|RAMY)\d{2,3}\b/i)||[])[0]||''}
// Source article content can carry its own Article node inside an @graph
// (alongside FAQPage/BreadcrumbList). Keep these supporting nodes while
// allowing exactly one Article entity with the visible rescue cover/canonical.
export function removeRedundantSourceArticleJsonLd(content){
  return String(content||'').replace(/<script\b([^>]*\btype=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,(full,attrs,body)=>{
    let parsed;
    try{parsed=JSON.parse(body)}catch{return full}
    const isArticle=node=>node&&typeof node==='object'&&(Array.isArray(node['@type'])?node['@type'].some(x=>x==='Article'||x==='BlogPosting'):node['@type']==='Article'||node['@type']==='BlogPosting');
    const filtered=Array.isArray(parsed)
      ?parsed.filter(node=>!isArticle(node)).map(node=>(node&&Array.isArray(node['@graph']))?{...node,'@graph':node['@graph'].filter(x=>!isArticle(x))}:node)
      :isArticle(parsed)?null
      :parsed&&Array.isArray(parsed['@graph'])?{...parsed,'@graph':parsed['@graph'].filter(x=>!isArticle(x))}
      :parsed;
    if(!filtered||(Array.isArray(filtered)&&!filtered.length))return '';
    if(!Array.isArray(filtered)&&Array.isArray(filtered['@graph'])&&!filtered['@graph'].length)return '';
    if(JSON.stringify(filtered)===JSON.stringify(parsed))return full;
    return '<script '+attrs+'>'+JSON.stringify(filtered).replace(/</g,'\\u003c')+'</script>';
  });
}
// Native R2 article bodies may already contain Article JSON-LD without a
// publication date, despite verified metadata powering the visible <time>.
// Align source Article schema with that metadata without making a second
// Article node, inventing an update, or rewriting stored R2. FAQ stays intact.
export function supplementNativeArticleJsonLd(html,{publishedAt=null,modifiedAt=null,canonical='',description=null}={}){
 const source=String(html??''),published=dateIso(publishedAt);
 if(!published||!source.includes('application/ld+json'))return source;
 const modified=dateIso(modifiedAt);
 return source.replace(/<script\b([^>]*\btype=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,(full,attrs,body)=>{
   let record;
   try{record=JSON.parse(body)}catch{return full}
   let changed=false;
   const edit=node=>{
     if(!node||typeof node!=='object'||Array.isArray(node))return node;
     const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
     const article=types.includes('Article')||types.includes('BlogPosting');
     const patch={};
     if(article){
       if(!node.datePublished)patch.datePublished=published;
       if(!node.mainEntityOfPage&&canonical)patch.mainEntityOfPage=canonical;
       if(description&&node.description!==description)patch.description=description;
       if(modified&&!node.dateModified)patch.dateModified=modified;
     }
     let next=Object.keys(patch).length?{...node,...patch}:node;
     if(Object.keys(patch).length)changed=true;
     if(Array.isArray(next['@graph'])){
       const graph=next['@graph'].map(edit);
       if(graph.some((value,i)=>value!==next['@graph'][i]))next={...next,'@graph':graph};
     }
     return next;
   };
   const next=Array.isArray(record)?record.map(edit):edit(record);
   return changed?'<script'+attrs+'>'+JSON.stringify(next).replace(/</g,'\\u003c')+'</script>':full;
 });
}
// CPU-bounded read path for the exact articles already approved and written by
// the native Gemini/Groq publisher. It never modifies R2, coupon or approval.
// Legacy articles still use the full (slower) conversion pipeline below.
export function renderApprovedNativeAiV2Fast(obj,slug,u,english){
 const md=obj?.meta||{},country=english?'AE':String(md.c||'').toUpperCase()==='AE'?'AE':'SA';
 const code=country==='AE'?'NOV188':'NOV170';
 if(md.p!=='ai-v2-native'||md.status!=='published'||md.c!==country||
    md.cp!==code||Number(md.q)<95||Number(md.w)<1500)return null;
 // Do not parse or rewrite large legacy HTML in a fast-path eligibility check.
 // Archived articles use the legacy renderer below; this prevents two costly
 // full-body passes on every request and keeps R2 bytes untouched.
 let source=repairLegacyGuideLinks(repairArchivedProductCategoryHtml(neutralizeUnverifiedEditorialReview(refreshArtworkUrlsInHtml(refreshLiveTemporalArticleHtml(String(obj?.body||''),{english}).html)),slug,english),country);
 if(
    source.length<4000||source.length>240000||!source.includes(code)||
    !/<article\b/i.test(source)||!/<h1\b/i.test(source))return null;
 const fromMeta=decodeNativeMetadataText;
 // Publisher stores title and description as URL-encoded R2 custom metadata.
 // Avoid running multiple full-document HTML regex passes on each public hit.
 const title=fromMeta(md.t).slice(0,180);
 const originalDescription=nativeMetaDescription(md.m,source);
 const truncated=originalDescription.endsWith('…')||(originalDescription.length>=155&&!/[.!؟]$/u.test(originalDescription));
 const recovered=truncated?nativeCompleteSearchSnippet(source,title,english):null;
 const description=recovered||originalDescription;
 if(title.length<8||description.length<20)return null;
 const snippet=rescueGscSnippet(slug,title,description,english);
 const canonical='https://noondealsnow.com'+u.pathname;
 const featured='https://noondealsnow.com'+rescueImageUrl(slug,country,code,1,title);
 const figure='<figure class="featured">'+imgTag(slug,country,code,1,title)+'</figure>';
 const published=dateIso(md.at);
 const modified=verifiedEditorialModifiedAt(md,published);
 source=supplementNativeArticleJsonLd(source,{publishedAt:published,modifiedAt:modified,canonical,description:recovered});
 const publishTime=visibleEditorialDates(published,modified,english);
 const contents=figure+publishTime+'<article class="rescue-article" data-market="'+country+'">'+
   renderCouponAction(country,english,'top')+source+
   renderCouponAction(country,english,'bottom')+'</article>'+
   topicLinks(country,english)+rescueCopyScript;
 let html=page(snippet.title,contents,{lang:english?'en-AE':country==='AE'?'ar-AE':'ar-SA',
   dir:english?'ltr':'rtl',canonical,description:snippet.description,robots:'index,follow,max-image-preview:large'});
 const extras=rescueArticleStyles+'<meta property="og:type" content="article"><meta property="og:title" content="'+
  esc(snippet.title)+'"><meta property="og:description" content="'+esc(snippet.description)+'"><meta property="og:image" content="'+
  esc(featured)+'"><meta property="og:image:width" content="1600"><meta property="og:image:height" content="1000"><meta name="twitter:card" content="summary_large_image">'+
  (published?'<meta property="article:published_time" content="'+esc(published)+'">':'')+
  (modified?'<meta property="article:modified_time" content="'+esc(modified)+'">':'')+
  (english?'<link rel="alternate" hreflang="en-AE" href="'+esc(canonical)+'">':'');
 html=html.replace('</head>',extras+'</head>');
 return new Response(html,{headers:{...htmlHeaders,'x-r2-rescue-object':'articles',
  'x-native-article-renderer':'approved-fast-v1','content-language':english?'en':'ar'}});
}
// New-account production already binds the exact same R2 bucket natively and
// deliberately DISABLES the old rescue router. Only approved native AI V2
// articles use this read-only fast path; legacy pages stay on their current
// rendering contract, untouched. Never enumerate R2 or alter its objects.
export async function nativeBoundAiV2ArticleFastResponse(req,env){
 if(req.method!=='GET'||String(env?.R2_RESCUE_READONLY_ENABLED||'')!=='false'||
    typeof env?.CONTENT_FINAL?.get!=='function')return null;
 const u=new URL(req.url),p=u.pathname.replace(/\/+$/,'');
 const hit=p.match(/^\/articles\/((saudi|uae)-buyer-[a-z0-9-]+-(nov170|nov188)-2026-n(?:[5-9]|10|11))$/);
 if(!hit)return null;
 const slug=hit[1],market=hit[2],coupon=hit[3].toUpperCase();
 if((market==='saudi'&&coupon!=='NOV170')||(market==='uae'&&coupon!=='NOV188'))return null;
 try{
   const article=await env.CONTENT_FINAL.get('articles/'+slug+'.html');
   // A confirmed R2 miss for an approved N5-N11 URL is a definite 404.
   // Do not fall through into the CPU-heavy legacy renderer (intermittent
   // Cloudflare 1102/503 on duplicate prechecks). Never cache the 404:
   // the exact article can be published safely a moment later.
   if(!article)return new Response('Not Found',{status:404,headers:{
     'cache-control':'no-store','x-native-article-absence':'r2-confirmed-v1'
   }});
   if(article.customMetadata?.p!=='ai-v2-native'||
      article.customMetadata?.status!=='published')return null;
   // One native R2 get, no remote S3 signing, list(), or generated AI call.
   const body=await article.text();
   const output=renderApprovedNativeAiV2Fast({body,meta:article.customMetadata},
     slug,u,market==='uae');
   return output||null;
 }catch(error){
   console.warn('native_r2_article_fast_read_deferred',
     String(error?.message||error).slice(0,70));
   return null; // Keep the original live legacy route as safe fallback.
 }
}

async function serveArticle(env,u,english){
  const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
  if(!slug||slug.length>280||slug.includes('/')||slug.includes('..'))return new Response('Not Found',{status:404});
  const obj=await getObject(env,'articles/'+slug+'.html');
  if(!obj)return new Response('Not Found',{status:404,headers:{'cache-control':'public,max-age=60'}});
  if(obj.meta.status&&obj.meta.status!=='published')return new Response('Not Found',{status:404});
  const scheduled=dateIso(obj.meta.scheduledAt||obj.meta.scheduled_at);
  const publication=dateIso(obj.meta.publishedAt||obj.meta.datePublished||obj.meta.at);
  if((scheduled&&Date.parse(scheduled)>Date.now())||(publication&&Date.parse(publication)>Date.now()))
    return new Response('Not Found',{status:404,headers:{'cache-control':'no-store'}});
  const fast=renderApprovedNativeAiV2Fast(obj,slug,u,english);
  if(fast)return fast;
  const country=english?'AE':marketOf({country:obj.meta.c||obj.meta.country,slug});
  const source=localizeLegacySiteNavigation(unwrapLegacyArticleDocument(obj.body),slug,country);
  let body=refreshArtworkUrlsInHtml(refreshLiveTemporalArticleHtml(repairGenericNoonLinks(repairLegacyGuideLinks(reconcileSourceCouponJsonLd(presentMarketCouponText(removeRedundantSourceArticleJsonLd(source),country),country,null,english),country),country,english),{english}).html);
  body=clarifyAuditedEnglishConsoleLaptopPage(repairLegacyArabicBlueprintText(repairAuditedLegacyBuyerGuidance(tidyLegacyArabicH1(normalizeArabicUaeMentions(repairArchivedProductCategoryHtml(neutralizeUnverifiedEditorialReview(body),slug,english),country,english),english),slug,country,english),slug,country,english),slug,country,english);
  const match=body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i),title=cleanText(match?match[1]:slug.replace(/[-_]/g,' ')).slice(0,180);
  const description=(english?nativeCompleteSearchSnippet(body,title,true):legacyDirectAnswerSnippet(body,title,false))||readableMetaDescription(cleanText(body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,''))),code=primaryCodeForMarket(country),canonical='https://noondealsnow.com'+u.pathname;
  const snippet=rescueGscSnippet(slug,title,description,english);
  const featured='https://noondealsnow.com'+rescueImageUrl(slug,country,code,1,title);
  const date=dateIso(obj.meta.publishedAt||obj.meta.createdAt||obj.meta.datePublished||obj.meta.at);
  const modified=verifiedEditorialModifiedAt(obj.meta,date);
  const meta={'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:english?'en':'ar',mainEntityOfPage:canonical,image:[featured],author:{'@type':'Organization',name:'Noon Deals Now editorial team',url:'https://noondealsnow.com/authors/editorial-team'},publisher:{'@type':'Organization',name:'Noon Deals Now',url:'https://noondealsnow.com'},...(date?{datePublished:date}:{}),...(modified?{dateModified:modified}:{})};
  // The source's legacy text-only coupon box did not expose a copy action.
  // Keep original R2 bytes unchanged; present a verified market-locked primary code in the reader.
  const schema='<script type="application/ld+json">'+JSON.stringify(meta).replace(/</g,'\\u003c')+'</script>';
  const figure='<figure class="featured">'+imgTag(slug,country,code,1,title)+'<figcaption>'+esc(english?'Noon shopping guide. Verify coupon eligibility at checkout.':'دليل كوبونات نون — تحقّق من أهلية الكود عند الدفع.')+'</figcaption></figure>';
  const publishTime=visibleEditorialDates(date,modified,english);
  const extras=topicLinks(country,english);
  // The legacy two-entry English baseline remains visible through R2 rescue.
  // Preserve its language, market alternatives and canary contract when serving
  // those ORIGINAL URLs. This does not alter publication status or source HTML.
  const originalEnglishBaseline=english&&(slug==='en-skincare-noon-uae-shopping-guide-coupon-today'||slug==='en-noon-coupon-dubai');
  const languageAlternates=english?'<link rel="alternate" hreflang="en-AE" href="'+esc(canonical)+'"><link rel="alternate" hreflang="x-default" href="'+esc(canonical)+'">':'';
  // Keep source article body and original slugs, but restore its cover and cross-links.
  let related='';
  // Read the already-existing 300-item journal only; never list 150k+ objects
  // or create new storage. If unavailable, the stable market/topic links still work.
  try{const live=await getJson(env,'blog/latest-live-v1.json');related=renderRelatedArticles(live?.articles,slug,country,english)}catch(error){console.warn('related_articles_feed_unavailable',String(error?.message||error).slice(0,80))}
  const topOffer=renderCouponAction(country,english,'top'),bottomOffer=renderCouponAction(country,english,'bottom');
  const mobileOffer='<div class="rescue-mobile-offer" data-market="'+country+'">'+renderCouponAction(country,english,'mobile')+'</div>';
  const contents=schema+figure+publishTime+'<article class="rescue-article" data-market="'+country+'">'+topOffer+body+bottomOffer+related+'</article>'+extras+mobileOffer+rescueCopyScript;
  let html=page(snippet.title,contents,{lang:english?'en-AE':country==='AE'?'ar-AE':'ar-SA',dir:english?'ltr':'rtl',canonical,description:snippet.description,robots:'index,follow,max-image-preview:large'});
  html=html.replace('</head>',rescueArticleStyles+'</head>');
  if(languageAlternates)html=html.replace('</head>',languageAlternates+'</head>');
  html=html.replace('</head>','<meta property="og:type" content="article"><meta property="og:title" content="'+esc(snippet.title)+'"><meta property="og:description" content="'+esc(snippet.description)+'"><meta property="og:image" content="'+esc(featured)+'"><meta property="og:image:width" content="1600"><meta property="og:image:height" content="1000"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="'+esc(featured)+'">'+(date?'<meta property="article:published_time" content="'+esc(date)+'">':'')+(modified?'<meta property="article:modified_time" content="'+esc(modified)+'">':'')+'</head>');
  return new Response(html,{headers:{...htmlHeaders,'x-r2-rescue-object':'articles','content-language':english?'en':'ar',...(originalEnglishBaseline?{'x-english-canary':'v1'}:{})}});
}
function rescueIntentGroup(intent){
  if(['decision','smartbuy','budget','checklist'].includes(intent))return 'buying';
  if(['trouble','eligibility','howto','question','timing','coupon'].includes(intent))return 'coupon';
  if(['compare','finalprice','value','cart','multi'].includes(intent))return 'price';
  if(['returns','warranty','seller'].includes(intent))return 'trust';
  return 'other';
}
async function serveBlog(env,u){
  const countryParam=u.searchParams.get('market');
  const market=u.pathname.endsWith('/saudi')?'SA':u.pathname.endsWith('/uae')?'AE':/^(SA|AE)$/.test(countryParam||'')?countryParam:null;
  const topic=['buying','coupon','price','trust'].includes(u.searchParams.get('topic')||'')?u.searchParams.get('topic'):'';
  // The bulk/latest.json snapshot can be older than the latest legacy publisher.
  // The live ControlPlane publishes Arabic articles independently of bulk catalogs.
  // Merge its already-published, canonical articles without rewriting the R2 index.
  let legacy=[];
  if(env.CONTROL?.idFromName&&env.CONTROL?.get){
    try{
      const id=env.CONTROL.idFromName('primary');
      const result=await env.CONTROL.get(id).fetch('https://control.internal/state');
      if(result.ok){
        const state=await result.json();
        legacy=Array.isArray(state?.articles)?state.articles.filter(a=>a?.status==='published'):[];
      }
    }catch(error){console.warn('live_blog_control_state_unavailable',String(error?.message||error).slice(0,100))}
  }
  const [data,live]=await Promise.all([
    getJson(env,'bulk/latest.json'),
    getJson(env,'blog/latest-live-v1.json').catch(error=>{
      console.warn('recent_blog_feed_unavailable',String(error?.message||error).slice(0,90));
      return null;
    })
  ]);
  const seen=new Set(),rows=[];
  for(const item of [...(live?.articles||[]),...legacy,...(data?.articles||[])]){
    if(!item?.slug||seen.has(item.slug)||item.status==='draft'||item.status==='scheduled'||item.indexable===false||item.slug.startsWith('en-')||market&&item.country!==market||topic&&rescueIntentGroup(item.intent)!==topic)continue;
    seen.add(item.slug);rows.push(item);
  }
  rows.sort((a,b)=>String(b.publishedAt||b.createdAt||b.updatedAt||'').localeCompare(String(a.publishedAt||a.createdAt||a.updatedAt||'')));
  const size=15,pages=Math.max(1,Math.ceil(rows.length/size)),pageNum=Math.max(1,Math.min(pages,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
  const visible=rows.slice((pageNum-1)*size,pageNum*size);
  const path=market==='SA'?'/blog/saudi':market==='AE'?'/blog/uae':'/blog';
  const heading=market==='SA'?'مدونة نون السعودية':market==='AE'?'مدونة نون الإمارات':'مدونة كوبونات نون';
  const tabs='<nav class="related-links" aria-label="أقسام المدونة"><a href="/blog">كل المقالات</a><a href="/blog/saudi">السعودية</a><a href="/blog/uae">الإمارات</a><a href="/blog/archive/english">English UAE</a><a href="/blog/archive/all">الأرشيف الكامل</a><a href="/blog/archive">فهرس المقالات القديمة</a></nav>';
  const filtersUrl=(m,t)=>{const q=new URLSearchParams();if(m)q.set('market',m);if(t)q.set('topic',t);return '/blog'+(q.toString()?'?'+q.toString():'')};
  const filters='<section id="premium-blog-browser" aria-label="فلترة المدونة"><h2>اختر الدولة ونوع الدليل</h2><nav class="related-links" aria-label="تصفية حسب الدولة">'+[['','كل الدول'],['SA','السعودية'],['AE','الإمارات']].map(([m,label])=>'<a href="'+filtersUrl(m,topic)+'"'+((market||'')===m?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav><nav class="related-links" aria-label="تصفية حسب موضوع المقال">'+[['','كل الأهداف'],['buying','أدلة شراء'],['coupon','مشاكل الكوبون'],['price','السعر والسلة'],['trust','الإرجاع والبائع']].map(([t,label])=>'<a href="'+filtersUrl(market,t)+'"'+(topic===t?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav></section>';
  const hint='<h1>'+esc(heading)+'</h1><p>مقالات وأدلة شرائية مرتبطة بكوبونات نون، مع ضرورة مراجعة أهلية الكود والسعر النهائي داخل السلة.</p>'+tabs+filters;
  const pageUrl='https://noondealsnow.com'+path+(pageNum>1?'?page='+pageNum:'');
  const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',name:heading,url:pageUrl,inLanguage:'ar'},{'@type':'ItemList',itemListElement:visible.map((a,i)=>({'@type':'ListItem',position:i+1+(pageNum-1)*size,url:'https://noondealsnow.com'+link(a)}))}]}).replace(/</g,'\\u003c')+'</script>';
  const filtered=u.searchParams.has('market')||u.searchParams.has('topic');
  const pageLink=n=>{const q=new URLSearchParams();if(u.searchParams.has('market')&&market)q.set('market',market);if(topic)q.set('topic',topic);if(n>1)q.set('page',String(n));return path+(q.toString()?'?'+q.toString():'')};
  const result=response(heading,schema+hint+cards(visible)+(visible.length?'':'<p>لا توجد مقالات مطابقة لهذه الفلاتر في أحدث قائمة.</p>')+nav(pageNum>1?pageLink(pageNum-1):'',pageNum<pages?pageLink(pageNum+1):'','صفحة '+pageNum+' من '+pages),{canonical:filtered?'https://noondealsnow.com'+path:pageUrl,robots:filtered?'noindex,follow':'index,follow',image:visible[0]?'https://noondealsnow.com'+rescueImageUrl(visible[0].slug,marketOf(visible[0]),primaryCodeForMarket(marketOf(visible[0])),1):''});
  if(!filtered)return result;
  const headers=new Headers(result.headers);headers.set('x-robots-tag','noindex, follow');
  return new Response(result.body,{status:result.status,headers});
}
async function serveEnglishArchive(env,u){
  // Use the already quality-checked 21k English UAE manifest; never HEAD each article.
  const index=await getJson(env,'seo-rescue/index.json'),parts=index?.englishSegments||[],count=Number(index?.englishCount||0),size=15;
  if(!parts.length||count<1)return response('English Noon UAE Guides','<h1>English guides are temporarily unavailable.</h1><p><a href="/blog">Open the main blog</a></p>',{lang:'en',dir:'ltr',robots:'noindex,follow'},503);
  const pages=Math.ceil(count/size),pageNum=Math.max(1,Math.min(pages,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
  const start=(pageNum-1)*size,end=Math.min(count,start+size),first=Math.floor(start/2000),last=Math.floor((end-1)/2000),rows=[];
  for(let n=first;n<=last;n++){
    const part=parts.find(x=>x.n===n);
    if(!part)return new Response('Archive segment unavailable',{status:503});
    const segment=await getJson(env,part.key);
    if(!segment||!Array.isArray(segment.articles))return new Response('Archive data unavailable',{status:503});
    const offset=n*2000;
    for(let i=Math.max(0,start-offset);i<Math.min(segment.articles.length,end-offset);i++)rows.push(segment.articles[i]);
  }
  const cardsHtml=rows.map(a=>{
    const slug=String(a.slug||'');if(!slug.startsWith('en-'))return '';
    const title=slug.slice(3).replace(/-/g,' ').replace(/\bnoon\b/gi,'Noon');
    const href='/en/articles/'+encodeURI(slug);
    return '<article class="card" dir="ltr"><a href="'+esc(href)+'">'+imgTag(slug,'AE',primaryCodeForMarket('AE'),1,title)+'</a><h2><a href="'+esc(href)+'">'+esc(title)+'</a></h2><small>Noon UAE guide · '+esc(a.lastmod||'')+'</small></article>';
  }).join('');
  const path='/blog/archive/english',url='https://noondealsnow.com'+path+(pageNum>1?'?page='+pageNum:'');
  const heading='<h1>Noon UAE English Shopping Guides</h1><p>Browse '+count.toLocaleString('en-US')+' published UAE shopping guides, alphabetically, 15 per page. Check each coupon against your final Noon cart total.</p><nav class="related-links"><a href="/blog">Arabic blog</a><a href="/blog/uae">UAE Arabic articles</a><a href="/uae">UAE store hub</a><a href="/blog/archive/english">Browse all English guides</a></nav>';
  return response('Noon UAE English Guides',heading+'<section class="cards">'+cardsHtml+'</section>'+nav(pageNum>1?path+'?page='+(pageNum-1):'',pageNum<pages?path+'?page='+(pageNum+1):'','Page '+pageNum+' of '+pages),{canonical:url,robots:'noindex,follow',lang:'en',dir:'ltr'});
}


// A bounded 100-link English archive index uses the existing verified
// English R2 manifests. It does not enumerate individual R2 objects.
const ENGLISH_CATALOG_SIZE=100;
const englishCatalogUrl=n=>'/blog/archive/english/catalog'+(n>1?'/'+n:'');
function englishCatalogCount(index){
  if(index?.version!==1||!Array.isArray(index.englishSegments)||!index.englishSegments.length)return 0;
  const sum=index.englishSegments.reduce((x,p)=>x+Math.max(0,Number(p.count)||0),0);
  return Math.min(1000000,Math.max(0,Math.min(Number(index.englishCount)||sum,sum)));
}
async function serveEnglishCatalog(env,u){
  const index=await getJson(env,'seo-rescue/index.json'),count=englishCatalogCount(index);
  if(!count)return new Response('English archive index temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}});
  const match=u.pathname.match(/^\/blog\/archive\/english\/catalog(?:\/([1-9]\d{0,4}))?$/);
  const current=match?.[1]?Number(match[1]):1,pages=Math.ceil(count/ENGLISH_CATALOG_SIZE);
  if(current>pages)return new Response('English archive page not found',{status:404,headers:{'cache-control':'public,max-age=60'}});
  const from=(current-1)*ENGLISH_CATALOG_SIZE,end=Math.min(count,from+ENGLISH_CATALOG_SIZE),first=Math.floor(from/2000),last=Math.floor((end-1)/2000),rows=[];
  for(let n=first;n<=last;n++){
    const shard=index.englishSegments.find(x=>x.n===n);
    if(!shard?.key)return new Response('English archive shard unavailable',{status:503,headers:{'cache-control':'no-store'}});
    const data=await getJson(env,shard.key);
    if(data?.version!==1||!Array.isArray(data.articles))return new Response('English archive data unavailable',{status:503,headers:{'cache-control':'no-store'}});
    const offset=n*2000;
    for(let i=Math.max(0,from-offset);i<Math.min(data.articles.length,end-offset);i++){
      const a=data.articles[i];
      if(a?.slug&&String(a.slug).startsWith('en-'))rows.push(a);
    }
  }
  const path=englishCatalogUrl(current),canonical='https://noondealsnow.com'+path,
    title='Noon UAE English Shopping Guide Directory — Page '+current;
  const links=rows.map(a=>{
    const slug=String(a.slug),href='/en/articles/'+encodeURIComponent(slug);
    const name=String(a.title||slug.slice(3).replace(/-/g,' ')).slice(0,180);
    return '<li><a href="'+esc(href)+'">'+esc(name)+'</a></li>';
  }).join('');
  const link=(n,label)=>'<a href="'+englishCatalogUrl(n)+'">'+label+'</a>';
  const paging='<nav class="archive-pagination" aria-label="Directory pages">'+
    (current>1?link(1,'First')+link(current-1,'Previous'):'')+
    '<strong>Page '+current.toLocaleString('en-US')+' of '+pages.toLocaleString('en-US')+'</strong>'+
    (current<pages?link(current+1,'Next')+link(pages,'Last'):'')+'</nav>';
  const css='<style>.archive-index{padding-left:1.5rem}.archive-index li{line-height:1.8;border-bottom:1px solid #e2e8f0;padding:.55rem 0}.archive-index a{color:#1558c0;text-decoration:underline;font-weight:600}.archive-index a:visited{color:#6b36ab}.archive-pagination{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:24px 0}.archive-pagination a{padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;color:#1558c0;text-decoration:underline}</style>';
  const json={'@context':'https://schema.org','@type':'CollectionPage',name:title,url:canonical,inLanguage:'en-AE',mainEntity:{'@type':'ItemList',itemListElement:rows.map((a,i)=>({'@type':'ListItem',position:from+i+1,url:'https://noondealsnow.com/en/articles/'+encodeURIComponent(a.slug)}))}};
  const schema='<script type="application/ld+json">'+JSON.stringify(json).replace(/</g,'\\u003c')+'</script>';
  const body=css+schema+'<h1>'+esc(title)+'</h1><p>Browse the restored Noon UAE English guide archive, 100 original article links per page. Confirm offer eligibility and final checkout totals at Noon. All article addresses remain unchanged.</p>'+
    '<p><a href="/blog/archive/english">English guide cards</a> · <a href="/blog/uae">UAE Arabic</a> · <a href="/uae">Noon UAE</a></p>'+
    paging+'<ol class="archive-index" start="'+(from+1)+'">'+links+'</ol>'+paging;
  return response(title,body,{lang:'en-AE',dir:'ltr',canonical,robots:'index,follow',description:'Noon UAE English shopping guide directory — page '+current+' of '+pages});
}
async function englishCatalogSitemap(env){
  const index=await getJson(env,'seo-rescue/index.json'),count=englishCatalogCount(index);
  if(!count)return new Response('English catalog unavailable',{status:503,headers:{'cache-control':'no-store'}});
  const pages=Math.ceil(count/ENGLISH_CATALOG_SIZE);
  return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
    Array.from({length:pages},(_,i)=>'<url><loc>https://noondealsnow.com'+englishCatalogUrl(i+1)+'</loc></url>').join('')+'</urlset>');
}

const CATALOG_PAGE_SIZE=100;
const CATALOG_SHARD_SIZE=2000;
const catalogUrl=pageNum=>'/blog/archive/catalog'+(pageNum>1?'/'+pageNum:'');
function catalogSize(index){
  const parts=Array.isArray(index?.segments)?index.segments:[];
  if(index?.version!==1||!parts.length)return 0;
  return Math.max(0,Math.min(1000000,Number(index.count)||parts.reduce((sum,x)=>sum+Math.max(0,Number(x.count)||0),0)));
}
async function serveCatalog(env,u){
  const index=await getJson(env,'seo-rescue/index.json'),count=catalogSize(index);
  if(!count)return new Response('Catalog index temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}});
  const match=u.pathname.match(/^\/blog\/archive\/catalog(?:\/([1-9]\d{0,4}))?$/);
  const pageNum=match?.[1]?Number(match[1]):1,pages=Math.ceil(count/CATALOG_PAGE_SIZE);
  if(pageNum>pages)return new Response('Archive page not found',{status:404,headers:{'cache-control':'public,max-age=60'}});
  const from=(pageNum-1)*CATALOG_PAGE_SIZE,to=Math.min(count,from+CATALOG_PAGE_SIZE),first=Math.floor(from/CATALOG_SHARD_SIZE),last=Math.floor((to-1)/CATALOG_SHARD_SIZE),rows=[];
  for(let n=first;n<=last;n++){
    const part=index.segments.find(item=>item.n===n);
    if(!part?.key)return new Response('Catalog shard unavailable',{status:503,headers:{'cache-control':'no-store'}});
    const file=await getJson(env,part.key);
    if(file?.version!==1||!Array.isArray(file.articles))return new Response('Catalog data unavailable',{status:503,headers:{'cache-control':'no-store'}});
    const offset=n*CATALOG_SHARD_SIZE;
    for(let i=Math.max(0,from-offset);i<Math.min(file.articles.length,to-offset);i++){
      const a=file.articles[i];
      if(a?.slug&&!String(a.slug).startsWith('en-'))rows.push(a);
    }
  }
  const path=catalogUrl(pageNum),canonical='https://noondealsnow.com'+path;
  const links=rows.map(a=>{
    const slug=String(a.slug),market=a.country==='AE'?'الإمارات':'السعودية';
    const title=String(a.title||slug).replace(/[-_]+/g,' ').slice(0,180),href='/articles/'+encodeURIComponent(slug);
    return '<li><a href="'+esc(href)+'">'+esc(title)+'</a> <small>· نون '+market+'</small></li>';
  }).join('');
  const navLink=(n,label)=>'<a href="'+catalogUrl(n)+'">'+label+'</a>';
  const pagination='<nav class="archive-pagination" aria-label="صفحات الأرشيف">'+
    (pageNum>1?navLink(1,'أول صفحة')+navLink(pageNum-1,'السابق'):'')+
    '<strong>صفحة '+pageNum.toLocaleString('ar-EG')+' من '+pages.toLocaleString('ar-EG')+'</strong>'+
    (pageNum<pages?navLink(pageNum+1,'التالي')+navLink(pages,'آخر صفحة'):'')+'</nav>';
  const title='فهرس مقالات كوبونات نون القديمة — صفحة '+pageNum;
  const css='<style>.archive-index{padding-inline-start:1.8rem}.archive-index li{line-height:1.8;padding:.6rem 0;border-bottom:1px solid #e2e8f0}.archive-index a{color:#1558c0;text-decoration:underline;text-underline-offset:3px;font-weight:600}.archive-index a:visited{color:#6b36ab}.archive-index small{color:#475569}.archive-pagination{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:25px 0}.archive-pagination a{padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;color:#1558c0;text-decoration:underline}.archive-pagination strong{padding:7px}</style>';
  const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:title,url:canonical,mainEntity:{'@type':'ItemList',itemListElement:rows.map((a,i)=>({'@type':'ListItem',position:from+i+1,url:'https://noondealsnow.com/articles/'+encodeURIComponent(a.slug)}))}}).replace(/</g,'\\u003c')+'</script>';
  return response(title,css+schema+'<h1>'+esc(title)+'</h1><p>روابط مباشرة للمقالات الأصلية في فهرس الأرشيف المستعاد من R2؛ 100 مقال في الصفحة. لا يغيّر هذا الفهرس رابط المقال أو محتواه.</p><p><a href="/blog">أحدث المقالات</a> · <a href="/blog/saudi">السعودية</a> · <a href="/blog/uae">الإمارات</a> · <a href="/blog/archive/english">الأرشيف الإنجليزي</a></p>'+pagination+'<ol class="archive-index" start="'+(from+1)+'">'+links+'</ol>'+pagination,{canonical,description:'تصفح روابط مقالات كوبونات نون القديمة في السعودية والإمارات — صفحة '+pageNum+' من '+pages,robots:'index,follow'});
}
async function catalogSitemap(env){
  const index=await getJson(env,'seo-rescue/index.json'),count=catalogSize(index);
  if(!count)return new Response('Catalog index temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}});
  const pages=Math.ceil(count/CATALOG_PAGE_SIZE),xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
    Array.from({length:pages},(_,i)=>'<url><loc>https://noondealsnow.com'+catalogUrl(i+1)+'</loc></url>').join('')+'</urlset>';
  return xmlResponse(xml);
}

async function serveAll(env,u){
  const cursor=u.searchParams.get('cursor')||'';
  if(cursor.length>1000)return new Response('Invalid cursor',{status:400});
  const rows=await listArticlePage(env,cursor);
  const cardsHtml=rows.keys.map(k=>{const slug=k.slice('articles/'.length,-5),en=slug.startsWith('en-'),country=marketOf({slug}),title=slug.replace(/[-_]/g,' ');return '<article class="card" dir="'+(en?'ltr':'rtl')+'"><a href="'+esc((en?'/en/articles/':'/articles/')+encodeURI(slug))+'">'+imgTag(slug,country,primaryCodeForMarket(country),1,title)+'</a><h2><a href="'+esc((en?'/en/articles/':'/articles/')+encodeURI(slug))+'">'+esc(title)+'</a></h2></article>'}).join('');
  let count='';
  try{const m=await getJson(env,'_ops/article-count.json');count=m?.count?'<p>آخر عد مؤكد لملفات المقالات: '+Number(m.count).toLocaleString('ar-EG')+'</p>':''}catch{}
  const next=rows.more&&rows.token?'/blog/archive/all?cursor='+encodeURIComponent(rows.token):'';
  return response('كل المقالات المحفوظة','<h1>كل المقالات المحفوظة</h1><p>أرشيف كامل قابل للتصفح، 15 مقالة في الصفحة، بدون تغيير الروابط القديمة. <a href="/blog/archive">فهرس المقالات القديمة</a>.</p>'+count+'<section class="cards">'+cardsHtml+'</section>'+nav('',next,'15 مقالة / صفحة'),{canonical:'https://noondealsnow.com/blog/archive/all',robots:'noindex,follow'});
}
async function serveDays(env){
  const m=await getJson(env,'bulk/days.json'),days=(m?.days||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.day||''));
  const rows=days.map(x=>'<article class="card"><a href="/blog/archive/'+encode(x.day)+'">'+esc(x.day)+'</a> · '+Number(x.count||0).toLocaleString('ar-EG')+' مقالة في فهرس اليوم</article>').join('');
  return response('أرشيف المقالات','<h1>أرشيف المقالات حسب التاريخ</h1><p><a href="/blog/archive/all">تصفح كل المقالات المحفوظة</a> · <a href="/blog">أحدث المقالات</a></p><section class="cards">'+rows+'</section>',{canonical:'https://noondealsnow.com/blog/archive'});
}
async function serveDay(env,u,day){
  const m=await getJson(env,'bulk/days.json'),row=(m?.days||[]).find(x=>x.day===day);
  if(!row)return response('أرشيف المقالات','<h1>أرشيف المقالات</h1><p>يمكنك تصفح <a href="/blog/archive/all">الأرشيف الكامل</a>.</p>',{},503);
  const total=Number(row.count||0),size=15,pageNum=Math.max(1,Number.parseInt(u.searchParams.get('page')||'1',10)||1),from=(pageNum-1)*size,to=Math.min(total,from+size),first=Math.floor(from/100),last=Math.floor(Math.max(from,to-1)/100),articles=[];
  for(let shard=first;shard<=last&&shard-first<3;shard++){
    const obj=await getJson(env,'bulk/day/'+day+'/'+shard+'.json');
    for(const [i,a] of (obj?.articles||[]).entries()){const index=shard*100+i;if(index>=from&&index<to&&a?.slug)articles.push(a)}
  }
  return response('مقالات '+day,'<h1>مقالات '+esc(day)+'</h1>'+cards(articles)+nav(pageNum>1?'/blog/archive/'+day+'?page='+(pageNum-1):'',to<total?'/blog/archive/'+day+'?page='+(pageNum+1):'','صفحة '+pageNum),{canonical:'https://noondealsnow.com/blog/archive/'+day});
}

const xmlSafe=s=>esc(String(s??''));
const sitemapHeaders={'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300,s-maxage=1800,stale-while-revalidate=3600','x-robots-tag':'all','x-r2-rescue-sitemap':'quality-gated-v1'};
const xmlResponse=xml=>new Response(xml,{headers:sitemapHeaders});
// The static rescue manifests are intentionally immutable. Newly published
// articles enter an already-existing, small R2 journal; surface them in their
// own sitemap so crawlers can discover them without a full 240k-object R2 LIST.
const liveSitemapEligible=a=>{
  const slug=String(a?.slug||'');
  const date=Date.parse(String(a?.publishedAt||a?.createdAt||''));
  return a?.status==='published'&&a?.indexable!==false&&
    slug.length>0&&slug.length<=280&&!slug.includes('/')&&!slug.includes('..')&&
    Number(a.quality)>=95&&(a.wordCount==null||Number(a.wordCount)>=1500)&&
    Number.isFinite(date)&&date<=Date.now()+60000;
};
async function liveRecentSitemap(env){
  const feed=await getJson(env,'blog/latest-live-v1.json');
  const seen=new Set(),rows=[];
  for(const item of (Array.isArray(feed?.articles)?feed.articles:[])){
    if(!liveSitemapEligible(item)||seen.has(item.slug))continue;
    seen.add(item.slug);rows.push(item);
    if(rows.length>=300)break;
  }
  const entries=rows.map(a=>{
    const loc=rescueArticleUrl(a),date=new Date(a.publishedAt||a.createdAt).toISOString();
    const img=rescueOrigin+rescueImageUrl(a.slug,marketOf(a),primaryCodeForMarket(marketOf(a)),1,a.title);
    return '<url><loc>'+xmlSafe(loc)+'</loc><lastmod>'+xmlSafe(date)+'</lastmod><image:image><image:loc>'+xmlSafe(img)+'</image:loc></image:image></url>';
  }).join('');
  const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+entries+'</urlset>';
  return new Response(xml,{headers:{...sitemapHeaders,'cache-control':'public,max-age=30,s-maxage=60,stale-while-revalidate=60','x-r2-rescue-sitemap':'live-recent-v1','x-sitemap-entries':String(rows.length)}});
}
const rescueOrigin='https://noondealsnow.com';
const rescueArticleUrl=a=>rescueOrigin+(a.slug.startsWith('en-')?'/en/articles/':'/articles/')+encodeURIComponent(a.slug);
const sitemapPathNum=p=>{const match=p.match(/^\/sitemap-rescue-(english-images|english|articles|images)-([0-9]{1,4})\.xml$/);return match?{kind:match[1],n:Number(match[2])}:null};
// Immutable 2k-URL rescue shards are expensive to rebuild on every cold
// Cloudflare edge miss. Keep at most four fully rendered, verified XML bodies
// per isolate for ten minutes. This is NOT a persistent storage or R2 write.
// Cache only successful generated XML, never a missing/failed segment.
const rescueXmlCache=new Map();
const RESCUE_XML_TTL_MS=10*60*1000;
// Keep immutable 2k-image XML (~1.6 MB) in isolate memory too, not just
// the smaller article XML. Four entries cap memory at <= 8.8 MB.
const RESCUE_XML_MAX_BYTES=2200000;
const RESCUE_XML_MAX_ENTRIES=4;
function rescueXmlCacheGet(path){
  const item=rescueXmlCache.get(path);
  if(!item)return null;
  if(item.expires<=Date.now()){rescueXmlCache.delete(path);return null}
  return item.xml;
}
function rescueXmlCachePut(path,xml){
  if(typeof xml!=='string'||xml.length>RESCUE_XML_MAX_BYTES)return;
  rescueXmlCache.delete(path);
  rescueXmlCache.set(path,{xml,expires:Date.now()+RESCUE_XML_TTL_MS});
  while(rescueXmlCache.size>RESCUE_XML_MAX_ENTRIES)
    rescueXmlCache.delete(rescueXmlCache.keys().next().value);
}


/** Cheap, read-only inventory summary. Manifest entries are *not* validated objects.
 * This makes their mismatch with DO publication counters explicit instead of
 * accidentally presenting an old R2 count as the present corpus total.
 */
export async function rescueManifestInventory(env){
  const index=await getJson(env,'seo-rescue/index.json');
  if(!index||index.version!==1)return {ok:false,reason:'rescue_manifest_unavailable'};
  const summary=parts=>{
    const rows=Array.isArray(parts)?parts:[];
    return {segments:rows.length,entries:rows.reduce((n,x)=>n+Math.max(0,Number(x.count)||0),0)};
  };
  const arabic=summary(index.segments),english=summary(index.englishSegments);
  const arabicClaim=Number(index.count||0),englishClaim=Number(index.englishCount||0);
  return {
    ok:arabic.segments>0&&english.segments>0,
    inventoryType:'R2 rescue manifest references, not confirmed live published URLs',
    arabic:{...arabic,declaredEntries:arabicClaim,countMatchesSegmentSum:arabicClaim===arabic.entries},
    english:{...english,declaredEntries:englishClaim,countMatchesSegmentSum:englishClaim===english.entries},
    declaredCombined:arabicClaim+englishClaim,
    limitations:['Entries may overlap the generator tracker; do not add these counts to it.','Individual R2 objects and their Google indexation have not been exhaustively verified.','No storage objects are listed, modified or deleted.']
  };
}

export async function rescueSitemapIndexPaths(env){
  const index=await getJson(env,'seo-rescue/index.json');
  if(!index||index.version!==1||!Array.isArray(index.segments)||!index.count)return [];
  const rows=[];
  for(const part of index.segments){
    if(!Number.isSafeInteger(part.n)||part.n<0||part.n>9999||!Number.isSafeInteger(part.count)||part.count<1)continue;
    rows.push('/sitemap-rescue-articles-'+part.n+'.xml','/sitemap-rescue-images-'+part.n+'.xml');
  }
  for(const part of (index.englishSegments||[])){
    if(!Number.isSafeInteger(part.n)||part.n<0||part.n>9999||!Number.isSafeInteger(part.count)||part.count<1)continue;
    rows.push('/sitemap-rescue-english-'+part.n+'.xml','/sitemap-rescue-english-images-'+part.n+'.xml');
  }
  if(catalogSize(index)>0)rows.push('/sitemap-rescue-catalog.xml');
  if(englishCatalogCount(index)>0)rows.push('/sitemap-rescue-english-catalog.xml');
  // Only advertise a live sitemap when the existing R2 feed has published, QA-approved entries.
  // Errors in the optional feed must never hide static rescue shards.
  try{const live=await getJson(env,'blog/latest-live-v1.json');if((live?.articles||[]).some(liveSitemapEligible))rows.push('/sitemap-live-recent.xml')}catch{}
  return rows;
}
// Stream only three independently prebuilt sitemap XML canaries; never
// re-serialize the 2,000 URL/image entries on a cold Cloudflare Worker request.
// The source JSON shard's current ETag must match the ETag captured when the
// XML was built on GitHub. Fail closed to the ORIGINAL renderer on any mismatch.
export async function prebuiltRescueSitemapResponse(path,env){
  const match=String(path||'').match(/^\/sitemap-rescue-(articles|images)-(\d{1,4})\.xml$/);
  if(!match||!env?.CONTENT_FINAL?.get||!env.CONTENT_FINAL?.head)return null;
  const kind=match[1],n=Number(match[2]);
  if(!((kind==='images'&&(n===9||n===25))||(kind==='articles'&&n===32)))return null;
  const key='seo-rescue/prebuilt-xml/'+kind+'-'+n+'.xml';
  try{
    const prebuilt=await env.CONTENT_FINAL.get(key);
    if(!prebuilt?.body)return null;
    const meta=prebuilt.customMetadata||{};
    const sourceTag=String(meta['source-etag']||'').replace(/^"|"$/g,'');
    if(!sourceTag||meta['generated-by']!=='geo-prebuilt-canary-v1')return null;
    const manifest=await getJson(env,'seo-rescue/index.json');
    if(manifest?.version!==1||!Array.isArray(manifest.segments))return null;
    const shard=manifest.segments.find(part=>part?.n===n);
    if(!shard?.key||meta['source-key']!==shard.key)return null;
    const current=await env.CONTENT_FINAL.head(shard.key);
    const currentTag=String(current?.etag||'').replace(/^"|"$/g,'');
    if(!currentTag||currentTag!==sourceTag)return null;
    // R2 streaming avoids constructing or transforming multi-MB XML strings.
    // Public cache retains canonical existing sitemap TTL and robots policy.
    return new Response(prebuilt.body,{headers:{
      ...sitemapHeaders,
      'x-r2-rescue-prebuilt':'etag-verified-v1',
      'cache-control':'public,max-age=300,s-maxage=86400,stale-while-revalidate=3600'
    }});
  }catch(error){
    console.warn('prebuilt_rescue_xml_fallback',String(error?.message||error).slice(0,80));
    return null;
  }
}

export async function rescueSitemapResponse(path,env){
  if(path==='/sitemap-live-recent.xml')return liveRecentSitemap(env);
  if(path==='/sitemap-rescue-catalog.xml')return catalogSitemap(env);
  if(path==='/sitemap-rescue-english-catalog.xml')return englishCatalogSitemap(env);
  const info=sitemapPathNum(path);
  if(!info&&path!=='/sitemap-images.xml'&&path!=='/sitemap-en-articles.xml')return null;
  // This branch does not read R2 or rebuild an 800KB+ XML document.
  const memoized=info?rescueXmlCacheGet(path):null;
  if(memoized!==null)return xmlResponse(memoized);
  const manifest=await getJson(env,'seo-rescue/index.json');
  if(!manifest||manifest.version!==1||!Array.isArray(manifest.segments))return null;
  const english=info?.kind?.startsWith('english')||path==='/sitemap-en-articles.xml';
  const groups=english?manifest.englishSegments:manifest.segments;
  if(!Array.isArray(groups)||groups.length<1)return null;
  const segment=info?groups.find(p=>p.n===info.n):groups[0];
  if(!segment)return new Response('Unknown sitemap segment',{status:404});
  const file=await getJson(env,segment.key);
  if(!file||file.version!==1||!Array.isArray(file.articles))return new Response('Missing sitemap data',{status:503});
  const image=info?.kind==='images'||info?.kind==='english-images'||path==='/sitemap-images.xml';
  const body=file.articles.map(a=>{
    const loc=rescueArticleUrl(a),date=a.lastmod?'<lastmod>'+xmlSafe(a.lastmod)+'</lastmod>':'';
    if(!image)return '<url><loc>'+xmlSafe(loc)+'</loc>'+date+'</url>';
    const img=rescueOrigin+rescueImageUrl(a.slug,a.country,primaryCodeForMarket(a.country),1,a.title);
    return '<url><loc>'+xmlSafe(loc)+'</loc><image:image><image:loc>'+xmlSafe(img)+'</image:loc></image:image></url>';
  }).join('');
  const ns=image?' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"':'';
  const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'+ns+'>'+body+'</urlset>';
  if(info)rescueXmlCachePut(path,xml);
  return xmlResponse(xml);
}
// Read-only canary for one canonical legacy article repeatedly returning Cloudflare
// 1102 on the new-account Worker. It takes the existing, already-shipped rescue
// renderer before the heavier brand/commerce/SEO decorating chain runs.
// Keep the original article slug and R2 object untouched; never widen this
// exact allowlist without comparing production responses and the CPU metrics.
export async function nativeBoundLegacyCpuCanaryResponse(req,env){
  if(req.method!=='GET'||req.headers.has('authorization')||
     String(env?.R2_RESCUE_READONLY_ENABLED||'')!=='false'||
     typeof env?.CONTENT_FINAL?.get!=='function')return null;
  const u=new URL(req.url);
  if(u.pathname!=='/en/articles/en-iphone-18-pro-max-noon-abu-dhabi-price')return null;
  try{
    const res=await serveArticle(env,u,true);
    if(!res?.ok)return res;
    const h=new Headers(res.headers);
    h.set('x-legacy-cpu-canary','r2-direct-v1');
    h.set('x-legacy-cpu-source','published-r2-existing');
    return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
  }catch(error){
    console.warn('legacy_cpu_canary_read_failed',
      String(error?.message||error).slice(0,80));
    return new Response('Article temporarily unavailable',{status:503,headers:{
      'cache-control':'no-store','retry-after':'120',
      'x-legacy-cpu-canary':'temporary-unavailable-v1'
    }});
  }
}

// The new-account production Worker uses its native R2 binding and keeps the
// old emergency router disabled. Both catalog paths are nevertheless already
// advertised by live public sitemaps. Restore ONLY those read-only, existing
// indexed directory routes; do not switch on the wider fallback/generator.
export async function nativeBoundRescueCatalogResponse(req,env){
  if(req.method!=='GET'||String(env?.R2_RESCUE_READONLY_ENABLED||'')!=='false'||
    typeof env?.CONTENT_FINAL?.get!=='function')return null;
  const u=new URL(req.url),path=u.pathname.replace(/\/+$/,'');
  const english=/^\/blog\/archive\/english\/catalog(?:\/[1-9]\d{0,4})?$/.test(path);
  const arabic=/^\/blog\/archive\/catalog(?:\/[1-9]\d{0,4})?$/.test(path);
  if(!english&&!arabic)return null;
  try{return english?await serveEnglishCatalog(env,u):await serveCatalog(env,u)}
  catch(error){
    console.warn('r2_catalog_read_unavailable',String(error?.message||error).slice(0,90));
    return new Response('Archive temporarily unavailable',{status:503,headers:{
      'content-type':'text/plain; charset=utf-8','cache-control':'no-store',
      'retry-after':'120','x-robots-tag':'noindex,nofollow'
    }});
  }
}
export async function emergencyPublicR2Response(req,env){
  const u=new URL(req.url);
  if(req.method!=='GET'||String(env.R2_RESCUE_READONLY_ENABLED||'')!=='true')return null;
  const p=u.pathname.replace(/\/+$/,'')||'/';
  const isSitemap=p==='/sitemap-rescue-english-catalog.xml'||p==='/sitemap-rescue-catalog.xml'||p==='/sitemap-live-recent.xml'||p==='/sitemap-images.xml'||p==='/sitemap-en-articles.xml'||/^\/sitemap-rescue-(?:english-images|english|articles|images)-\d{1,4}\.xml$/.test(p);
  if(!isSitemap&&!(/^\/articles\/[^/]+$/.test(p)||/^\/en\/articles\/[^/]+$/.test(p)||p==='/blog'||p==='/blog/saudi'||p==='/blog/uae'||p.startsWith('/blog/archive')))return null;
  try{
    if(isSitemap)return await rescueSitemapResponse(p,env);
    if(p.startsWith('/articles/'))return await serveArticle(env,u,false);
    if(p.startsWith('/en/articles/'))return await serveArticle(env,u,true);
    if(p==='/blog'||p==='/blog/saudi'||p==='/blog/uae'){
      // Old ?page=N and intent filters preserve existing URLs. All default blog
      // pages and ?after= keys use complete R2 listing, never the 4k recent cap.
      if(req.method==='GET'&&(!u.searchParams.has('page')||u.searchParams.has('after'))&&!u.searchParams.has('topic')){
        const complete=await completeBlogResponse(env,u);
        if(complete)return complete;
      }
      return await serveBlog(env,u);
    }
    if(p==='/blog/archive'||p==='/blog/archive/full')return await serveDays(env);
    if(p==='/blog/archive/all')return await serveAll(env,u);
    if(/^\/blog\/archive\/catalog(?:\/[1-9]\d{0,4})?$/.test(p))return await serveCatalog(env,u);
    if(/^\/blog\/archive\/\d{4}-\d{2}-\d{2}$/.test(p))return await serveDay(env,u,p.slice('/blog/archive/'.length));
    if(/^\/blog\/archive\/english\/catalog(?:\/[1-9]\d{0,4})?$/.test(p))return await serveEnglishCatalog(env,u);
    if(p==='/blog/archive/english')return await serveEnglishArchive(env,u);
    return null;
  }catch(error){
    const message=String(error?.message||error).slice(0,120).replace(/[\r\n]/g,' ');
    console.warn('r2_rescue_error',message);
    const headers={'content-type':'text/plain; charset=utf-8','cache-control':'no-store','retry-after':'120','x-r2-rescue':'unavailable'};
    // Local unit-test diagnostics only. Must remain off on deployed production.
    if(String(env.R2_RESCUE_DEBUG||'')==='true')headers['x-r2-rescue-debug']=message;
    return new Response('Article archive temporarily unavailable',{status:503,headers});
  }
}

// Use the directly bound destination R2 for public legacy articles and the
// complete blog when the general rescue flag is off. The previous fallback
// walked several nested HTML/SEO decorators and could exhaust Worker CPU
// (Cloudflare 1102) before the original article reached search crawlers.
// This is strictly read-only: no queue, generator, archive or schedule writes.
export async function nativeBoundLegacyPublicFastResponse(req,env){
  if(req.method!=='GET'||String(env?.R2_RESCUE_READONLY_ENABLED||'')!=='false'||
     typeof env?.CONTENT_FINAL?.get!=='function')return null;
  const url=new URL(req.url),path=url.pathname.replace(/\/+$/,'')||'/';
  const article=/^\/(?:en\/)?articles\/[^/]+$/.test(path);
  const blog=['/blog','/blog/saudi','/blog/uae'].includes(path)&&
    (!url.searchParams.has('page')||url.searchParams.has('after'))&&!url.searchParams.has('topic');
  if(!article&&!blog)return null;
  try{
    const result=article?await serveArticle(env,url,path.startsWith('/en/')):
      await completeBlogResponse(env,url);
    if(!result)return null;
    const headers=new Headers(result.headers);
    headers.set('x-r2-public-fast-route','legacy-readonly-v1');
    return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
  }catch(error){
    console.warn('legacy_r2_fast_unavailable',String(error?.message||error).slice(0,100));
    return new Response('Public article temporarily unavailable',{status:503,headers:{
      'cache-control':'no-store','retry-after':'120','x-r2-public-fast-route':'temporary-unavailable-v1'
    }});
  }
}
