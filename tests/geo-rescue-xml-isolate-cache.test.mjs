import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rescueSitemapResponse} from '../r2-emergency-readonly.js';

const src=readFileSync(new URL('../r2-emergency-readonly.js',import.meta.url),'utf8');

test('bounded per-isolate XML reuse never mutates archive content',()=>{
  assert.ok(src.includes('const rescueXmlCache=new Map()'));
  assert.ok(src.includes('const RESCUE_XML_TTL_MS=10*60*1000'));
  assert.ok(src.includes('const RESCUE_XML_MAX_ENTRIES=4'));
  assert.ok(src.includes('const RESCUE_XML_MAX_BYTES=2200000'));
  assert.ok(src.includes('if(memoized!==null)return xmlResponse(memoized)'));
  assert.ok(src.includes('if(info)rescueXmlCachePut(path,xml)'));
  assert.ok(src.includes("if(!segment)return new Response('Unknown sitemap segment',{status:404})"));
  assert.ok(src.includes("if(!file||file.version!==1||!Array.isArray(file.articles))return new Response('Missing sitemap data',{status:503})"));
});

test('a published 2k-item R2 rescue sitemap is valid and unchanged across requests',async()=>{
  const index={version:1,count:1,segments:[{n:8941,count:1,key:'seo-rescue/geo-cache-proof-8941.json'},{n:8942,count:1,key:'seo-rescue/geo-cache-missing-8942.json'}],englishSegments:[]};
  const rows={version:1,articles:[{slug:'geo-cache-proof-8941',lastmod:'2026-11-08T01:00:00Z',country:'SA'}]};
  const keys=[],env={CONTENT_FINAL:{get:async key=>{
    keys.push(key);
    if(key==='seo-rescue/index.json')return {text:async()=>JSON.stringify(index),customMetadata:{}};
    if(key==='seo-rescue/geo-cache-proof-8941.json')return {text:async()=>JSON.stringify(rows),customMetadata:{}};
    return null;
  }}};
  const p='/sitemap-rescue-articles-8941.xml';
  const first=await rescueSitemapResponse(p,env);
  assert.equal(first.status,200);
  assert.match(first.headers.get('content-type')||'',/application\/xml/);
  const xml=await first.text();
  assert.match(xml,/<urlset/);
  assert.match(xml,/<loc>https:\/\/noondealsnow\.com\/articles\/geo-cache-proof-8941<\/loc>/);
  assert.match(xml,/<lastmod>2026-11-08T01:00:00Z<\/lastmod>/);
  const before=keys.length;
  const second=await rescueSitemapResponse(p,env);
  assert.equal(second.status,200);
  assert.equal(await second.text(),xml);
  assert.equal(keys.length,before,'isolate XML hit must not read R2 again');
  const unknown=await rescueSitemapResponse('/sitemap-rescue-articles-8943.xml',env);
  assert.equal(unknown.status,404,'unlisted shard remains a genuine 404');
  const missing=await rescueSitemapResponse('/sitemap-rescue-articles-8942.xml',env);
  assert.equal(missing.status,503,'manifest-listed but missing segment must never become fake HTTP 200');
});

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
