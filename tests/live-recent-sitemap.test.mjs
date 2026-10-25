import test from 'node:test';
import assert from 'node:assert/strict';
import {rescueSitemapIndexPaths,rescueSitemapResponse,emergencyPublicR2Response} from '../r2-emergency-readonly.js';
import {publicEdgeTtlSeconds} from '../r2-public-cache-policy.js';

const env={R2_RESCUE_READONLY_ENABLED:'true',NOON_RESCUE_R2_ACCESS_KEY_ID:'UNIT_TEST_ID',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'UNIT_TEST_SECRET'};
const now=new Date().toISOString();
const feed={version:1,updatedAt:now,articles:[
  {slug:'new-sa-approved',title:'Saudi approved',status:'published',country:'SA',quality:100,wordCount:1700,publishedAt:now,coupon:'NOV170'},
  {slug:'en-new-uae-approved',title:'UAE approved',status:'published',country:'AE',quality:95,wordCount:1500,publishedAt:now,coupon:'NOV188'},
  {slug:'draft-not-public',status:'draft',country:'SA',quality:100,wordCount:1700,publishedAt:now},
  {slug:'low-quality-hidden',status:'published',country:'SA',quality:94,wordCount:1700,publishedAt:now},
  {slug:'thin-hidden',status:'published',country:'SA',quality:100,wordCount:350,publishedAt:now},
  {slug:'future-hidden',status:'published',country:'SA',quality:100,wordCount:1700,publishedAt:'2099-01-01T00:00:00Z'},
  {slug:'new-sa-approved',status:'published',country:'SA',quality:100,publishedAt:now}
]};
async function mockR2(fn){
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    const path=decodeURIComponent(new URL(url).pathname);
    if(path.endsWith('/blog/latest-live-v1.json'))return new Response(JSON.stringify(feed),{status:200,headers:{'content-type':'application/json'}});
    if(path.endsWith('/seo-rescue/index.json'))return new Response(JSON.stringify({version:1,count:2,segments:[{n:0,count:2,key:'seo-rescue/segment-0.json'}]}),{status:200});
    throw Error('Unexpected R2 read '+path);
  };
  try{return await fn()}finally{globalThis.fetch=original}
}
test('live recent sitemap includes only two published quality-gated articles with images',()=>mockR2(async()=>{
  const res=await rescueSitemapResponse('/sitemap-live-recent.xml',env);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('x-sitemap-entries'),'2');
  assert.match(res.headers.get('cache-control'),/s-maxage=60/);
  const xml=await res.text();
  assert.equal((xml.match(/<url>/g)||[]).length,2);
  assert.match(xml,/articles\/new-sa-approved/);
  assert.match(xml,/en\/articles\/en-new-uae-approved/);
  assert.match(xml,/<image:image>/);
  for(const banned of ['draft-not-public','low-quality-hidden','thin-hidden','future-hidden'])assert.ok(!xml.includes(banned));
}));
test('root sitemap advertises the existing R2 journal without touching original shards',()=>mockR2(async()=>{
  const entries=await rescueSitemapIndexPaths(env);
  assert.ok(entries.includes('/sitemap-live-recent.xml'));
  assert.ok(entries.includes('/sitemap-rescue-articles-0.xml'));
  assert.ok(entries.includes('/sitemap-rescue-images-0.xml'));
}));
test('emergency route and 60-second edge policy handle the new public sitemap',()=>mockR2(async()=>{
  const res=await emergencyPublicR2Response(new Request('https://noondealsnow.com/sitemap-live-recent.xml'),env);
  assert.equal(res.status,200);
  assert.equal(publicEdgeTtlSeconds('/sitemap-live-recent.xml'),60);
}));
