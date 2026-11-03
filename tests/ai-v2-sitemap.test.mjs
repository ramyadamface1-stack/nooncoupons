import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeAiV2SitemapResponse} from '../ai-v2-sitemap.js';
const data={version:1,articles:[
 {slug:'saudi-buyer-test-mobile-nov170-2026',country:'SA',publishedAt:'2026-11-03T20:00:00Z'},
 {slug:'uae-buyer-test-laptop-nov188-2026',country:'AE',publishedAt:'2026-11-03T20:01:00Z'}
]};
const env={CONTENT_FINAL:{get:async(key)=>key==='_ops/ai-v2-publication-ledger-v1.json'?{json:async()=>data,etag:'abc'}:null}};
test('native root sitemap lists only bounded published ledger shards',async()=>{
 const r=await nativeAiV2SitemapResponse('/sitemap-ai-v2.xml',env);
 assert.equal(r.status,200);
 const xml=await r.text();assert.match(xml,/sitemapindex/);assert.match(xml,/sitemap-ai-v2-1\.xml/);
 assert.doesNotMatch(xml,/sitemap-ai-v2-2\.xml/);
});
test('native leaf sitemap includes canonical live article URLs and publishedAt',async()=>{
 const r=await nativeAiV2SitemapResponse('/sitemap-ai-v2-1.xml',env);
 const xml=await r.text();
 assert.equal(r.status,200);
 assert.match(xml,/noondealsnow\.com\/articles\/saudi-buyer-test-mobile-nov170-2026/);
 assert.match(xml,/2026-11-03T20:00:00Z/);
 assert.equal((xml.match(/<url>/g)||[]).length,2);
});
test('unavailable ledger yields 503 instead of a misleading empty index',async()=>{
 const r=await nativeAiV2SitemapResponse('/sitemap-ai-v2.xml',{});
 assert.equal(r.status,503);
});
test('unknown shard is not served as a duplicate',async()=>{
 const r=await nativeAiV2SitemapResponse('/sitemap-ai-v2-2.xml',env);
 assert.equal(r.status,404);
});
