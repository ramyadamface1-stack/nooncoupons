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
  if(key&&!(/^(?:articles|bulk|_ops|english-canary|seo-rescue)\//.test(key)))throw new Error('rescue_prefix_not_public');
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
async function getObject(env,key,cacheMs=0){
  const prev=cacheMs?manifestCache.get(key):null;
  if(prev&&prev.until>Date.now())return prev.value;
  if(!/^(?:articles|bulk|_ops|english-canary|seo-rescue)\//.test(key))throw new Error('rescue_prefix_not_public');
  let value;
  if(env.CONTENT_FINAL&&typeof env.CONTENT_FINAL.get==='function'){
    // After account cutover, use the NEW account's native R2 binding directly.
    // Never require the old worker's cross-account access credentials.
    const object=await env.CONTENT_FINAL.get(key);
    if(!object)return null;
    value={body:await object.text(),meta:{...(object.customMetadata||{})},
      modified:object.uploaded instanceof Date?object.uploaded.toUTCString():'',
      contentType:object.httpMetadata?.contentType||''};
  }else{
    // OLD account R2 is NotEntitled: preserve the tested, secret-backed
    // cross-account read-only fallback until real DO + domain cutover.
    const r=await signedR2Read(env,key);
    if(r.status===404)return null;
    if(!r.ok)throw new Error('rescue_r2_get_status_'+r.status);
    value={body:await r.text(),meta:Object.fromEntries([...r.headers].filter(([name])=>name.startsWith('x-amz-meta-')).map(([name,val])=>[name.slice('x-amz-meta-'.length),val])),modified:r.headers.get('last-modified')||'',contentType:r.headers.get('content-type')||''};
  }
  if(cacheMs){manifestCache.set(key,{value,until:Date.now()+cacheMs});if(manifestCache.size>5)manifestCache.delete(manifestCache.keys().next().value)}
  return value;
}
async function getJson(env,key){const result=await getObject(env,key,120000);return result?JSON.parse(result.body):null}

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
    ['/blog/archive/all',english?'All archived guides':'أرشيف المقالات']
  ].map(([href,title])=>'<a href="'+esc(href)+'">'+esc(title)+'</a>').join('')+'</div></nav>';
};
function page(title,content,{lang='ar',dir='rtl',canonical='',description='',robots='noindex,follow',image=''}={}){
  const header='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="'+esc(robots)+'">'+
    '<title>'+esc(title)+' | كوبونات نون</title><meta name="description" content="'+esc(description||title)+'">'+
    (canonical?'<link rel="canonical" href="'+esc(canonical)+'">':'')+
    (image?'<meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description||title)+'"><meta property="og:url" content="'+esc(canonical||'https://noondealsnow.com/blog')+'"><meta property="og:image" content="'+esc(image)+'"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="'+esc(image)+'">':'');
  const css='<style>body{margin:0;color:#152033;background:#f8fafc;font-family:Tahoma,Arial,sans-serif;line-height:1.8}header{background:#111827;color:white;padding:20px 4%}header a{color:#fff;margin-inline-end:20px}main{max-width:950px;margin:26px auto;padding:22px;background:white;border-radius:14px}a{color:#4032a2}article img,article svg{max-width:100%;height:auto}.card>a img{width:100%;aspect-ratio:1200/760;object-fit:cover;border-radius:10px}.featured{margin:12px 0 28px}.featured figcaption{color:#475569;font-size:14px}.related{border-top:1px solid #e2e8f0;margin-top:32px;padding-top:18px}.related-links{display:flex;gap:12px;flex-wrap:wrap}.related-links a{display:inline-block;background:#fffbea;padding:8px 12px;border-radius:10px}.cards{display:grid;gap:12px}.card{padding:18px;border:1px solid #eee;border-radius:12px}.pager{display:flex;gap:14px;justify-content:center;margin:30px 0}.pager a{padding:8px 12px;background:#eee;border-radius:8px}footer{margin:35px auto;padding:15px;max-width:950px;color:#475569}@media(max-width:640px){main{margin:0;border-radius:0;padding:16px}}</style>';
  const menu=lang==='en'?'<a href="/">Home</a><a href="/blog">Blog</a><a href="/blog/archive/english">English Guides</a><a href="/saudi">Saudi Arabia</a><a href="/uae">UAE</a>':'<a href="/">الرئيسية</a><a href="/blog">المدونة</a><a href="/blog/saudi">مقالات السعودية</a><a href="/blog/uae">مقالات الإمارات</a><a href="/blog/archive/all">كل المقالات</a>';
  const disclaimer=lang==='en'?'Independent guide. Verify each coupon against your Noon checkout total.':'محتوى مستقل. تحقق من صلاحية الكود داخل سلة نون قبل الدفع.';
  return '<!doctype html><html lang="'+lang+'" dir="'+dir+'"><head>'+header+css+'</head><body><header><nav>'+menu+'</nav></header><main>'+content+'</main><footer>'+disclaimer+'</footer></body></html>';
}
function response(title,content,opts={},status=200){return new Response(page(title,content,opts),{status,headers:htmlHeaders})}
function link(a){const slug=String(a.slug||'');return (slug.startsWith('en-')?'/en/articles/':'/articles/')+encodeURI(slug)}
function cards(rows){
  return '<section class="cards">'+rows.map(a=>{
    const title=String(a.title||a.slug||'').replace(/[-_]/g,' '),country=marketOf(a),slug=String(a.slug||'');
    const date=dateIso(a.publishedAt||a.createdAt||a.updatedAt);
    return '<article class="card"><a href="'+esc(link(a))+'">'+imgTag(slug,country,a.coupon||a.code||'',1,title)+'</a><small>'+esc(country==='AE'?'الإمارات':'السعودية')+'</small><h2><a href="'+esc(link(a))+'">'+esc(title)+'</a></h2><p>'+esc(String(a.metaDescription||'').slice(0,170))+'</p>'+(date?'<time datetime="'+esc(date)+'">'+esc(dateLabel(date))+'</time>':'')+'</article>';
  }).join('')+'</section>';
}
function nav(previous,next,label){
  return '<nav class="pager">'+(previous?'<a href="'+esc(previous)+'">السابق</a>':'')+'<span>'+esc(label)+'</span>'+(next?'<a href="'+esc(next)+'">التالي</a>':'')+'</nav>';
}
function xmlVal(xml,name){const match=xml.match(new RegExp('<(?:[a-z0-9]+:)?'+name+'>([\\s\\S]*?)<\\/(?:[a-z0-9]+:)?'+name+'>','i'));return match?match[1]:''}
function decodeXml(s){return String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
async function listArticlePage(env,token){
  if(env.CONTENT_FINAL&&typeof env.CONTENT_FINAL.list==='function'){
    // Native binding pagination cursor is opaque and independent of S3.
    const options={prefix:'articles/',limit:15};
    if(token)options.cursor=token;
    const page=await env.CONTENT_FINAL.list(options);
    const keys=(page.objects||[]).map(x=>x.key).filter(k=>k.endsWith('.html'));
    return {keys,more:Boolean(page.truncated),token:page.cursor||''};
  }
  const params={'list-type':'2','max-keys':'15','prefix':'articles/','encoding-type':'url'};
  if(token)params['continuation-token']=token;
  const r=await signedR2Read(env,'',params);
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
  const body=removeRedundantSourceArticleJsonLd(obj.body),match=body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i),title=cleanText(match?match[1]:slug.replace(/[-_]/g,' ')).slice(0,180);
  const description=cleanText(body).slice(0,170),country=english?'AE':marketOf({country:obj.meta.c||obj.meta.country,slug}),code=codeFromBody(body),canonical='https://noondealsnow.com'+u.pathname;
  const featured='https://noondealsnow.com'+rescueImageUrl(slug,country,code,1);
  const date=dateIso(obj.meta.publishedAt||obj.meta.createdAt||obj.meta.datePublished||obj.meta.at);
  const meta={'@context':'https://schema.org','@type':'Article',headline:title,description,inLanguage:english?'en':'ar',mainEntityOfPage:canonical,image:[featured],author:{'@type':'Organization',name:'Noon Deals Now editorial team',url:'https://noondealsnow.com/authors/editorial-team'},publisher:{'@type':'Organization',name:'Noon Deals Now',url:'https://noondealsnow.com'},...(date?{datePublished:date}:{})};
  const cta='<aside style="margin:26px 0;padding:16px;background:#faf4e8;border-radius:14px"><strong>'+(english?'Check your Noon coupon':'تحقق من كوبون نون')+'</strong><p>'+(english?'Verify eligibility and final cost in your Noon cart.':'جرّب الكود وتحقق من الأهلية والسعر النهائي داخل سلة نون.')+'</p><a href="'+(country==='AE'?'https://www.noon.com/uae-en/':'https://www.noon.com/saudi-ar/')+'" rel="noopener external sponsored">'+(english?'Open Noon':'افتح نون')+'</a>'+(code?'<p>'+esc(code)+'</p>':'')+'</aside>';
  const schema='<script type="application/ld+json">'+JSON.stringify(meta).replace(/</g,'\\u003c')+'</script>';
  const figure='<figure class="featured">'+imgTag(slug,country,code,1,title)+'<figcaption>'+esc(english?'Noon shopping guide. Verify coupon eligibility at checkout.':'دليل كوبونات نون — تحقّق من أهلية الكود عند الدفع.')+'</figcaption></figure>';
  const extras=topicLinks(country,english);
  // Keep source article body and original slugs, but restore its cover and cross-links.
  let html=page(title,schema+figure+body+cta+extras,{lang:english?'en':'ar',dir:english?'ltr':'rtl',canonical,description,robots:'index,follow,max-image-preview:large'});
  html=html.replace('</head>','<meta property="og:type" content="article"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:image" content="'+esc(featured)+'"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="760"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="'+esc(featured)+'"></head>');
  return new Response(html,{headers:{...htmlHeaders,'x-r2-rescue-object':'articles','content-language':english?'en':'ar'}});
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
  const data=await getJson(env,'bulk/latest.json');
  const seen=new Set(),rows=[];
  for(const item of [...legacy,...(data?.articles||[])]){
    if(!item?.slug||seen.has(item.slug)||item.status==='draft'||item.status==='scheduled'||item.indexable===false||item.slug.startsWith('en-')||market&&item.country!==market)continue;
    seen.add(item.slug);rows.push(item);
  }
  rows.sort((a,b)=>String(b.publishedAt||b.createdAt||b.updatedAt||'').localeCompare(String(a.publishedAt||a.createdAt||a.updatedAt||'')));
  const size=15,pages=Math.max(1,Math.ceil(rows.length/size)),pageNum=Math.max(1,Math.min(pages,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
  const visible=rows.slice((pageNum-1)*size,pageNum*size);
  const path=market==='SA'?'/blog/saudi':market==='AE'?'/blog/uae':'/blog';
  const heading=market==='SA'?'مدونة نون السعودية':market==='AE'?'مدونة نون الإمارات':'مدونة كوبونات نون';
  const tabs='<nav class="related-links" aria-label="أقسام المدونة"><a href="/blog">كل المقالات</a><a href="/blog/saudi">السعودية</a><a href="/blog/uae">الإمارات</a><a href="/blog/archive/english">English UAE</a><a href="/blog/archive/all">الأرشيف الكامل</a></nav>';
  const hint='<h1>'+esc(heading)+'</h1><p>مقالات وأدلة شرائية مرتبطة بكوبونات نون، مع ضرورة مراجعة أهلية الكود والسعر النهائي داخل السلة.</p>'+tabs;
  const pageUrl='https://noondealsnow.com'+path+(pageNum>1?'?page='+pageNum:'');
  const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',name:heading,url:pageUrl,inLanguage:'ar'},{'@type':'ItemList',itemListElement:visible.map((a,i)=>({'@type':'ListItem',position:i+1+(pageNum-1)*size,url:'https://noondealsnow.com'+link(a)}))}]}).replace(/</g,'\\u003c')+'</script>';
  return response(heading,schema+hint+cards(visible)+nav(pageNum>1?path+'?page='+(pageNum-1):'',pageNum<pages?path+'?page='+(pageNum+1):'','صفحة '+pageNum+' من '+pages),{canonical:pageUrl,robots:'index,follow',image:visible[0]?'https://noondealsnow.com'+rescueImageUrl(visible[0].slug,marketOf(visible[0]),visible[0].coupon||visible[0].code||'',1):''});
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
    return '<article class="card" dir="ltr"><a href="'+esc(href)+'">'+imgTag(slug,'AE',a.code||'',1,title)+'</a><h2><a href="'+esc(href)+'">'+esc(title)+'</a></h2><small>Noon UAE guide · '+esc(a.lastmod||'')+'</small></article>';
  }).join('');
  const path='/blog/archive/english',url='https://noondealsnow.com'+path+(pageNum>1?'?page='+pageNum:'');
  const heading='<h1>Noon UAE English Shopping Guides</h1><p>Browse '+count.toLocaleString('en-US')+' published UAE shopping guides, alphabetically, 15 per page. Check each coupon against your final Noon cart total.</p><nav class="related-links"><a href="/blog">Arabic blog</a><a href="/blog/uae">UAE Arabic articles</a><a href="/uae">UAE store hub</a></nav>';
  return response('Noon UAE English Guides',heading+'<section class="cards">'+cardsHtml+'</section>'+nav(pageNum>1?path+'?page='+(pageNum-1):'',pageNum<pages?path+'?page='+(pageNum+1):'','Page '+pageNum+' of '+pages),{canonical:url,robots:'noindex,follow',lang:'en',dir:'ltr'});
}
async function serveAll(env,u){
  const cursor=u.searchParams.get('cursor')||'';
  if(cursor.length>1000)return new Response('Invalid cursor',{status:400});
  const rows=await listArticlePage(env,cursor);
  const cardsHtml=rows.keys.map(k=>{const slug=k.slice('articles/'.length,-5),en=slug.startsWith('en-'),country=marketOf({slug}),title=slug.replace(/[-_]/g,' ');return '<article class="card" dir="'+(en?'ltr':'rtl')+'"><a href="'+esc((en?'/en/articles/':'/articles/')+encodeURI(slug))+'">'+imgTag(slug,country,'',1,title)+'</a><h2><a href="'+esc((en?'/en/articles/':'/articles/')+encodeURI(slug))+'">'+esc(title)+'</a></h2></article>'}).join('');
  let count='';
  try{const m=await getJson(env,'_ops/article-count.json');count=m?.count?'<p>آخر عد مؤكد لملفات المقالات: '+Number(m.count).toLocaleString('ar-EG')+'</p>':''}catch{}
  const next=rows.more&&rows.token?'/blog/archive/all?cursor='+encodeURIComponent(rows.token):'';
  return response('كل المقالات المحفوظة','<h1>كل المقالات المحفوظة</h1><p>أرشيف كامل قابل للتصفح، 15 مقالة في الصفحة، بدون تغيير الروابط القديمة.</p>'+count+'<section class="cards">'+cardsHtml+'</section>'+nav('',next,'15 مقالة / صفحة'),{canonical:'https://noondealsnow.com/blog/archive/all',robots:'noindex,follow'});
}
async function serveDays(env){
  const m=await getJson(env,'bulk/days.json'),days=(m?.days||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.day||''));
  const rows=days.map(x=>'<article class="card"><a href="/blog/archive/'+encode(x.day)+'">'+esc(x.day)+'</a> · '+Number(x.count||0).toLocaleString('ar-EG')+' مقالة في فهرس اليوم</article>').join('');
  return response('أرشيف المقالات','<h1>أرشيف المقالات حسب التاريخ</h1><p><a href="/blog/archive/all">تصفح كل المقالات المحفوظة</a></p><section class="cards">'+rows+'</section>',{canonical:'https://noondealsnow.com/blog/archive'});
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
const rescueOrigin='https://noondealsnow.com';
const rescueArticleUrl=a=>rescueOrigin+(a.slug.startsWith('en-')?'/en/articles/':'/articles/')+encodeURIComponent(a.slug);
const sitemapPathNum=p=>{const match=p.match(/^\/sitemap-rescue-(english-images|english|articles|images)-([0-9]{1,4})\.xml$/);return match?{kind:match[1],n:Number(match[2])}:null};
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
  return rows;
}
export async function rescueSitemapResponse(path,env){
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
    const img=rescueOrigin+rescueImageUrl(a.slug,a.country,a.code,1);
    return '<url><loc>'+xmlSafe(loc)+'</loc><image:image><image:loc>'+xmlSafe(img)+'</image:loc></image:image></url>';
  }).join('');
  const ns=image?' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"':'';
  return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'+ns+'>'+body+'</urlset>');
}
export async function emergencyPublicR2Response(req,env){
  const u=new URL(req.url);
  if(req.method!=='GET'||String(env.R2_RESCUE_READONLY_ENABLED||'')!=='true')return null;
  const p=u.pathname.replace(/\/+$/,'')||'/';
  const isSitemap=p==='/sitemap-images.xml'||p==='/sitemap-en-articles.xml'||/^\/sitemap-rescue-(?:english-images|english|articles|images)-\d{1,4}\.xml$/.test(p);
  if(!isSitemap&&!(/^\/articles\/[^/]+$/.test(p)||/^\/en\/articles\/[^/]+$/.test(p)||p==='/blog'||p==='/blog/saudi'||p==='/blog/uae'||p.startsWith('/blog/archive')))return null;
  try{
    if(isSitemap)return await rescueSitemapResponse(p,env);
    if(p.startsWith('/articles/'))return await serveArticle(env,u,false);
    if(p.startsWith('/en/articles/'))return await serveArticle(env,u,true);
    if(p==='/blog'||p==='/blog/saudi'||p==='/blog/uae')return await serveBlog(env,u);
    if(p==='/blog/archive'||p==='/blog/archive/full')return await serveDays(env);
    if(p==='/blog/archive/all')return await serveAll(env,u);
    if(/^\/blog\/archive\/\d{4}-\d{2}-\d{2}$/.test(p))return await serveDay(env,u,p.slice('/blog/archive/'.length));
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
