import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicRouteKind,publicEdgeCacheEligible,publicEdgeTtlSeconds} from '../r2-public-cache-policy.js';

// Cloudflare sample observed intermittent Googlebot 503 on /sitemap-hubs.xml.
// This test protects read-only edge caching, not a change to indexable URLs.
const source=readFileSync(new URL('../discovery-entry.js',import.meta.url),'utf8');

for(const path of ['/sitemap-hubs.xml','/sitemap-priority.xml']){
  test('dynamic '+path+' is a cacheable public XML route',()=>{
    const req=new Request('https://noondealsnow.com'+path);
    assert.equal(publicRouteKind(path),'xml');
    assert.equal(publicEdgeCacheEligible(req,new URL(req.url)),true);
    assert.ok(publicEdgeTtlSeconds(path)>=900);
    const code=path==='/sitemap-hubs.xml'?'hubSitemap':'prioritySitemap';
    const route="if(req.method==='GET'&&u.pathname==='"+path+"'){const r=await "+code+"(env,origin)";
    assert.ok(source.includes(route),'Do not replace existing on-demand sitemap renderer');
    const body=source.substring(source.indexOf(route),source.indexOf(route)+450);
    assert.ok(body.includes('edgePageCachePut(req,u,new Response(r.body,{status:r.status,statusText:r.statusText,headers:h}),ctx)'), 'Expose successful sitemap XML through the already-approved Cloudflare cache');
    assert.ok(body.includes("h.set('x-runtime-revision',DISCOVERY_RELEASE)"),'Preserve runtime response marker');
  });
  test('private requests and noncanonical query strings must not populate '+path+' cache',()=>{
    const u=new URL('https://noondealsnow.com'+path);
    assert.equal(publicEdgeCacheEligible(new Request(u,{headers:{Authorization:'Bearer private'}}),u),false);
    assert.equal(publicEdgeCacheEligible(new Request('https://noondealsnow.com'+path+'?x=test'),new URL('https://noondealsnow.com'+path+'?x=test')),false);
  });
}
test('historical R2 rescue shards retain their previously approved cache path',()=>{
  assert.ok(source.includes('return edgePageCachePut(req,u,historical,ctx)'));
  assert.equal(publicRouteKind('/sitemap-rescue-articles-32.xml'),'xml');
  assert.ok(!source.includes('fetch("https://www.noon.com'));
});

test('historical rescue XML keeps long edge TTL; live publishing keeps short TTL',()=>{
  for(const kind of ['articles','images','english','english-images']){
    assert.equal(publicEdgeTtlSeconds('/sitemap-rescue-'+kind+'-25.xml'),86400);
  }
  assert.equal(publicEdgeTtlSeconds('/sitemap-live-recent.xml'),60);
  assert.equal(publicEdgeTtlSeconds('/sitemap-hubs.xml'),900);
  assert.equal(publicEdgeTtlSeconds('/sitemap-rescue-catalog.xml'),900);
});
