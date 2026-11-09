import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prebuiltRescueSitemapResponse,rescueSitemapResponse} from '../r2-emergency-readonly.js';

const PATH='/sitemap-rescue-images-25.xml';
const INDEX={version:1,count:1,segments:[{n:25,count:1,key:'seo-rescue/articles-25.json'}],englishSegments:[]};
const SOURCE_ETAG='fake-s3-original-etag-25';
const XML='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://noondealsnow.com/articles/example</loc></url></urlset>';
function fakeEnv(overrides={}){
  const keys=[],headKeys=[];
  const {etag=SOURCE_ETAG,metaTag=SOURCE_ETAG,prebuilt=true}=overrides;
  const env={CONTENT_FINAL:{
    get:async key=>{
      keys.push(key);
      if(key==='seo-rescue/index.json')return {text:async()=>JSON.stringify(INDEX),customMetadata:{}};
      if(key==='seo-rescue/prebuilt-xml/images-25.xml'&&prebuilt)
        return {body:new Response(XML).body,customMetadata:{
          'generated-by':'geo-prebuilt-canary-v1','source-etag':metaTag,
          'source-key':'seo-rescue/articles-25.json','xml-sha256':'independently-validated-by-github'
        }};
      if(key==='seo-rescue/articles-25.json')return {text:async()=>JSON.stringify({version:1,articles:[{slug:'example',country:'SA',lastmod:'2026-11-08'}]})};
      return null;
    },
    head:async key=>{headKeys.push(key);return {etag};}
  }};
  return {env,keys,headKeys};
}

test('verified R2 prebuilt XML is streamed without regenerating the 2k-link source',async()=>{
  const {env,keys,headKeys}=fakeEnv();
  const response=await prebuiltRescueSitemapResponse(PATH,env);
  assert.equal(response?.status,200);
  assert.equal(response?.headers.get('x-r2-rescue-prebuilt'),'etag-verified-v1');
  assert.match(response?.headers.get('content-type')||'',/application\/xml/);
  assert.equal(await response.text(),XML);
  assert.deepEqual(headKeys,['seo-rescue/articles-25.json']);
  assert.ok(keys.includes('seo-rescue/index.json'));
  assert.ok(!keys.includes('seo-rescue/articles-25.json'),'source shard must not be downloaded/parsed when prebuilt tag is valid');
});
test('missing prebuilt XML does not impersonate a valid public sitemap',async()=>{
  const {env}=fakeEnv({prebuilt:false});
  assert.equal(await prebuiltRescueSitemapResponse(PATH,env),null);
});
test('stale prebuilt ETag fails closed to original URL renderer without false 200',async()=>{
  const {env}=fakeEnv({etag:'source-shard-has-changed'});
  assert.equal(await prebuiltRescueSitemapResponse(PATH,env),null);
  const existing=await rescueSitemapResponse(PATH,env);
  assert.equal(existing.status,200);
  assert.match(await existing.text(),/articles\/example/);
});
test('tampered metadata or unsupported paths never serve prebuilt XML',async()=>{
  const {env}=fakeEnv({metaTag:'expired-or-wrong-etag'});
  assert.equal(await prebuiltRescueSitemapResponse(PATH,env),null);
  for(const unsupported of ['/sitemap-rescue-images-24.xml','/sitemap-rescue-articles-25.xml','/sitemap.xml','/coupon/nov170']){
    assert.equal(await prebuiltRescueSitemapResponse(unsupported,env),null);
  }
  assert.equal(await prebuiltRescueSitemapResponse(PATH,{}),null);
});
test('public GET route checks prebuilt before original quality-gated fallbacks',()=>{
  const src=readFileSync(new URL('../discovery-entry.js',import.meta.url),'utf8');
  assert.ok(src.includes("prebuiltRescueSitemapResponse(u.pathname,env)"));
  assert.ok(src.includes("if(prebuilt)return edgePageCachePut(req,u,prebuilt,ctx)"));
  assert.ok(src.indexOf("prebuiltRescueSitemapResponse(u.pathname,env)")<src.indexOf("const historical=await rescueSitemapResponse(u.pathname,env)"));
  assert.ok(src.includes('if(historical)return edgePageCachePut(req,u,historical,ctx)'));
});
