import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderApprovedNativeAiV2Fast,rescueGscSnippet,refreshArtworkUrlsInHtml} from '../r2-emergency-readonly.js';
const url=new URL('https://noondealsnow.com/articles/saudi-buyer-samsung-tablet-offline-annotation-workflow-nov170-2026-n5');
const source='<article><h1>جدول مقارنة سامسونج تابلت</h1><p>'+('معايير مقارنة الكود NOV170 والمواصفات والضمان وشروط نون السعودية. '.repeat(110))+'</p></article>';
const item={body:source,meta:{status:'published',p:'ai-v2-native',c:'SA',cp:'NOV170',q:'100',w:'1775',
  t:encodeURIComponent('دليل مقارنة تابلت سامسونج نون السعودية NOV170'),
  m:encodeURIComponent('دليل عملي للتحقق من التوافق والضمان والشحن والأهلية في سلة نون السعودية قبل الدفع.')}};
test('already approved native article has bounded public rendering without rewriting original source or dropping coupon',async()=>{
 const r=renderApprovedNativeAiV2Fast(item,url.pathname.split('/').pop(),url,false);
 assert.equal(r?.status,200);
 assert.equal(r.headers.get('x-native-article-renderer'),'approved-fast-v1');
 const html=await r.text();
 assert.ok(html.includes(source),'keep approved article bytes');
 assert.ok(html.includes('NOV170'));
 assert.ok(html.includes('rel="canonical"'));
 assert.ok(html.includes('article-topic-path'));
 assert.ok(html.includes('index,follow'));
});
test('only actual native QA-approved, country-matched originals take fast route',()=>{
 for(const patch of [
  {status:'scheduled'},{p:'legacy-bulk'},{q:'94'},{w:'1499'},
  {cp:'NOV188'},{c:'AE'}
 ]){
  const r=renderApprovedNativeAiV2Fast({...item,meta:{...item.meta,...patch}},
   url.pathname.split('/').pop(),url,false);
  assert.equal(r,null,JSON.stringify(patch));
 }
 assert.equal(renderApprovedNativeAiV2Fast({...item,body:'<article>no coupon</article>'},
  'bad',url,false),null);
});

test('AE approved native article uses cheap metadata-backed fast renderer and the market-approved code',async()=>{
 const u=new URL('https://noondealsnow.com/articles/uae-buyer-baseus-powerbank-long-storage-charge-care-nov188-2026-n6');
 const native='<article><h1>UAE comparison and shopping guide</h1><p>'+('Compare practical battery features and verify NOV188 at checkout. '.repeat(125))+'</p></article>';
 const itemAE={body:native,meta:{status:'published',p:'ai-v2-native',c:'AE',cp:'NOV188',q:'100',w:'1605',
   t:encodeURIComponent('Baseus battery storage guide | Noon UAE NOV188'),
   m:encodeURIComponent('A purchase decision guide covering practical battery features and seller verification for Noon UAE.')}};
 const response=renderApprovedNativeAiV2Fast(itemAE,u.pathname.split('/').at(-1),u,false);
 assert.equal(response?.status,200,'fast renderer must recognize real <article> and <h1> tags');
 assert.equal(response.headers.get('x-native-article-renderer'),'approved-fast-v1');
 const html=await response.text();
 assert.ok(html.includes(native),'Native original article bytes were altered');
 assert.ok(html.includes('NOV188'));
 assert.ok(html.includes('href="'+u.href+'"'));
 // The global site navigation may legitimately mention Saudi codes; assert
 // the actual article content and its primary market-specific CTA instead.
 assert.match(html, /<article class="rescue-article" data-market="AE">/);
 assert.ok(html.includes('NOV188'));
 assert.ok(!native.includes('NOV170'));

 assert.ok(!html.includes('Quality 100'),'No internal quality score in public HTML');
});
test('native fast eligibility correctly recognizes real HTML boundaries, not literal slash-b',()=>{
 const source=readFileSync(new URL('../r2-emergency-readonly.js',import.meta.url),'utf8');
 assert.ok(source.includes(String.raw`/<article\b/i.test(source)`));
 assert.ok(source.includes(String.raw`/<h1\b/i.test(source)`));
 assert.ok(!source.includes(String.raw`/<article\\b/i.test(source)`));
 assert.ok(!source.includes(String.raw`/<h1\\b/i.test(source)`));
});
test('high-impression Search Console pages get honest English snippet updates without changing slugs',async()=>{
 const slug='en-iphone-18-pro-max-noon-abu-dhabi-price';
 const u=new URL('https://noondealsnow.com/en/articles/'+slug);
 const original='<article><h1>iPhone 18 Pro Max Noon Abu Dhabi price</h1><p>'+('Compare the seller and final checkout total. NOV188. '.repeat(130))+'</p></article>';
 const record={body:original,meta:{status:'published',p:'ai-v2-native',c:'AE',cp:'NOV188',q:'99',w:'1775',
   t:encodeURIComponent('iPhone 18 Pro Max Noon Abu Dhabi price'),
   m:encodeURIComponent('A generic original shopping guide for this product on Noon UAE.')}};
 const response=renderApprovedNativeAiV2Fast(record,slug,u,true);
 assert.equal(response?.status,200);
 const html=await response.text();
 assert.match(html,/<title>iPhone 18 Pro Max in Abu Dhabi on Noon UAE \| Price Guide \| Noon Deals Now<\/title>/);
 assert.match(html,/<meta name="description" content="Compare iPhone 18 Pro Max listings/);
 assert.match(html,/rel="canonical" href="https:\/\/noondealsnow\.com\/en\/articles\/en-iphone-18-pro-max-noon-abu-dhabi-price"/);
 assert.match(html,/v=11&amp;country=AE&amp;coupon=NOV188/);
 assert.match(html,/width="1600" height="1000"/);
 assert.ok(html.includes(original),'R2 article body must not be rewritten');
 assert.equal(rescueGscSnippet('an-old-unchanged-page','Original','Existing',true).optimized,false);
 assert.equal(rescueGscSnippet(slug,'Original','Existing',false).optimized,false,'Saudi or Arabic fallback must not take English SEO snippets');
});
test('legacy image query versions are refreshed in HTML without altering article routes or coupons',()=>{
  const source='<img src="/assets/coupon-svg/saudi-guide/2.svg?v=9&amp;coupon=NOV170&amp;country=SA"><a href="/articles/saudi-guide">Read</a>';
  const html=refreshArtworkUrlsInHtml(source);
  assert.match(html,/\/2\.svg\?v=11&amp;coupon=NOV170/);
  assert.match(html,/href="\/articles\/saudi-guide"/);
  assert.ok(!html.includes('v=9'));
  assert.equal(refreshArtworkUrlsInHtml(html),html);
});
