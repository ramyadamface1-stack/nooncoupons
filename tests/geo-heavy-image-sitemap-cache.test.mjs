import test from 'node:test';
import assert from 'node:assert/strict';
import {rescueSitemapResponse} from '../r2-emergency-readonly.js';

// Cold 2k-image XML was >1.2 MB and repeatedly triggered Cloudflare Worker
// CPU 1102. The new bounded cache must retain it without modifying source URLs.
test('large immutable image sitemap fits the existing four-slot isolate XML cache',async()=>{
  const part=8947,shard='seo-rescue/geo-cpu-image-proof-8947.json';
  const index={version:1,count:2000,segments:[{n:part,count:2000,key:shard}],englishSegments:[]};
  const articles=Array.from({length:2000},(_,i)=>({slug:'منتجات-'.repeat(6)+i,country:'SA',lastmod:'2026-11-08T01:00:00Z'}));
  const keys=[];
  const env={CONTENT_FINAL:{get:async key=>{
    keys.push(key);
    if(key==='seo-rescue/index.json')return {text:async()=>JSON.stringify(index),customMetadata:{}};
    if(key===shard)return {text:async()=>JSON.stringify({version:1,articles}),customMetadata:{}};
    return null;
  }}};
  const path='/sitemap-rescue-images-'+part+'.xml';
  const first=await rescueSitemapResponse(path,env);
  assert.equal(first.status,200);
  const xml=await first.text();
  assert.ok(xml.length>1200000,'must exercise an image sitemap too big for the old XML cache');
  assert.ok(xml.length<2200000,'must stay within new bounded isolate cache');
  assert.equal((xml.match(/<image:image>/g)||[]).length,2000);
  const before=keys.length;
  const second=await rescueSitemapResponse(path,env);
  assert.equal(second.status,200);
  assert.equal(await second.text(),xml,'all original image/article URLs preserved');
  assert.equal(keys.length,before,'second immutable XML response uses isolate cache');
});
