import test from 'node:test';
import assert from 'node:assert/strict';
import {attribute,extractCanonical,hasNoindex,verifyCouponPage,isXmlSitemap} from '../scripts/geo-crawler-checks.mjs';
import {locs,xmlKind,classifyPage,auditIndexability} from '../scripts/ndn-article-indexability-sample.mjs';

const host='https://noondealsnow.com';
const headers=(type='text/html')=>new Headers({'content-type':type});
const html=url=>'<html><head><link href="'+url+'" rel="canonical"><meta name="robots" content="index,follow"></head><body><main><h1>Noon NOV170</h1></main></body></html>';
test('canonical and robots extraction accept attribute order and reject noindex in either response header or HTML',()=>{
 assert.equal(attribute('<link href="/hello" rel="canonical">','rel'),'canonical');
 assert.equal(extractCanonical('<link href="'+host+'/x" rel="canonical">'),host+'/x');
 assert.equal(extractCanonical('<link rel="stylesheet"><link rel="canonical" href="'+host+'/y">'),host+'/y');
 assert.equal(hasNoindex('<meta content="index,follow" name="robots">'),false);
 assert.equal(hasNoindex('<meta content="noindex,follow" name="robots">'),true);
 assert.equal(hasNoindex('<meta content="index" name="robots">',new Headers({'x-robots-tag':'noindex,follow'})),true);
 const ok=verifyCouponPage({url:host+'/coupon/nov170',status:200,
  html:html(host+'/coupon/nov170'),headers:headers(),code:'NOV170'});
 assert.equal(ok.ok,true);
 assert.equal(verifyCouponPage({url:host+'/coupon/nov170',status:200,
  html:html(host+'/another'),headers:headers(),code:'NOV170'}).ok,false);
});
test('static Cloudflare sitemap HTTP 200 is valid XML without a dynamic Worker-only x-sitemap marker',()=>{
 const body='<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+host+'/coupon/nov170</loc></url></urlset>';
 assert.equal(isXmlSitemap({status:200,mime:'application/xml',body}),true);
 assert.equal(isXmlSitemap({status:200,mime:'text/html',body}),false);
 assert.equal(isXmlSitemap({status:200,mime:'application/xml',body:'<html>sorry</html>'}),false);
 assert.equal(xmlKind(body),'urls');
 assert.deepEqual(locs(body),[host+'/coupon/nov170']);
});
test('real article indexability checks require accessible self canonical without relabeling absent GSC data as unindexed',()=>{
 const url=host+'/articles/saudi-product-1';
 assert.equal(classifyPage(url,{status:200,headers:headers()},html(url)).result,'PASS');
 assert.deepEqual(classifyPage(url,{status:200,headers:headers()},html(host+'/articles/wrong')).reasons,
  ['CANONICAL_MISMATCH_OR_MISSING']);
 assert.deepEqual(classifyPage(url,{status:429,headers:headers()},html(url)).reasons,['WORKER_QUOTA_429']);
 assert.ok(!JSON.stringify(classifyPage(url,{status:200,headers:headers()},html(url))).includes('NOT_INDEXED'));
});
test('bounded synthetic end-to-end samples detect technical problem and empty shard without deleting an article',async()=>{
 const xmlUrls=(urls)=>'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
  urls.map(url=>'<url><loc>'+url+'</loc></url>').join('')+'</urlset>';
 const xmlIndex=(urls)=>'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
  urls.map(url=>'<sitemap><loc>'+url+'</loc></sitemap>').join('')+'</sitemapindex>';
 const commercial=[host+'/saudi-arabia/noon-coupon-code',host+'/uae/noon-coupon-code',
 host+'/saudi/buying-guide/existing-customers',host+'/uae/buying-guide/existing-customers',
 host+'/saudi/buying-guide/first-order',host+'/uae/buying-guide/first-order'];
 const shards=[host+'/sitemap-ai-v2-1.xml',host+'/sitemap-ai-v2-2.xml'];
 const historical=host+'/sitemap-articles-2026-10-20-0.xml';
 const objects=new Map([
  [host+'/sitemap-ai-v2.xml',xmlIndex(shards)],
  [shards[0],xmlUrls([host+'/articles/saudi-alpha-article',host+'/articles/uae-beta-article'])],
  [shards[1],xmlUrls([host+'/articles/saudi-gamma-article',host+'/articles/uae-delta-article'])],
  [host+'/sitemap-commercial.xml',xmlUrls(commercial)],
  [host+'/sitemap.xml',xmlIndex([historical])],
  [historical,xmlUrls([])]
 ]);
 let count=0;
 const fetcher=async url=>{
  count++;
  const xml=objects.get(url);
  if(xml!==undefined)return new Response(xml,{status:200,headers:headers('application/xml')});
  return new Response(html(url),{status:200,headers:headers()});
 };
 const result=await auditIndexability({origin:host,fetcher,maxPages:20});
 assert.equal(result.kind,'PUBLIC_HTTP_INDEXABILITY_ONLY_NOT_GOOGLE_INDEX_STATUS');
 assert.equal(result.failed,0);
 assert.ok(result.checked>=6);
 assert.ok(result.checked<=20);
 assert.ok(result.warnings.includes('EMPTY_REFERENCED_SITEMAP_/sitemap-articles-2026-10-20-0.xml'));
 assert.ok(result.results.some(x=>x.url.endsWith('/saudi-arabia/noon-coupon-code')));
 assert.ok(result.results.some(x=>x.url.endsWith('/uae/noon-coupon-code')));
 assert.ok(count<=32);
});
