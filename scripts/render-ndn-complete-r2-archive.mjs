// Full historical R2 article catalog with CDN-served paginated HTML.
// This is a second archival layer. Normal blog retains 15 cards per page;
// archive uses 100 lightweight links so Workers Free stays under 20k assets.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const base='https://noondealsnow.com',root=resolve('.ndn-static-assets');
const archive=JSON.parse(await readFile('.ndn-blog-staging/full-r2-article-keys.json','utf8'));
const recent=JSON.parse(await readFile('.ndn-blog-staging/asset-audit.json','utf8'));
if(archive.version!==1||!Array.isArray(archive.articleSlugs)||archive.articleSlugs.length<150000)
  throw Error('NDN_R2_FULL_ARCHIVE_NOT_VERIFIED');
const pageSize=100;
const total=archive.articleSlugs.length,pages=Math.ceil(total/pageSize);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=n=>n===1?'/blog/archive/all':'/blog/archive/all/page/'+n;
const asTitle=slug=>slug.replace(/-/g,' ').replace(/\s+/g,' ').slice(0,180);
const dir=resolve(root,'blog/archive/all');
let totalWritten=0;
for(let n=1;n<=pages;n++){
  const slice=archive.articleSlugs.slice((n-1)*pageSize,n*pageSize);
  const pathname=href(n);
  const title='الأرشيف الكامل لمقالات كوبونات نون — صفحة '+n;
  const description='تصفح جميع المقالات المحفوظة من نون السعودية والإمارات باللغة العربية والإنجليزية؛ صفحة '+n+' من '+pages+'.';
  const links=slice.map((slug,i)=>{
    const en=slug.startsWith('en-'),country=slug.includes('uae')||slug.includes('emirates')?'الإمارات':'السعودية أو الإمارات';
    const url=(en?'/en/articles/':'/articles/')+slug;
    return '<li><a href="'+url+'" class="article-link" '+(en?'lang="en" dir="ltr"':'')+'>'+
      esc(asTitle(slug))+'</a><small> · '+(en?'English UAE':country)+'</small></li>';
  }).join('');
  const buttons=(n>1?'<a rel="prev" href="'+href(n-1)+'">السابق</a>':'')+
    '<span>صفحة '+n.toLocaleString('ar-EG')+' من '+pages.toLocaleString('ar-EG')+'</span>'+
    (n<pages?'<a rel="next" href="'+href(n+1)+'">التالي</a>':'');
  const shortcuts='<a href="/blog">أحدث المقالات</a><a href="/blog/saudi">السعودية</a>'+
    '<a href="/blog/uae">الإمارات</a><a href="'+href(pages)+'">آخر صفحة</a>';
  const schema=JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',
    name:title,url:base+pathname,mainEntity:{'@type':'ItemList',numberOfItems:slice.length,
      itemListElement:slice.map((slug,i)=>({'@type':'ListItem',position:(n-1)*pageSize+i+1,
        url:base+(slug.startsWith('en-')?'/en/articles/':'/articles/')+slug}))}}).replace(/</g,'\\u003c');
  const css='<style>*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial;background:#f8fafc;color:#172033;line-height:1.85}.wrap{max-width:1100px;width:94%;margin:auto}header{background:#111827;color:#fff;padding:15px 0}header a{color:white;text-decoration:none;font-weight:bold}.hero{background:#fff;border-bottom:1px solid #ddd;padding:22px 0}.hero h1{font-size:clamp(23px,3vw,36px);line-height:1.5}.topnav{display:flex;gap:15px;flex-wrap:wrap}.topnav a{color:#1558c0}.list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0;list-style:none}.list li{background:white;border:1px solid #e2e8f0;border-radius:10px;padding:11px;overflow-wrap:anywhere}.article-link{color:#1558c0;text-decoration:underline;font-weight:700}.list small{color:#64748b}.pager{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin:30px 0}.pager a{background:white;border:1px solid #cbd5e1;padding:8px 12px;color:#1558c0;border-radius:10px;text-decoration:underline}@media(max-width:720px){.list{grid-template-columns:1fr}}</style>';
  const html='<!doctype html><html lang="ar" dir="rtl"><head>'+
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'">'+
    '<meta name="robots" content="noindex,follow">'+
    '<link rel="canonical" href="'+base+pathname+'">'+
    (n>1?'<link rel="prev" href="'+base+href(n-1)+'">':'')+
    (n<pages?'<link rel="next" href="'+base+href(n+1)+'">':'')+
    '<meta name="ndn-complete-r2-archive" content="v1">'+
    '<script type="application/ld+json">'+schema+'</script>'+css+'</head><body>'+
    '<header><div class="wrap"><a href="/blog">كوبونات نون — المدونة</a></div></header>'+
    '<section class="hero"><div class="wrap"><h1>'+esc(title)+'</h1>'+
    '<p>تم العثور على '+total.toLocaleString('ar-EG')+
    ' ملف مقال HTML محفوظ في R2. الفهرس ده بيعرض روابطها الأصلية من غير حذف أو تغيير.</p>'+
    '<nav class="topnav">'+shortcuts+'</nav></div></section>'+
    '<main class="wrap"><nav class="pager">'+buttons+'</nav>'+
    '<ol class="list" start="'+((n-1)*pageSize+1)+'">'+links+'</ol>'+
    '<nav class="pager">'+buttons+'</nav></main></body></html>';
  const file=resolve(root,pathname.slice(1)+'.html');
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,html,'utf8');
  totalWritten+=slice.length;
}
if(totalWritten!==total)throw Error('NDN_ARCHIVE_LOST_ARTICLE_URLS');
const files=(await readdir(root,{recursive:true})).filter(x=>/\.(?:html|svg|xml|txt)$/.test(x));
if(files.length>=20000)throw Error('NDN_CLOUDFLARE_FREE_ASSET_CAP_'+files.length);
const report={version:1,archiveObjects:total,arabic:archive.arabic,english:archive.english,
  archivePages:pages,allVerifiedPublished:recent.published,archivePageSize:pageSize,freeAssetFiles:files.length};
await writeFile('.ndn-blog-staging/full-archive-audit.json',JSON.stringify(report,null,2),'utf8');
console.log('NDN_FULL_ARCHIVE_RENDERED='+JSON.stringify(report));
console.log('NDN_FULL_R2_ARCHIVE_LINK_COVERAGE=ALL_SAVED_HTML_OBJECTS;NO_R2_WRITES=true');
