// Reuse the actual dynamic blog renderer with local read-only R2 snapshots.
// Unlike the old fallback, these cards come from *real* published ledger rows.
import app from '../auto-platform.js';
import {renderApprovedNativeAiV2Fast} from '../r2-emergency-readonly.js';
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const base='https://noondealsnow.com',root=resolve('.ndn-static-assets');
const snap=JSON.parse(await readFile('.ndn-blog-staging/public-snapshot.json','utf8'));
if(snap.version!==1||!snap.objects?.['_ops/ai-v2-publication-ledger-v1.json']?.articles?.length)
  throw Error('NDN_BLOG_SOURCE_NOT_VERIFIED');
// Turn the approved R2 article fragments into the public HTML produced
// by the original live renderer. Never expose an unwrapped fragment.
const built=[];
await mkdir(resolve(root,'articles'),{recursive:true});
for(const slug of snap.cachedArticleSlugs){
  const key='articles/'+slug+'.html',meta=snap.heads[key]||{};
  if(meta.p!=='ai-v2-native'||meta.status!=='published')continue;
  let source='';
  try{source=await readFile(resolve('.ndn-blog-staging/native-article-fragments',slug+'.html'),'utf8');}catch{continue;}
  const url=new URL(base+'/articles/'+slug);
  const result=renderApprovedNativeAiV2Fast({body:source,meta},slug,url,meta.c==='AE');
  if(!result||result.status!==200)continue;
  const html=await result.text();
  if(!html.includes('<html')||!html.includes('<link rel="canonical" href="'+url.href+'"')||
      !html.includes('<meta name="robots" content="index,follow,max-image-preview:large">'))continue;
  if(!html.includes('</head>')||!html.includes('<article'))continue;
  // This marker is a verifiable property of a locally rendered, metadata-
  // validated R2 source. Worker-generated pages retain their own header.
  const stamped=html.replace('</head>','<meta name="ndn-static-native-article" content="approved-r2-original-v1"></head>');
  await writeFile(resolve(root,'articles',slug+'.html'),stamped,'utf8');
  built.push(slug);
}
const cached=new Set(built);
snap.cachedArticleSlugs=built;
await writeFile('.ndn-blog-staging/public-snapshot.json',JSON.stringify(snap),'utf8');
if(built.length<24)throw Error('NDN_APPROVED_STATIC_ARTICLE_RENDERER_TOO_FEW_'+built.length);
console.log('NDN_APPROVED_PUBLIC_ARTICLE_RENDERER_OUTPUT='+built.length);
const r2={
 async get(key){const data=snap.objects[key];return data==null?null:{etag:'readonly-build-snapshot',json:async()=>data};},
 async head(key){const metadata=snap.heads?.[key];return metadata?{customMetadata:metadata}:null}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const all=[];
for(const path of ['/blog','/blog/saudi','/blog/uae']){
  const response=await app.fetch(new Request(base+path),{SITE_ORIGIN:base,CONTENT_FINAL:r2},{waitUntil(){}});
  if(response.status!==200||response.headers.get('x-blog-page-size')!=='15')
    throw Error('NDN_BLOG_NOT_REAL_RENDERER_'+path+'_'+response.status);
  let html=await response.text();
  const cards=[...html.matchAll(/<article class="card[^"]*">/g)].length;
  const slugs=[...new Set([...html.matchAll(/href="\/articles\/([a-z0-9-]{16,120})"/g)].map(x=>x[1]))];
  if(cards!==15||slugs.length!==15||slugs.some(x=>!cached.has(x)))
    throw Error('NDN_BLOG_ARTICLE_LINKS_NOT_ALL_CACHED_'+path+'_CARDS_'+cards+'_UNCACHED_'+slugs.filter(x=>!cached.has(x)).join(',').slice(0,250));
  if(!html.includes('<link rel="canonical" href="'+base+path+'"')||
     !html.includes('"@type":"ItemList"'))
    throw Error('NDN_BLOG_SEO_PARITY_'+path);
  const info='<meta name="ndn-verified-r2-article-listing" content="v1">'+
    '<meta name="ndn-blog-snapshot" content="'+esc(snap.createdAt)+'">';
  html=html.replace('</head>',info+'</head>');
  const filename=path.slice(1)+'.html';
  await mkdir(dirname(resolve(root,filename)),{recursive:true});
  await writeFile(resolve(root,filename),html,'utf8');
  all.push(...slugs);
  console.log('NDN_LIVE_VERIFIED_STATIC_BLOG='+path+';CARDS='+cards+';CACHED_ARTICLE_LINKS='+slugs.length);
}
const recent=[...snap.objects['_ops/ai-v2-publication-ledger-v1.json'].articles]
  .filter(x=>cached.has(x.slug))
  .sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||''))).slice(0,8);
const rows=recent.map(a=>{
  const market=a.country==='AE'?'الإمارات':'السعودية';
  const meta=snap.heads['articles/'+a.slug+'.html']||{};
  let title='';
  try{title=decodeURIComponent(meta.t||'')}catch{}
  title=title||a.slug.replace(/-/g,' ');
  return '<li><a style="color:#1558c0;text-decoration:underline" href="/articles/'+esc(a.slug)+'">'+esc(title)+'</a> <small>نون '+market+'</small></li>';
}).join('');
if(recent.length<6)throw Error('NDN_HOMEPAGE_RECENT_ARTICLES_UNAVAILABLE');
const homepage=resolve(root,'index.html');
const original=await readFile(homepage,'utf8');
const section='<section class="section" id="latest-published-articles"><div class="shell">'+
  '<h2>مقالات منشورة وقت إعداد نسخة الأرشيف</h2><p>الأرشيف الثابت يُحدَّث عند نشر نسخة جديدة من الموقع. للمقالات الجديدة فور صدورها انتقل إلى السجل المباشر.</p>'+
  '<ul style="line-height:2">'+rows+'</ul><p><a href="/blog/latest" style="color:#1558c0;text-decoration:underline;font-weight:800">افتح أحدث المقالات المنشورة الآن</a> · <a href="/blog" style="color:#1558c0;text-decoration:underline">تصفح المدونة والأرشيف</a></p></div></section>';
if(!original.includes('class="footer"'))throw Error('NDN_HOMEPAGE_FOOTER_NOT_FOUND');
const final=original.replace('<footer class="footer">',section+'<footer class="footer">');
await writeFile(homepage,final,'utf8');
if((await stat(homepage)).size<1000)throw Error('NDN_HOMEPAGE_BROKEN');
console.log('NDN_HOMEPAGE_LATEST_REAL_ARTICLES='+recent.length+';INDEXABLE_STATIC_BLOGS=3;R2_WRITES=ZERO');
