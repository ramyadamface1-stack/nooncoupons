// Build quota-independent market, guide and coupon XML sitemaps using the
// existing canonical sitemap route renderer. No R2 reads/writes and NO HTML,
// article, admin or API route is ever included in Worker Static Assets.
import app from '../auto-platform.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const STATIC_MARKET_SITEMAP_NAMES=Object.freeze([
  'pages','guides','coupons','coupons-saudi','coupons-uae'
]);
const ORIGIN='https://noondealsnow.com';
const outDir=resolve(process.cwd(),'.ndn-static-assets');
const assert=(valid,message)=>{if(!valid)throw Error('NDN_STATIC_MARKET_SITEMAP_'+message)};
for(const name of STATIC_MARKET_SITEMAP_NAMES){
  const filename='sitemap-'+name+'.xml';
  // auto-platform returns its existing staticSitemap() directly for these
  // five paths, before invoking the dynamic Worker, AI or R2 routes.
  const response=await app.fetch(new Request(ORIGIN+'/'+filename),{SITE_ORIGIN:ORIGIN},{});
  assert(response.status===200,'SOURCE_HTTP_'+name);
  assert((response.headers.get('content-type')||'').includes('application/xml'),'SOURCE_TYPE_'+name);
  const body=await response.text();
  assert(body.startsWith('<?xml version="1.0"'),'XML_PROLOG_'+name);
  assert(body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'),'XML_URLSET_'+name);
  assert(body.endsWith('</urlset>'),'XML_CLOSE_'+name);
  assert(!/<!DOCTYPE|<script|<html/i.test(body),'UNEXPECTED_MARKUP_'+name);
  assert(Buffer.byteLength(body,'utf8')<=60000,'UNEXPECTED_SIZE_'+name);
  const urls=[...body.matchAll(/<loc>([^<>]+)<\/loc>/g)].map(m=>m[1]);
  assert(urls.length>0&&urls.length<=250,'EMPTY_OR_LARGE_'+name);
  assert(new Set(urls).size===urls.length,'DUPLICATES_'+name);
  for(const url of urls){
    assert(url.startsWith(ORIGIN+'/')&&!url.includes('?'),'CROSS_DOMAIN_OR_QUERY_'+name);
    assert(!/\/(?:api|admin)(?:\/|$)/i.test(url),'PRIVATE_PATH_'+name);
    assert(!/\/(?:en\/)?articles\//.test(url),'DYNAMIC_ARTICLE_PATH_'+name);
  }
  if(name==='coupons-saudi'){
    assert(urls.includes(ORIGIN+'/coupon/nov170'),'MISSING_SA_COUPON');
    assert(!urls.includes(ORIGIN+'/coupon/nov188'),'MIXED_AE_COUPON');
  }
  if(name==='coupons-uae'){
    assert(urls.includes(ORIGIN+'/coupon/nov188'),'MISSING_AE_COUPON');
    assert(!urls.includes(ORIGIN+'/coupon/nov170'),'MIXED_SA_COUPON');
  }
  if(name==='pages')assert(urls.includes(ORIGIN+'/'),'HOMEPAGE_NOT_LISTED');
  await mkdir(outDir,{recursive:true});
  await writeFile(resolve(outDir,filename),body,'utf8');
  assert((await readFile(resolve(outDir,filename),'utf8'))===body,'WRITE_PARITY_'+name);
  console.log('NDN_STATIC_MARKET_SITEMAP_BUILT='+filename+';URLS='+urls.length+';BYTES='+Buffer.byteLength(body,'utf8'));
}
console.log('NDN_STATIC_MARKET_SITEMAPS=5;CANONICAL_SOURCE=auto-platform;ARTICLES_AND_ADMIN_UNTOUCHED=true');
