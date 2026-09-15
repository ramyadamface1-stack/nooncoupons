import app from './auto-platform.js';
export {ControlPlane,GeneratorControl} from './auto-platform.js';

const enc=s=>encodeURI(String(s||''));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c');

async function r2json(env,key,fallback){
  try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}
}

function hardened(res){
  const h=new Headers(res.headers);
  h.set('x-content-type-options','nosniff');
  h.set('referrer-policy','strict-origin-when-cross-origin');
  h.set('x-frame-options','SAMEORIGIN');
  h.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  h.set('cross-origin-opener-policy','same-origin');
  h.set('strict-transport-security','max-age=31536000');
  h.set('x-permitted-cross-domain-policies','none');
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
}

async function enhanceArticle(req,env,res){
  if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;
  const u=new URL(req.url),slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
  if(!slug||!env.CONTENT_FINAL)return res;
  let md={};
  try{const o=await env.CONTENT_FINAL.head('articles/'+slug+'.html');md=o?.customMetadata||{}}catch{}
  const origin=env.SITE_ORIGIN||u.origin;
  const published=md.at||new Date().toISOString();
  const modified=md.ua||published;
  const market=md.c==='AE'?'الإمارات':'السعودية';
  const add=`<meta name="author" content="فريق تحرير كوبونات نون"><meta property="og:site_name" content="كوبونات نون"><meta property="article:published_time" content="${esc(published)}"><meta property="article:modified_time" content="${esc(modified)}"><meta property="article:section" content="نون ${market}"><link rel="alternate" type="application/rss+xml" title="كوبونات نون — أحدث الأدلة" href="${esc(origin+'/feed.xml')}">`;
  return new HTMLRewriter().on('head',{element(el){el.append(add,{html:true})}}).transform(res);
}

async function enhanceBlog(req,env,res){
  if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;
  const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin,latest=await r2json(env,'bulk/latest.json',{articles:[]});
  const rows=(latest.articles||[]).filter(a=>a?.slug&&a?.indexable!==false).slice(0,30);
  const graph={'@context':'https://schema.org','@graph':[
    {'@type':'CollectionPage','@id':origin+'/blog#collection',url:origin+'/blog',name:'مدونة كوبونات نون',description:'أحدث أدلة نون السعودية والإمارات التي اجتازت بوابة الجودة والتفرد والتحقق.',inLanguage:'ar',isPartOf:{'@id':origin+'/#website'},mainEntity:{'@id':origin+'/blog#items'}},
    {'@type':'ItemList','@id':origin+'/blog#items',name:'أحدث أدلة كوبونات نون',numberOfItems:rows.length,itemListElement:rows.map((a,i)=>({'@type':'ListItem',position:i+1,url:origin+'/articles/'+enc(a.slug),name:a.title||a.primaryKeyword||a.slug}))}
  ]};
  const add=`<meta property="og:type" content="website"><meta property="og:site_name" content="كوبونات نون"><link rel="alternate" type="application/rss+xml" title="كوبونات نون — أحدث الأدلة" href="${esc(origin+'/feed.xml')}"><script type="application/ld+json" data-schema="blog-collection">${safeJson(graph)}</script>`;
  return new HTMLRewriter().on('head',{element(el){el.append(add,{html:true})}}).transform(res);
}

export default{
  async fetch(req,env,ctx){
    let res=await app.fetch(req,env,ctx);
    const u=new URL(req.url);
    if(req.method==='GET'&&u.pathname.startsWith('/articles/'))res=await enhanceArticle(req,env,res);
    else if(req.method==='GET'&&u.pathname==='/blog')res=await enhanceBlog(req,env,res);
    return hardened(res);
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};
