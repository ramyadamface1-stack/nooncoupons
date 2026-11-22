// Cloudflare Static Assets: full public article directory and per-article SVGs.
// Source: verified, published, READ-ONLY destination R2 ledger + compact legacy.
// This is only public display build, never AI generation / scheduling / R2 writes.
import app from '../auto-platform.js';
import {blogPremiumHero,blogCardCategory} from '../blog-premium-ui.js';
import {couponSvg} from '../svg-engine.js';
import {normalizeMarketCoupon} from '../approved-coupons.js';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const origin='https://noondealsnow.com';
const root=resolve('.ndn-static-assets');
const snap=JSON.parse(await readFile('.ndn-blog-staging/public-snapshot.json','utf8'));
const ledger=snap.objects?.['_ops/ai-v2-publication-ledger-v1.json'];
const bulk=snap.objects?.['bulk/public-compact-v1.json'];
if(!Array.isArray(ledger?.articles)||!Array.isArray(bulk?.articles)||
   !Array.isArray(snap.verifiedArticleSlugs)||snap.verifiedArticleSlugs.length<1000)
  throw Error('NDN_ARCHIVE_SOURCE_NOT_VERIFIED');
const verified=new Set(snap.verifiedArticleSlugs);
const slugSafe=/^[\p{L}\p{N}\p{M}_-]{1,280}$/u;
const decode=s=>{try{return decodeURIComponent(String(s||''))}catch{return String(s||'')}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=new Map();
for(const r of ledger.articles){
  if(!r||!verified.has(r.slug)||!slugSafe.test(r.slug)||!['SA','AE'].includes(r.country))continue;
  rows.set(r.slug,{...r,status:'published',aiV2Native:true});
}
for(const r of bulk.articles){
  if(!r||!verified.has(r.slug)||!slugSafe.test(r.slug)||!['SA','AE'].includes(r.country)||
    r.status!=='published'||r.indexable===false)continue;
  if(!rows.has(r.slug))rows.set(r.slug,{...r,aiV2Native:false});
}
const articles=[...rows.values()].sort((a,b)=>
  String(b.publishedAt||b.updatedAt||b.createdAt||'').localeCompare(String(a.publishedAt||a.updatedAt||a.createdAt||'')));
if(articles.length!==verified.size)throw Error('NDN_ALL_VERIFIED_ARTICLES_NOT_VISIBLE_'+articles.length+'_OF_'+verified.size);
const details=new Map();
for(const row of articles){
  const meta=snap.heads?.['articles/'+row.slug+'.html']||{};
  const title=decode(meta.t)||String(row.title||'').trim()||
    row.slug.replace(/-/g,' ');
  const description=decode(meta.m)||String(row.metaDescription||'').trim()||
    (row.country==='AE'?'Noon UAE product and coupon shopping guide.':'دليل تسوق وتوفير على نون السعودية.');
  const code=normalizeMarketCoupon(meta.cp||row.coupon,row.country);
  const record={...row,title,description,code};
  details.set(row.slug,record);
}
const assetDir=resolve(root,'assets','coupon-svg');
let svgCount=0;
for(const a of details.values()){
  const svg=couponSvg({title:a.title,coupon:a.code,country:a.country,variant:1,brand:'noon'});
  if(!svg.startsWith('<svg')||!svg.includes('width="1600"')||
     !svg.includes(a.code)||!svg.includes('</svg>'))throw Error('NDN_BAD_FEATURED_SVG_'+a.slug);
  // Chrome rejects even HTTP-200 SVGs when an ampersand is not an XML entity.
  // Validate every published article cover before Cloudflare upload, not just
  // the handful seen in unit tests (the 2026-11-22 UAE image regression).
  if(/&(?!amp;|lt;|gt;|quot;|apos;|#(?:\d+|x[0-9a-f]+);)/i.test(svg))
    throw Error('NDN_INVALID_SVG_XML_ENTITY_'+a.slug);
  const dest=resolve(assetDir,a.slug,'1.svg');
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,svg,'utf8');
  svgCount++;
}
const r2={
  async get(key){const data=snap.objects[key];return data==null?null:{etag:'readonly-build-snapshot',json:async()=>data};},
  async head(key){const metadata=snap.heads?.[key];return metadata?{customMetadata:metadata}:null}
};
const PER_PAGE=15;
const allSeries=[
  ['/blog',articles],
  ['/blog/saudi',articles.filter(a=>a.country==='SA')],
  ['/blog/uae',articles.filter(a=>a.country==='AE')]
];
let pageFiles=0;
const routing=(base,n)=>n===1?base:base+'/page/'+n;
const pathMap={};
for(const [base,items] of allSeries){
  const isUaePage=base==='/blog/uae';
  const pages=Math.ceil(items.length/PER_PAGE);
  if(pages<1)throw Error('NDN_EMPTY_MARKET_'+base);
  pathMap[base]=pages;
  const first=await app.fetch(new Request(origin+base),{SITE_ORIGIN:origin,CONTENT_FINAL:r2},{waitUntil(){}});
  if(first.status!==200||first.headers.get('x-blog-page-size')!=='15')throw Error('NDN_ORIGINAL_BLOG_RENDERER_UNAVAILABLE_'+base);
  const shell=await first.text();
  const style=(shell.match(/<style>[\s\S]*?<\/style>/)||[])[0];
  const headUntil=(shell.match(/<header>[\s\S]*?<\/header>/)||[])[0];
  if(!style||!headUntil)throw Error('NDN_ORIGINAL_PUBLIC_BLOG_LAYOUT_CHANGED_'+base);
  for(let n=1;n<=pages;n++){
    const current=items.slice((n-1)*PER_PAGE,n*PER_PAGE).map(a=>details.get(a.slug));
    if(!current.length||current.some(x=>!x))throw Error('NDN_STATIC_PAGE_MISSING_ARTICLE_'+base+'_'+n);
    const url=origin+routing(base,n);
    const before=n>1?routing(base,n-1):'';
    const after=n<pages?routing(base,n+1):'';
    const pageTitle=isUaePage?'Noon UAE Shopping Guides':base==='/blog'?'مدونة كوبونات نون':'مدونة نون السعودية';
    const title=n===1?pageTitle+(isUaePage?' | Latest buyer guides':' | أحدث المقالات المنشورة'):pageTitle+(isUaePage?' | Page ':' | صفحة ')+n;
    const desc=isUaePage?'Independent Noon UAE buying guides and NOV188 coupon advice: '+items.length+' published guides across '+pages+' pages, 15 guides per page.':
      'دليل المقالات المنشورة عن كوبونات نون وطرق التوفير: '+items.length+' مقالًا موزعة على '+pages+' صفحة، 15 مقالًا في كل صفحة.';
    const cards=current.map((a,i)=>{
      const market=isUaePage?'UAE':a.country==='SA'?'السعودية':'الإمارات';
      const at=a.publishedAt||a.createdAt||a.updatedAt||'';
      const published=at&&Number.isFinite(Date.parse(at))?new Intl.DateTimeFormat(isUaePage?'en-GB':'ar-EG',{
        day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(at)):'';
      const src='/assets/coupon-svg/'+encodeURIComponent(a.slug)+'/1.svg';
      const anchor='/articles/'+encodeURIComponent(a.slug);
      return '<article class="card'+(n===1&&i===0?' leadCard':'')+'">'+
        '<a class="thumb" href="'+anchor+'"><img src="'+src+'" alt="'+esc(a.title)+' - '+(isUaePage?'Noon ':'نون ')+market+
        '" width="1600" height="1000" loading="'+(i<3?'eager':'lazy')+'" decoding="async"></a>'+
        '<div class="cardBody"><div class="cardMeta"><span class="tag">'+market+'</span><span class="cardTopic">'+esc(blogCardCategory(a.title,a.slug,isUaePage?'AE':'SA'))+'</span><time datetime="'+esc(at)+'">'+(isUaePage?'Published ':'نُشر ')+esc(published)+(isUaePage?' (Cairo time)':' بتوقيت القاهرة')+'</time></div>'+ 
        '<h2><a href="'+anchor+'">'+esc(a.title)+'</a></h2><p>'+esc(a.description.slice(0,180))+'</p>'+
        '<div class="cardFoot"><a class="cardAuthor" href="/authors/editorial-team">'+(isUaePage?'Noon Deals Now Editorial':'فريق تحرير كوبونات نون')+'</a>'+ 
        '<a class="read" href="'+anchor+'">'+(isUaePage?'Read guide →':'اقرأ الدليل ←')+'</a></div></div></article>';
    }).join('');
    const visible=new Set(current.map(a=>a.slug));
    if(visible.size!==current.length)throw Error('NDN_DUPLICATE_ARTICLE_ON_PAGE_'+base+'_'+n);
    const pagination=Array.from({length:Math.min(7,pages)},(_,j)=>{
      const s=Math.max(1,Math.min(pages-6,n-3));return s+j;
    }).filter(x=>x<=pages);
    const itemLinks=pagination.map(i=>'<a'+(i===n?' class="current" aria-current="page"':'')+
      ' href="'+routing(base,i)+'">'+i+'</a>').join('');
    const nav='<nav class="pagination" aria-label="'+(isUaePage?'Blog pages':'صفحات المدونة')+'">'+ 
      (before?'<a rel="prev" href="'+before+'">'+(isUaePage?'Previous':'السابق')+'</a>':'')+
      (n>4?'<a href="'+base+'">1</a>':'')+itemLinks+
      (n<pages-3?'<a href="'+routing(base,pages)+'">'+pages+'</a>':'')+
      (after?'<a rel="next" href="'+after+'">'+(isUaePage?'Next':'التالي')+'</a>':'')+'</nav>';
    const mainSchema={'@context':'https://schema.org','@graph':[
      {'@type':'CollectionPage','@id':url+'#page',name:title,url,inLanguage:isUaePage?'en-AE':'ar-SA',
       mainEntity:{'@id':url+'#list'}},
      {'@type':'ItemList','@id':url+'#list',numberOfItems:current.length,
       itemListElement:current.map((a,i)=>({'@type':'ListItem',
        position:(n-1)*PER_PAGE+i+1,url:origin+'/articles/'+a.slug,name:a.title}))}
    ]};
    const schema='<script type="application/ld+json" data-schema="blog-collection">'+
      JSON.stringify(mainSchema).replace(/</g,'\\u003c')+'</script>';
    const marketLinks='<a href="/blog">الكل</a><a href="/blog/saudi">مقالات السعودية</a>'+
      '<a href="/blog/uae">مقالات الإمارات</a><a href="/blog/archive/all">الأرشيف القديم</a>';
    const label=base==='/blog'?'كل المقالات':base==='/blog/saudi'?'السعودية':'الإمارات';
    const html='<!doctype html><html lang="'+(isUaePage?'en-AE':'ar-SA')+'" dir="'+(isUaePage?'ltr':'rtl')+'"><head>'+ 
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>'+esc(title)+'</title><meta name="description" content="'+esc(desc)+'">'+
      '<meta name="robots" content="index,follow,max-image-preview:large">'+
      '<link rel="canonical" href="'+url+'">'+
      (before?'<link rel="prev" href="'+origin+before+'">':'')+
      (after?'<link rel="next" href="'+origin+after+'">':'')+
      '<meta name="ndn-verified-r2-article-listing" content="v2">'+
      '<meta name="ndn-static-snapshot-date" content="'+esc(snap.createdAt)+'">'+schema+style+'</head><body>'+
      headUntil+
      blogPremiumHero({title:pageTitle,description:desc,articles:items.length,pages,page:n,
        market:base.endsWith('saudi')?'SA':base.endsWith('uae')?'AE':'ALL',
        latestPublishedAt:current[0]?.publishedAt||current[0]?.createdAt||''})+
      '<main class="w"><section class="grid">'+cards+'</section>'+nav+'</main></body></html>';
    if(!html.includes('href="/articles/')||!html.includes('src="/assets/coupon-svg/'))
      throw Error('NDN_INCOMPLETE_PAGE_'+base+'_'+n);
    const file=routing(base,n)==='/blog'?'blog.html':routing(base,n).slice(1)+'.html';
    const dest=resolve(root,file);
    await mkdir(dirname(dest),{recursive:true});
    await writeFile(dest,html,'utf8');
    pageFiles++;
  }
  console.log('NDN_COMPLETE_STATIC_BLOG='+base+';ARTICLES='+items.length+';PAGES='+pages);
}
const generatedPaths=await readdir(assetDir);
if(generatedPaths.length!==details.size)throw Error('NDN_MISSING_SVG_ASSET_FILES');
const names=await readdir(root,{recursive:true});
const files=names.filter(x=>/\.(?:html|xml|txt|svg)$/.test(x));
if(files.length>=20000)throw Error('CLOUDFLARE_FREE_ASSET_LIMIT_'+files.length);
const snapshot={version:1,published:details.size,images:svgCount,pages:pageFiles,
  markets:Object.fromEntries(allSeries.map(([p,rows])=>[p,rows.length])),
  pageCounts:pathMap,verifiedR2:true,updatedAt:snap.createdAt};
await writeFile('.ndn-blog-staging/asset-audit.json',JSON.stringify(snapshot,null,2));
console.log('NDN_BLOG_FULL_COVERAGE='+JSON.stringify(snapshot));
console.log('NDN_FREE_STATIC_ASSET_COUNT='+files.length+';LIMIT=20000;NO_R2_OR_AI_WRITES=true');
