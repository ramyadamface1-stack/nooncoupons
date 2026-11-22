// Restore existing keyword and conversion URLs as Cloudflare static assets
// when Workers Free returns 1027. The existing editorial source renderers
// supply all long-form content; the R2 article corpus is not modified.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {keywordLanding,goldenKeywordsHub} from '../keyword-pages.js';
import {brandDirectoryResponse} from '../brand-directory-schema.js';

const root=resolve('.ndn-static-assets'),origin='https://noondealsnow.com';
const pages=['/saudi-arabia','/saudi-arabia/noon-coupon-code','/brands',
  '/golden-keywords','/coupon/noon-discount-50',
  '/guide/noon-yellow-friday','/guide/noon-refund-credit'];
const home=await readFile(resolve(root,'index.html'),'utf8');
const analytics=(home.match(/<script id="ndn-static-ga4">[\s\S]*?<\/script>/)||[])[0];
if(!analytics||!analytics.includes('G-1551Z7DJ2C'))throw Error('NDN_LEGACY_GA4_SOURCE_MISSING');
const nav='<nav class="ndn-restored-legacy-nav" style="display:flex;gap:13px;flex-wrap:wrap;padding:12px 3%;background:#fff;border:1px solid #e2e8f0;font:700 14px Tahoma,Arial">'+
  '<a href="/">الرئيسية</a><a href="/saudi/noon-coupon-code">كوبونات السعودية NOV170</a>'+
  '<a href="/uae/noon-coupon-code">كوبونات الإمارات NOV188</a>'+
  '<a href="/saudi/categories">أقسام السعودية</a><a href="/uae/categories">أقسام الإمارات</a><a href="/blog">المدونة</a>'+
  '<a href="/golden-keywords">الكلمات الذهبية</a><a href="/editorial-policy">السياسة التحريرية</a></nav>';
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stable=async(path,html,opts={})=>{
  if(!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}$/.test(path))throw Error('NDN_LEGACY_UNSAFE_URL_'+path);
  if(!html.startsWith('<!doctype html>')||!html.includes('<h1')||!html.includes('</head>'))
    throw Error('NDN_LEGACY_RENDER_INVALID_'+path);
  const canonical=opts.canonical||origin+path;
  if(!html.includes('<link rel="canonical" href="'+canonical+'">'))
    throw Error('NDN_LEGACY_CANONICAL_MISSING_'+path);
  if(!html.includes('id="ndn-static-ga4"'))html=html.replace('</head>',analytics+'</head>');
  if(!html.includes('class="ndn-restored-legacy-nav"'))html=html.replace('<body>','<body>'+nav);
  if(!html.includes('name="ndn-legacy-static-bridge"'))html=html.replace('</head>',
    '<meta name="ndn-legacy-static-bridge" content="v1"></head>');
  const dest=resolve(root,path.slice(1)+'.html');
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,html,'utf8');
};
const alias='/saudi-arabia';
const aliasHtml='<!doctype html><html lang="ar-SA" dir="rtl"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>نون السعودية | كوبون NOV170 والأقسام</title>'+
  '<meta name="robots" content="noindex,follow">'+
  '<meta http-equiv="refresh" content="0;url=/saudi">'+
  '<link rel="canonical" href="'+origin+'/saudi">'+
  '<meta name="description" content="زيارة صفحة نون السعودية الرئيسية والانتقال إلى كود NOV170 وأقسام التسوق."></head>'+
  '<body><main dir="rtl" style="font:18px/2 Tahoma,Arial;padding:30px"><h1>نون السعودية</h1>'+
  '<p>تجد صفحة نون السعودية الحالية على الرابط التالي.</p>'+
  '<a href="/saudi">انتقل إلى نون السعودية</a>'+
  '<p><a href="/saudi/noon-coupon-code">كود الخصم NOV170</a></p></main></body></html>';
await stable(alias,aliasHtml,{canonical:origin+'/saudi'});

const oldCoupon='/saudi-arabia/noon-coupon-code';
const primary=await readFile(resolve(root,'saudi/noon-coupon-code.html'),'utf8');
let legacyCoupon=primary.replace(
  /<link rel="canonical" href="https:\/\/noondealsnow\.com\/saudi\/noon-coupon-code">/,
  '<link rel="canonical" href="'+origin+oldCoupon+'">').replace(
  /<meta property="og:url" content="https:\/\/noondealsnow\.com\/saudi\/noon-coupon-code">/,
  '<meta property="og:url" content="'+origin+oldCoupon+'">');
if(!legacyCoupon.includes('NOV170')||legacyCoupon.includes('NOV188</span>'))
  throw Error('NDN_LEGACY_SAUDI_COUPON_MARKET_WRONG');
await stable(oldCoupon,legacyCoupon);
const brand=brandDirectoryResponse(new Request(origin+'/brands'));
if(!brand||brand.status!==200)throw Error('NDN_LEGACY_BRANDS_SOURCE_UNAVAILABLE');
await stable('/brands',await brand.text());
// Keep the new indexable buyer-keyword hub. Never let emergency recovery
// overwrite it with the retired internal noindex search-intent map.
let publicGolden=null;
try{publicGolden=await readFile(resolve(root,'golden-keywords.html'),'utf8')}catch{}
if(publicGolden?.includes('name="ndn-public-golden-keywords"')){
 if(!publicGolden.includes('<meta name="robots" content="index,follow,max-image-preview:large">')||
    !publicGolden.includes('NOV170')||!publicGolden.includes('NOV188'))
  throw Error('NDN_PUBLIC_GOLDEN_KEYWORD_STATIC_INVALID');
 await stable('/golden-keywords',publicGolden);
}else await stable('/golden-keywords',goldenKeywordsHub(origin));
for(const path of ['/coupon/noon-discount-50','/guide/noon-yellow-friday','/guide/noon-refund-credit']){
 const response=keywordLanding(path,origin);
 if(!response||response.status!==200)throw Error('NDN_LEGACY_KEYWORD_SOURCE_MISSING_'+path);
 await stable(path,await response.text());
}
const report={restored:pages.length,urls:pages,originalR2Modified:false};
await writeFile('.ndn-blog-staging/legacy-landing-report.json',JSON.stringify(report,null,2),'utf8');
console.log('NDN_LEGACY_1027_PAGES_RESTORED='+pages.length+';ORIGINAL_CANONICALS_RETAINED=true;R2_WRITES=ZERO');
