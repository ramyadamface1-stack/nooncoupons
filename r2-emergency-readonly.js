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
  const r=await signedR2Read(env,key);
  if(r.status===404)return null;
  if(!r.ok)throw new Error('rescue_r2_get_status_'+r.status);
  const value={body:await r.text(),meta:Object.fromEntries([...r.headers].filter(([name])=>name.startsWith('x-amz-meta-')).map(([name,val])=>[name.slice('x-amz-meta-'.length),val])),modified:r.headers.get('last-modified')||'',contentType:r.headers.get('content-type')||''};
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
function page(title,content,{lang='ar',dir='rtl',canonical='',description='',robots='noindex,follow'}={}){
  const header='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="'+esc(robots)+'">'+
    '<title>'+esc(title)+' | كوبونات نون</title><meta name="description" content="'+esc(description||title)+'">'+
    (canonical?'<link rel="canonical" href="'+esc(canonical)+'">':'');
  const css='<style>body{margin:0;color:#152033;background:#f8fafc;font-family:Tahoma,Arial,sans-serif;line-height:1.8}header{background:#111827;color:white;padding:20px 4%}header a{color:#fff;margin-inline-end:20px}main{max-width:950px;margin:26px auto;padding:22px;background:white;border-radius:14px}a{color:#4032a2}article img,article svg{max-width:100%;height:auto}.card>a img{width:100%;aspect-ratio:1200/760;object-fit:cover;border-radius:10px}.featured{margin:12px 0 28px}.featured figcaption{color:#475569;font-size:14px}.related{border-top:1px solid #e2e8f0;margin-top:32px;padding-top:18px}.related-links{display:flex;gap:12px;flex-wrap:wrap}.related-links a{display:inline-block;background:#fffbea;padding:8px 12px;border-radius:10px}.cards{display:grid;gap:12px}.card{padding:18px;border:1px solid #eee;border-radius:12px}.pager{display:flex;gap:14px;justify-content:center;margin:30px 0}.pager a{padding:8px 12px;background:#eee;border-radius:8px}footer{margin:35px auto;padding:15px;max-width:950px;color:#475569}@media(max-width:640px){main{margin:0;border-radius:0;padding:16px}}</style>';
  return '<!doctype html><html lang="'+lang+'" dir="'+dir+'"><head>'+header+css+'</head><body><header><nav><a href="/">الرئيسية</a><a href="/blog">المدونة</a><a href="/blog/archive/all">كل المقالات</a><a href="/saudi">السعودية</a><a href="/uae">الإمارات</a></nav></header><main>'+content+'</main><footer>محتوى مستقل. تحقق من صلاحية الكود داخل سلة نون قبل الدفع.</footer></body></html>';
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
async function serveArticle(env,u,english){
  const slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
  if(!slug||slug.length>280||slug.includes('/')||slug.includes('..'))return new Response('Not Found',{status:404});
  const obj=await getObject(env,'articles/'+slug+'.html');
  if(!obj)return new Response('Not Found',{status:404,headers:{'cache-control':'public,max-age=60'}});
  if(obj.meta.status&&obj.meta.status!=='published')return new Response('Not Found',{status:404});
  const body=obj.body,match=body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i),title=cleanText(match?match[1]:slug.replace(/[-_]/g,' ')).slice(0,180);
  const description=cleanText(body).slice(0,170),country=english?'AE':marketOf({country:obj.meta.c||obj.meta.country,slug}),code=codeFromBody(body),canonical='https://noondealsnow.com'+u.pathname;
  const featured='https://noondealsnow.com'+rescueImageUrl(slug,country,code,1);
  const date=dateIso(obj.meta.publishedAt||obj.meta.createdAt||obj.meta.datePublished);
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
  const data=await getJson(env,'bulk/latest.json'),rows=(data?.articles||[]).filter(a=>a?.slug&&a.indexable!==false);
  const size=15,pages=Math.max(1,Math.ceil(rows.length/size)),pageNum=Math.max(1,Math.min(pages,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
  const visible=rows.slice((pageNum-1)*size,pageNum*size);
  const hint='<h1>مدونة كوبونات نون</h1><p>تصفح أحدث الأدلة، أو افتح <a href="/blog/archive/all">كل المقالات المحفوظة</a> للوصول إلى الأرشيف الكامل الموجود في التخزين.</p>';
  const pageUrl='https://noondealsnow.com/blog'+(pageNum>1?'?page='+pageNum:'');
  const schema='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',name:'مدونة كوبونات نون',url:pageUrl,inLanguage:'ar'},{'@type':'ItemList',itemListElement:visible.map((a,i)=>({'@type':'ListItem',position:i+1+(pageNum-1)*size,url:'https://noondealsnow.com'+link(a)}))}]}).replace(/</g,'\\u003c')+'</script>';
  return response('مدونة كوبونات نون',schema+hint+cards(visible)+nav(pageNum>1?'/blog?page='+(pageNum-1):'',pageNum<pages?'/blog?page='+(pageNum+1):'','صفحة '+pageNum+' من '+pages),{canonical:pageUrl,robots:'index,follow'});
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
export async function emergencyPublicR2Response(req,env){
  const u=new URL(req.url);
  if(req.method!=='GET'||String(env.R2_RESCUE_READONLY_ENABLED||'')!=='true')return null;
  const p=u.pathname.replace(/\/+$/,'')||'/';
  if(!(/^\/articles\/[^/]+$/.test(p)||/^\/en\/articles\/[^/]+$/.test(p)||p==='/blog'||p.startsWith('/blog/archive')))return null;
  try{
    if(p.startsWith('/articles/'))return await serveArticle(env,u,false);
    if(p.startsWith('/en/articles/'))return await serveArticle(env,u,true);
    if(p==='/blog')return await serveBlog(env,u);
    if(p==='/blog/archive'||p==='/blog/archive/full')return await serveDays(env);
    if(p==='/blog/archive/all')return await serveAll(env,u);
    if(/^\/blog\/archive\/\d{4}-\d{2}-\d{2}$/.test(p))return await serveDay(env,u,p.slice('/blog/archive/'.length));
    if(p==='/blog/archive/english')return response('English UAE archive','<h1>English UAE archive</h1><p><a href="/blog/archive/all">Browse all stored English and Arabic articles.</a></p>');
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
