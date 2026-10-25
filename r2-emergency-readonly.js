import {primaryCodeForMarket,presentMarketCouponText,reconcileSourceCouponJsonLd,repairLegacyGuideLinks,repairGenericNoonLinks,renderCouponAction,renderRelatedArticles,rescueArticleStyles,rescueCopyScript} from './rescue-article-conversion.js';
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
const htmlHeaders={'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=30,s-maxage=300,stale-while-revalidate=600','x-r2-rescue':'new-account-readonly-v1','x-content-type-options':'nosniff'};
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
  const r=await rescueSignedReadBounded(env,key);
  if(r.status===404)return null;
  if(!r.ok)throw new Error('rescue_r2_get_status_'+r.status);
  const value={body:await r.text(),meta:Object.fromEntries([...r.headers].filter(([name])=>name.startsWith('x-amz-meta-')).map(([name,val])=>[name.slice('x-amz-meta-'.length),val])),modified:r.headers.get('last-modified')||'',contentType:r.headers.get('content-type')||''};
  if(cacheMs){manifestCache.set(key,{value,until:Date.now()+cacheMs});if(manifestCache.size>5)manifestCache.delete(manifestCache.keys().next().value)}
  return value;
}
async function getJson(env,key){const result=await getObject(env,key,key==='blog/latest-live-v1.json'?15000:120000);return result?JSON.parse(result.body):null}

const rescueImageUrl=(slug,country='SA',coupon='',variant=1)=>'/assets/coupon-svg/'+encodeURIComponent(String(slug))+'/'+variant+'.svg?v=9&country='+encodeURIComponent(country==='AE'?'AE':'SA')+(coupon?'&coupon='+encodeURIComponent(String(coupon)):'');
const marketOf=a=>a?.country==='AE'||/^en-/.test(String(a?.slug||''))||/\buae\b|الإمارات/i.test(String(a?.slug||''))?'AE':'SA';
const dateIso=s=>{const d=new Date(s||'');return Number.isFinite(d.getTime())?d.toISOString():null};
const dateLabel=s=>{try{return new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(s))}catch{return ''}};
const imgTag=(slug,country,coupon,variant=1,title='')=>'<img src="'+esc(rescueImageUrl(slug,country,coupon,variant))+'" alt="'+esc('Noon '+(country==='AE'?'UAE':'Saudi Arabia')+' coupon guide — '+title)+'" width="1200" height="760" loading="'+(variant===1?'eager':'lazy')+'" decoding="async" style="width:100%;height:auto;aspect-ratio:1200/760;object-fit:contain;background:#f8fafc;border-radius:12px">';
const topicLinks=(country='SA',english=false)=>{
  const market=country==='AE'?'uae':'saudi';
  const landing=country==='AE'?'/uae/noon-coupon-code':'/saudi-arabia/noon-coupon-code';
  const label=english?'Useful shopping links':'روابط ذات صلة';
  return '<nav class="related" aria-label="'+esc(label)+'"><h2>'+esc(label)+'</h2><div class="related-links">'+[
    [landing,english?'Noon coupon conditions':'كود خصم نون'],
    ['/'+market,english?'Country shopping hub':'تسوق نون حسب الدولة'],
    ['/'+market+'/categories',english?'Product categories':'أقسام المنتجات'],
    ['/blog',english?'Latest guides':'أحدث المقالات'],
    ['/blog/archive/all',english?'All archived guides':'أرشيف المقالات'],
    [english?'/blog/archive/english/catalog':'/blog/archive/catalog',english?'Browse English guide directory':'فهرس المقالات القديمة']
  ].map(([href,title])=>'<a href="'+esc(href)+'">'+esc(title)+'</a>').join('')+'</div></nav>';
};
function page(title,content,{lang='ar',dir='rtl',canonical='',description='',robots='noindex,follow',image=''}={}){
  const header='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="'+esc(robots)+'">'+
    '<title>'+esc(title)+' | كوبونات نون</title><meta name="description" content="'+esc(description||title)+'">'+
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
async function serveArticle(env,u,english){
  const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
  if(!slug||slug.length>280||slug.includes('/')||slug.includes('..'))return new Response('Not Found',{status:404});
  const obj=await getObject(env,'articles/'+slug+'.html');
  if(!obj)return new Response('Not Found',{status:404,headers:{'cache-control':'public,max-age=60'}});
  if(obj.meta.status&&obj.meta.status!=='published')return new Response('Not Found',{status:404});
  const country=english?'AE':marketOf({country:obj.meta.c||obj.meta.country,slug});
  const body=repairGenericNoonLinks(repairLegacyGuideLinks(reconcileSourceCouponJsonLd(presentMarketCouponText(removeRedundantSourceArticleJsonLd(obj.body),country),country),country),country,english);
  const match=body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i),title=cleanText(match?match[1]:slug.replace(/[-_]/g,' ')).slice(0,180);
  const description=cleanText(body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')).slice(0,170),code=primaryCodeForMarket(country),canonical='https://noondealsnow.com'+u.pathname;
  const featured='https://noondealsnow.com'+rescueImageUrl(slug,country,code,1);
  const date=dateIso(obj.meta.publishedAt||obj.meta.createdAt||obj.meta.datePublished||obj.meta.at);
  const meta={'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:english?'en':'ar',mainEntityOfPage:canonical,image:[featured],author:{'@type':'Organization',name:'Noon Deals Now editorial team',url:'https://noondealsnow.com/authors/editorial-team'},publisher:{'@type':'Organization',name:'Noon Deals Now',url:'https://noondealsnow.com'},...(date?{datePublished:date}:{})};
  // The source's legacy text-only coupon box did not expose a copy action.
  // Keep original R2 bytes unchanged; present a verified market-locked primary code in the reader.
  const schema='<script type="application/ld+json">'+JSON.stringify(meta).replace(/</g,'\\u003c')+'</script>';
  const figure='<figure class="featured">'+imgTag(slug,country,code,1,title)+'<figcaption>'+esc(english?'Noon shopping guide. Verify coupon eligibility at checkout.':'دليل كوبونات نون — تحقّق من أهلية الكود عند الدفع.')+'</figcaption></figure>';
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
  const contents=schema+figure+'<article class="rescue-article" data-market="'+country+'">'+topOffer+body+bottomOffer+related+'</article>'+extras+mobileOffer+rescueCopyScript;
  let html=page(title,contents,{lang:english?'en-AE':country==='AE'?'ar-AE':'ar-SA',dir:english?'ltr':'rtl',canonical,description,robots:'index,follow,max-image-preview:large'});
  html=html.replace('</head>',rescueArticleStyles+'</head>');
  if(languageAlternates)html=html.replace('</head>',languageAlternates+'</head>');
  html=html.replace('</head>','<meta property="og:type" content="article"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:image" content="'+esc(featured)+'"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="760"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="'+esc(featured)+'"></head>');
  return new Response(html,{headers:{...htmlHeaders,'x-r2-rescue-object':'articles','content-language':english?'en':'ar',...(originalEnglishBaseline?{'x-english-canary':'v1'}:{})}});
}
async function serveBlog(env,u){
  const market=u.pathname.endsWith('/saudi')?'SA':u.pathname.endsWith('/uae')?'AE':null;
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
    if(!item?.slug||seen.has(item.slug)||item.status==='draft'||item.status==='scheduled'||item.indexable===false||item.slug.startsWith('en-')||market&&item.country!==market)continue;
    seen.add(item.slug);rows.push(item);
  }
  rows.sort((a,b)=>String(b.publishedAt||b.createdAt||b.updatedAt||'').localeCompare(String(a.publishedAt||a.createdAt||a.updatedAt||'')));
  const size=15,pages=Math.max(1,Math.ceil(rows.length/size)),pageNum=Math.max(1,Math.min(pages,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
  const visible=rows.slice((pageNum-1)*size,pageNum*size);
  const path=market==='SA'?'/blog/saudi':market==='AE'?'/blog/uae':'/blog';
  const heading=market==='SA'?'مدونة نون السعودية':market==='AE'?'مدونة نون الإمارات':'مدونة كوبونات نون';
  const tabs='<nav class="related-links" aria-label="أقسام المدونة"><a href="/blog">كل المقالات</a><a href="/blog/saudi">السعودية</a><a href="/blog/uae">الإمارات</a><a href="/blog/archive/english">English UAE</a><a href="/blog/archive/english/catalog">English directory</a><a href="/blog/archive/all">الأرشيف الكامل</a><a href="/blog/archive/catalog">فهرس المقالات القديمة</a></nav>';
  const hint='<h1>'+esc(heading)+'</h1><p>مقالات وأدلة شرائية مرتبطة بكوبونات نون، مع ضرورة مراجعة أهلية الكود والسعر النهائي داخل السلة.</p>'+tabs;
  const pageUrl='https://noondealsnow.com'+path+(pageNum>1?'?page='+pageNum:'');
  const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',name:heading,url:pageUrl,inLanguage:'ar'},{'@type':'ItemList',itemListElement:visible.map((a,i)=>({'@type':'ListItem',position:i+1+(pageNum-1)*size,url:'https://noondealsnow.com'+link(a)}))}]}).replace(/</g,'\\u003c')+'</script>';
  return response(heading,schema+hint+cards(visible)+nav(pageNum>1?path+'?page='+(pageNum-1):'',pageNum<pages?path+'?page='+(pageNum+1):'','صفحة '+pageNum+' من '+pages),{canonical:pageUrl,robots:'index,follow',image:visible[0]?'https://noondealsnow.com'+rescueImageUrl(visible[0].slug,marketOf(visible[0]),primaryCodeForMarket(marketOf(visible[0])),1):''});
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
  const heading='<h1>Noon UAE English Shopping Guides</h1><p>Browse '+count.toLocaleString('en-US')+' published UAE shopping guides, alphabetically, 15 per page. Check each coupon against your final Noon cart total.</p><nav class="related-links"><a href="/blog">Arabic blog</a><a href="/blog/uae">UAE Arabic articles</a><a href="/uae">UAE store hub</a><a href="/blog/archive/english/catalog">Browse all English guides</a></nav>';
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
  return response('كل المقالات المحفوظة','<h1>كل المقالات المحفوظة</h1><p>أرشيف كامل قابل للتصفح، 15 مقالة في الصفحة، بدون تغيير الروابط القديمة. <a href="/blog/archive/catalog">فهرس ثابت للمقالات القديمة</a>.</p>'+count+'<section class="cards">'+cardsHtml+'</section>'+nav('',next,'15 مقالة / صفحة'),{canonical:'https://noondealsnow.com/blog/archive/all',robots:'noindex,follow'});
}
async function serveDays(env){
  const m=await getJson(env,'bulk/days.json'),days=(m?.days||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.day||''));
  const rows=days.map(x=>'<article class="card"><a href="/blog/archive/'+encode(x.day)+'">'+esc(x.day)+'</a> · '+Number(x.count||0).toLocaleString('ar-EG')+' مقالة في فهرس اليوم</article>').join('');
  return response('أرشيف المقالات','<h1>أرشيف المقالات حسب التاريخ</h1><p><a href="/blog/archive/all">تصفح كل المقالات المحفوظة</a> · <a href="/blog/archive/catalog">الفهرس الثابت للمقالات القديمة</a></p><section class="cards">'+rows+'</section>',{canonical:'https://noondealsnow.com/blog/archive'});
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
    const img=rescueOrigin+rescueImageUrl(a.slug,marketOf(a),primaryCodeForMarket(marketOf(a)),1);
    return '<url><loc>'+xmlSafe(loc)+'</loc><lastmod>'+xmlSafe(date)+'</lastmod><image:image><image:loc>'+xmlSafe(img)+'</image:loc></image:image></url>';
  }).join('');
  const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+entries+'</urlset>';
  return new Response(xml,{headers:{...sitemapHeaders,'cache-control':'public,max-age=30,s-maxage=60,stale-while-revalidate=60','x-r2-rescue-sitemap':'live-recent-v1','x-sitemap-entries':String(rows.length)}});
}
const rescueOrigin='https://noondealsnow.com';
const rescueArticleUrl=a=>rescueOrigin+(a.slug.startsWith('en-')?'/en/articles/':'/articles/')+encodeURIComponent(a.slug);
const sitemapPathNum=p=>{const match=p.match(/^\/sitemap-rescue-(english-images|english|articles|images)-([0-9]{1,4})\.xml$/);return match?{kind:match[1],n:Number(match[2])}:null};

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
export async function rescueSitemapResponse(path,env){
  if(path==='/sitemap-live-recent.xml')return liveRecentSitemap(env);
  if(path==='/sitemap-rescue-catalog.xml')return catalogSitemap(env);
  if(path==='/sitemap-rescue-english-catalog.xml')return englishCatalogSitemap(env);
  const info=sitemapPathNum(path);
  if(!info&&path!=='/sitemap-images.xml'&&path!=='/sitemap-en-articles.xml')return null;
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
    const img=rescueOrigin+rescueImageUrl(a.slug,a.country,primaryCodeForMarket(a.country),1);
    return '<url><loc>'+xmlSafe(loc)+'</loc><image:image><image:loc>'+xmlSafe(img)+'</image:loc></image:image></url>';
  }).join('');
  const ns=image?' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"':'';
  return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'+ns+'>'+body+'</urlset>');
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
    if(p==='/blog'||p==='/blog/saudi'||p==='/blog/uae')return await serveBlog(env,u);
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
