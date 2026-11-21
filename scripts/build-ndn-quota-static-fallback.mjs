// Emergency quota-independent public HTML assets. Never staticize /admin, /api,
// /articles or any URL whose body depends on R2, sessions, or live generation.
// Content source is the existing checked-in (approved-code) public renderer.
import app from '../index.js';
import {APPROVED_COUPON_CODES} from '../approved-coupons.js';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const ORIGIN='https://noondealsnow.com';
const OUT=resolve(process.cwd(),'.ndn-static-assets');
const pages=['/','/coupons','/saudi','/uae','/categories','/shopping-world',
  '/about','/contact','/privacy',
  '/guide/how-to-use-noon-coupon','/guide/coupon-not-working',
  '/guide/saudi-noon-saving-guide','/guide/uae-noon-saving-guide',
  '/guide/first-order-guide','/guide/payment-methods-and-coupons',
  '/guide/coupon-vs-offer','/guide/smart-cart-checklist',
  ...APPROVED_COUPON_CODES.map(code=>'/coupon/'+code.toLowerCase())];
const expected=new Set(pages);
if(expected.size!==pages.length)throw Error('NDN_STATIC_DUPLICATE_PATH');
const marker='<meta name="ndn-quota-static-rescue" content="v1">';
for(const path of pages){
  if(!/^\/(?:$|[a-z0-9-]+(?:\/[a-z0-9-]+)?)$/.test(path))throw Error('NDN_STATIC_UNSAFE_PATH_'+path);
  if(/^\/(?:api|admin|articles|en|assets)(?:\/|$)/i.test(path))throw Error('NDN_STATIC_PRIVATE_PATH');
  const r=await app.fetch(new Request(ORIGIN+path),{SITE_ORIGIN:ORIGIN},{});
  if(r.status!==200||!(r.headers.get('content-type')||'').includes('text/html'))throw Error('NDN_STATIC_SOURCE_NOT_HTML_200_'+path);
  let html=await r.text();
  const canonical='<link rel="canonical" href="'+ORIGIN+path+'">';
  if(!html.startsWith('<!doctype html>')||!html.includes(canonical)||!/<html lang="ar" dir="rtl">/.test(html))throw Error('NDN_STATIC_CANONICAL_OR_LANG_'+path);
  if(/<meta name="robots" content="noindex/.test(html)&&!['/categories'].includes(path))throw Error('NDN_STATIC_UNEXPECTED_NOINDEX_'+path);
  html=html.replace('</head>',marker+'</head>');
  if(path==='/'){
    const codeSet=new Set(APPROVED_COUPON_CODES);
    for(const code of ['NOV170','NOV188'])if(!codeSet.has(code)||!html.includes(code))throw Error('NDN_STATIC_PRIMARY_COUPON_MISSING_'+code);
  }
  if(path.startsWith('/coupon/')){
    const code=path.split('/').at(-1).toUpperCase();
    if(!APPROVED_COUPON_CODES.includes(code)||!html.includes('data-copy="'+code+'"'))throw Error('NDN_STATIC_UNAPPROVED_COUPON_'+path);
  }
  const file=path==='/'?'index.html':path.slice(1)+'.html';
  const dest=resolve(OUT,file);
  if(!dest.startsWith(OUT+'/'))throw Error('NDN_STATIC_PATH_ESCAPE');
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,html,'utf8');
  if(await readFile(dest,'utf8')!==html)throw Error('NDN_STATIC_WRITE_MISMATCH_'+path);
  console.log('NDN_QUOTA_STATIC_PUBLIC_PAGE='+path+';BYTES='+Buffer.byteLength(html));
}
const htmlFiles=(await readdir(OUT,{recursive:true})).filter(x=>x.endsWith('.html'));
if(htmlFiles.length!==pages.length)throw Error('NDN_STATIC_UNEXPECTED_HTML_COUNT_'+htmlFiles.length);
console.log('NDN_QUOTA_STATIC_PUBLIC_PAGES='+pages.length+';API_ADMIN_ARTICLES_DYNAMIC=true;R2_WRITES=0;GENERATION_UNCHANGED=true');
