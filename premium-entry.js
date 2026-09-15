import app from './auto-platform.js';
export {ControlPlane,GeneratorControl} from './auto-platform.js';

const LEGACY_ORIGIN='https://nooncoupons.ramychatgptgcoupons.workers.dev';
const enc=s=>encodeURI(String(s||''));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c');

async function r2json(env,key,fallback){
  try{const o=env.CONTENT_FINAL?await env.CONTENT_FINAL.get(key):null;return o?await o.json():fallback}catch{return fallback}
}

function requestOriginEnv(req,env){
  const u=new URL(req.url),host=u.hostname;
  const canonicalOrigin=host.endsWith('.workers.dev')?(env.SITE_ORIGIN||u.origin):u.origin;
  return new Proxy(env,{get(target,prop){if(prop==='SITE_ORIGIN')return canonicalOrigin;return Reflect.get(target,prop)}});
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

async function injectHead(res,add,marker,lang){
  if(!res.ok||!(res.headers.get('content-type')||'').includes('text/html'))return res;
  const html=await res.text();
  const out=/<\/head>/i.test(html)?html.replace(/<\/head>/i,add+'</head>'):add+html;
  const h=new Headers(res.headers);
  h.delete('content-length');
  h.set('x-premium-layer',marker);
  if(lang)h.set('content-language',lang);
  return new Response(out,{status:res.status,statusText:res.statusText,headers:h});
}

async function enhanceArticle(req,env,res){
  const u=new URL(req.url),slug=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop()||'');
  if(!slug||!env.CONTENT_FINAL)return res;
  let md={};
  try{const o=await env.CONTENT_FINAL.head('articles/'+slug+'.html');md=o?.customMetadata||{}}catch{}
  const origin=env.SITE_ORIGIN||u.origin;
  const published=md.at||new Date().toISOString();
  const modified=md.ua||published;
  const isAE=md.c==='AE',market=isAE?'الإمارات':'السعودية',lang=isAE?'ar-AE':'ar-SA';
  const canonical=origin+'/articles/'+enc(slug);
  const add=`<meta name="author" content="فريق تحرير كوبونات نون"><meta property="og:site_name" content="كوبونات نون"><meta property="article:published_time" content="${esc(published)}"><meta property="article:modified_time" content="${esc(modified)}"><meta property="article:section" content="نون ${market}"><link rel="alternate" hreflang="${lang}" href="${esc(canonical)}"><link rel="alternate" hreflang="x-default" href="${esc(canonical)}"><link rel="alternate" type="application/rss+xml" title="كوبونات نون — أحدث الأدلة" href="${esc(origin+'/feed.xml')}">`;
  return injectHead(res,add,'article-v4',lang);
}

async function enhanceBlog(req,env,res){
  const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin,latest=await r2json(env,'bulk/latest.json',{articles:[]});
  const rows=(latest.articles||[]).filter(a=>a?.slug&&a?.indexable!==false).slice(0,30);
  const graph={'@context':'https://schema.org','@graph':[
    {'@type':'CollectionPage','@id':origin+'/blog#collection',url:origin+'/blog',name:'مدونة كوبونات نون',description:'أحدث أدلة نون السعودية والإمارات التي اجتازت بوابة الجودة والتفرد والتحقق.',inLanguage:'ar',isPartOf:{'@id':origin+'/#website'},mainEntity:{'@id':origin+'/blog#items'}},
    {'@type':'ItemList','@id':origin+'/blog#items',name:'أحدث أدلة كوبونات نون',numberOfItems:rows.length,itemListElement:rows.map((a,i)=>({'@type':'ListItem',position:i+1,url:origin+'/articles/'+enc(a.slug),name:a.title||a.primaryKeyword||a.slug}))}
  ]};
  const add=`<meta property="og:type" content="website"><meta property="og:site_name" content="كوبونات نون"><link rel="alternate" type="application/rss+xml" title="كوبونات نون — أحدث الأدلة" href="${esc(origin+'/feed.xml')}"><script type="application/ld+json" data-schema="blog-collection">${safeJson(graph)}</script>`;
  return injectHead(res,add,'blog-v4','ar');
}

async function polishAndCanonicalize(req,env,res){
  const type=(res.headers.get('content-type')||'').toLowerCase();
  const textual=type.includes('text/html')||type.includes('xml')||type.includes('text/plain');
  const u=new URL(req.url),origin=env.SITE_ORIGIN||u.origin;
  const h=new Headers(res.headers);
  const location=h.get('location');
  if(location&&origin!==LEGACY_ORIGIN&&location.startsWith(LEGACY_ORIGIN))h.set('location',origin+location.slice(LEGACY_ORIGIN.length));
  if(!textual)return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
  let text=await res.text();
  if(origin!==LEGACY_ORIGIN)text=text.split(LEGACY_ORIGIN).join(origin);
  if(type.includes('text/html')){
    const polish=`<meta name="theme-color" content="#111827"><style id="site-polish-v1">:root{color-scheme:light}html{scroll-behavior:smooth}a,button{touch-action:manipulation}:focus-visible{outline:3px solid #facc15!important;outline-offset:3px!important}@media(max-width:850px){.head .nav{display:grid!important;grid-template-columns:1fr auto!important;row-gap:10px!important}.head .links{display:flex!important;grid-column:1/-1!important;overflow-x:auto!important;white-space:nowrap!important;padding:0 0 8px!important;scrollbar-width:none!important}.head .links::-webkit-scrollbar{display:none}.head .links a{flex:0 0 auto}.head .btn.primary{white-space:nowrap}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}</style>`;
    if(!text.includes('site-polish-v1'))text=/<\/head>/i.test(text)?text.replace(/<\/head>/i,polish+'</head>'):polish+text;
  }
  h.delete('content-length');
  h.set('x-canonical-origin',origin);
  return new Response(text,{status:res.status,statusText:res.statusText,headers:h});
}

export default{
  async fetch(req,env,ctx){
    const runtimeEnv=requestOriginEnv(req,env);
    let res=await app.fetch(req,runtimeEnv,ctx);
    const u=new URL(req.url);
    if(req.method==='GET'&&u.pathname.startsWith('/articles/'))res=await enhanceArticle(req,runtimeEnv,res);
    else if(req.method==='GET'&&u.pathname==='/blog')res=await enhanceBlog(req,runtimeEnv,res);
    res=await polishAndCanonicalize(req,runtimeEnv,res);
    return hardened(res);
  },
  async scheduled(event,env,ctx){if(app.scheduled)return app.scheduled(event,env,ctx)}
};