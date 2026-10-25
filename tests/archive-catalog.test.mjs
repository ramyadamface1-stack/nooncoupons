import test from 'node:test';
import assert from 'node:assert/strict';
import {emergencyPublicR2Response,rescueSitemapResponse,rescueSitemapIndexPaths} from '../r2-emergency-readonly.js';
import {publicRouteKind,publicEdgeCacheEligible,publicEdgePolicyRevision} from '../r2-public-cache-policy.js';

const env={R2_RESCUE_READONLY_ENABLED:'true',NOON_RESCUE_R2_ACCESS_KEY_ID:'TEST_ID',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'TEST_SECRET'};
const list=Array.from({length:250},(_,i)=>({slug:'guide-'+String(i).padStart(4,'0'),lastmod:'2026-10-01',country:i%2?'AE':'SA'}));
async function fixture(fn){
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    const path=decodeURIComponent(new URL(url).pathname);
    if(path.endsWith('/seo-rescue/index.json'))return new Response(JSON.stringify({version:1,count:250,englishCount:0,segments:[{n:0,key:'seo-rescue/part-0.json',count:250}]}),{status:200,headers:{'content-type':'application/json'}});
    if(path.endsWith('/seo-rescue/part-0.json'))return new Response(JSON.stringify({version:1,articles:list}),{status:200,headers:{'content-type':'application/json'}});
    if(path.endsWith('/blog/latest-live-v1.json'))return new Response(JSON.stringify({articles:[]}),{status:200});
    throw Error('Unexpected mock R2 key '+path);
  };
  try{return await fn()}finally{globalThis.fetch=original}
}
test('catalog provides stable paginated 100-item index with unique self canonicals',()=>fixture(async()=>{
  const first=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog/archive/catalog'),env);
  assert.equal(first.status,200);
  const a=await first.text();
  assert.match(a,/rel="canonical" href="https:\/\/noondealsnow.com\/blog\/archive\/catalog"/);
  assert.equal((a.match(/<li>/g)||[]).length,100);
  assert.match(a,/\/articles\/guide-0000/);
  assert.match(a,/\/blog\/archive\/catalog\/2/);
  assert.doesNotMatch(a,/\/articles\/guide-0100/);
  const second=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog/archive/catalog/2'),env);
  assert.equal(second.status,200);
  const b=await second.text();
  assert.match(b,/rel="canonical" href="https:\/\/noondealsnow.com\/blog\/archive\/catalog\/2"/);
  assert.match(b,/\/articles\/guide-0100/);
  assert.doesNotMatch(b,/\/articles\/guide-0000/);
  assert.equal((b.match(/<li>/g)||[]).length,100);
  const third=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog/archive/catalog/3'),env);
  assert.equal(third.status,200);
  assert.equal(((await third.text()).match(/<li>/g)||[]).length,50);
  const missing=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog/archive/catalog/4'),env);
  assert.equal(missing.status,404);
}));
test('all catalog pages are in own sitemap and linked from the existing root index',()=>fixture(async()=>{
  const urls=await rescueSitemapIndexPaths(env);
  assert.ok(urls.includes('/sitemap-rescue-catalog.xml'));
  const s=await rescueSitemapResponse('/sitemap-rescue-catalog.xml',env);
  assert.equal(s.status,200);
  const xml=await s.text();
  assert.equal((xml.match(/<url>/g)||[]).length,3);
  assert.match(xml,/<loc>https:\/\/noondealsnow.com\/blog\/archive\/catalog<\/loc>/);
  assert.match(xml,/<loc>https:\/\/noondealsnow.com\/blog\/archive\/catalog\/3<\/loc>/);
}));
test('the stable path is edge-cacheable but query params still bypass cache',()=>{
  assert.equal(publicRouteKind('/blog/archive/catalog'),'page');
  assert.equal(publicRouteKind('/blog/archive/catalog/2'),'page');
  assert.equal(publicEdgeCacheEligible(new Request('https://noondealsnow.com/blog/archive/catalog/2')),true);
  assert.equal(publicEdgeCacheEligible(new Request('https://noondealsnow.com/blog/archive/catalog/2?cursor=secret')),false);
});

test('after FAQ market correction, refresh only article cache and keep costly R2 archive cache stable',()=>{
  const base='r2-jsonld-dedupe-r16';
  assert.equal(publicEdgePolicyRevision('/articles/saudi-legacy',base),'r2-article-faq-ga4-v18');
  assert.equal(publicEdgePolicyRevision('/en/articles/en-uae-test',base),'r2-article-faq-ga4-v18');
  assert.equal(publicEdgePolicyRevision('/blog',base),'r2-blog-ga4-v17');
  assert.equal(publicEdgePolicyRevision('/blog/saudi',base),'r2-blog-ga4-v17');
  assert.equal(publicEdgePolicyRevision('/blog/uae',base),'r2-blog-ga4-v17');
  for(const path of ['/blog/archive/catalog','/blog/archive/catalog/700','/sitemap.xml','/sitemap-rescue-catalog.xml']){
    assert.equal(publicEdgePolicyRevision(path,base),base);
  }
});
