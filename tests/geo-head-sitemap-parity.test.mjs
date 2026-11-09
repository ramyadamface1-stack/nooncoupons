import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../discovery-entry.js';

const root='https://noondealsnow.com';

test('published dynamic sitemaps answer HEAD without invoking heavy R2 reads',async()=>{
  const env={SITE_ORIGIN:root,CONTENT_FINAL:{get:async()=>{throw Error('HEAD must not touch R2 for stable dynamic sitemap')}}};
  for(const path of ['/sitemap-hubs.xml','/sitemap-priority.xml']){
    const res=await app.fetch(new Request(root+path,{method:'HEAD'}),env,{});
    assert.equal(res.status,200,path);
    assert.match(res.headers.get('content-type')||'',/application\/xml/);
    assert.equal(res.headers.get('x-sitemap-head-parity'),'v1');
    assert.equal(await res.text(),'');
  }
});

test('HEAD for existing R2 sitemap archive consults the published manifest, not the 2k article segment',async()=>{
  const keys=[];
  const manifest={version:1,count:2000,segments:[{n:32,count:2000,key:'seo-rescue/segments/32.json'}],englishSegments:[{n:0,count:1,key:'seo-rescue/english/0.json'}]};
  const env={SITE_ORIGIN:root,CONTENT_FINAL:{get:async key=>{
    keys.push(key);
    if(key==='seo-rescue/index.json')return {text:async()=>JSON.stringify(manifest),customMetadata:{}};
    return null;
  }}};
  const yes=await app.fetch(new Request(root+'/sitemap-rescue-articles-32.xml',{method:'HEAD'}),env,{});
  assert.equal(yes.status,200);
  assert.match(yes.headers.get('content-type')||'',/application\/xml/);
  assert.equal(await yes.text(),'');
  const no=await app.fetch(new Request(root+'/sitemap-rescue-articles-999.xml',{method:'HEAD'}),env,{});
  assert.equal(no.status,404);
  assert.ok(keys.includes('seo-rescue/index.json'));
  assert.ok(!keys.includes('seo-rescue/segments/32.json'),'HEAD must never load/render a full archive sitemap');
});

test('noncanonical or private HEAD routes are not turned into successful sitemaps',async()=>{
  const env={SITE_ORIGIN:root,CONTENT_FINAL:{get:async()=>null}};
  const res=await app.fetch(new Request(root+'/sitemap-rescue-articles-999.xml',{method:'HEAD'}),env,{});
  assert.notEqual(res.status,200);
});
