import test from 'node:test';
import assert from 'node:assert/strict';
import {readRecentPublicManifest,PUBLIC_MANIFEST_CACHE_TTL_MS} from '../r2-public-manifest.js';
import {publicEdgeCacheEligible,publicRouteKind,publicEdgeTtlSeconds} from '../r2-public-cache-policy.js';
import {readFileSync} from 'node:fs';

test('manifest cache coalesces simultaneous public layer reads, refreshes after TTL and tolerates R2 outages',async()=>{
  const realNow=Date.now;
  let tick=100_000;
  Date.now=()=>tick;
  let reads=0;
  let fail=false;
  const env={CONTENT_FINAL:{get:async key=>{
    assert.equal(key,'bulk/latest.json');
    reads++;
    if(fail)throw new Error('R2 unavailable');
    return {json:async()=>({articles:[{slug:'a'+reads,status:'published'}]})};
  }}};
  try{
    const result=await Promise.all(Array.from({length:12},()=>readRecentPublicManifest(env)));
    assert.equal(reads,1,'a concurrent burst should cost a single R2 GET per isolate');
    assert.ok(result.every(x=>x===result[0]));
    await readRecentPublicManifest(env);
    assert.equal(reads,1,'warm readers should reuse the same manifest');
    tick+=PUBLIC_MANIFEST_CACHE_TTL_MS+1;
    const updated=await readRecentPublicManifest(env);
    assert.equal(reads,2);
    assert.equal(updated.articles[0].slug,'a2');
    tick+=PUBLIC_MANIFEST_CACHE_TTL_MS+1;
    fail=true;
    const stale=await readRecentPublicManifest(env);
    assert.equal(reads,3);
    assert.equal(stale.articles[0].slug,'a2');
  }finally{
    Date.now=realNow;
  }
});

test('public edge caching is strict: no authenticated, admin or personalized responses',()=>{
  const request=(path,headers={},method='GET')=>new Request('https://noondealsnow.com'+path,{method,headers});
  const eligible=(path,headers={},method='GET')=>publicEdgeCacheEligible(request(path,headers,method));
  assert.equal(eligible('/articles/a-1'),true);
  assert.equal(eligible('/articles/a-1?utm_source=google&utm_campaign=saudi'),true);
  assert.equal(eligible('/articles/a-1?gclid=abc123'),true);
  assert.equal(eligible('/articles/a-1',{cookie:'_ga=abc; _gid=def'}),true);
  assert.equal(eligible('/articles/a-1',{cookie:'_ga=abc; admin_session=secret'}),false);
  assert.equal(eligible('/articles/a-1',{authorization:'Bearer xyz'}),false);
  assert.equal(eligible('/articles/a-1',{range:'bytes=0-100'}),false);
  assert.equal(eligible('/articles/a-1?preview=1'),false);
  assert.equal(eligible('/articles/a-1?coupon=changed'),false);
  assert.equal(eligible('/blog?page=2'),false);
  assert.equal(eligible('/admin'),false);
  assert.equal(eligible('/api/state'),false);
  assert.equal(eligible('/api/revision'),false);
  assert.equal(eligible('/sitemap.xml'),true);
  assert.equal(eligible('/sitemap-articles.xml'),true);
  assert.equal(eligible('/articles/a-1',{},'POST'),false);
  assert.equal(publicRouteKind('/en/articles/uae-test'),'article');
  assert.equal(publicEdgeTtlSeconds('/articles/a-1'),600);
  assert.equal(publicEdgeTtlSeconds('/sitemap.xml'),900);
  assert.equal(publicEdgeTtlSeconds('/blog'),300);
});

test('article metadata uses existing R2 GET response and leaves a backward compatible fallback',()=>{
  const render=readFileSync(new URL('../auto-platform.js',import.meta.url),'utf8');
  const enhance=readFileSync(new URL('../premium-entry.js',import.meta.url),'utf8');
  const edge=readFileSync(new URL('../discovery-entry.js',import.meta.url),'utf8');
  assert.match(render,/'x-r2-article-metadata':'v1'/);
  assert.match(render,/'x-article-published-at':published/);
  assert.match(enhance,/res\.headers\.get\('x-r2-article-metadata'\)==='v1'/);
  assert.match(enhance,/else\{\s*try\{const o=await env\.CONTENT_FINAL\.head/);
  assert.match(edge,/EDGE_CACHE_POLICY_REVISION/);
  assert.match(edge,/publicEdgeCacheEligible\(req,u\)/);
});
