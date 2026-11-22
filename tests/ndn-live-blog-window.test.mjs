import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBlogWindowRows,liveBlogResponse,LIVE_BLOG_ROUTES} from '../live-blog-window.js';
import {publicRouteKind,publicEdgeCacheEligible,publicEdgeTtlSeconds} from '../r2-public-cache-policy.js';
const NOW=Date.parse('2026-11-22T20:00:00.000Z');
const article=(slug,country,publishedAt,extra={})=>({
 slug,country,publishedAt,status:'published',indexable:true,quality:98,wordCount:1670,
 title:country==='AE'?'Ninja air fryer: basket fit and parts | Noon UAE NOV188':'نينجا قلاية هوائية: فحص السلة وقطع الغيار | نون السعودية',
 metaDescription:'Compare the selected product, model, seller, returns, delivery and actual checkout cost before ordering.',
 coupon:country==='AE'?'NOV188':'NOV170',...extra
});
function storage(data){
 let gets=0;return {
  get gets(){return gets},
  CONTENT_FINAL:{
   async get(key){gets++;assert.equal(key,'blog/latest-live-v1.json');return data===null?null:{json:async()=>data}},
   async list(){throw Error('NO_FULL_R2_SCAN_ALLOWED')},
   async put(){throw Error('NO_R2_WRITES_ALLOWED')},
   async head(){throw Error('NO_ARTICLE_HEAD_REQUESTS_ALLOWED')}
  }
 };
}
const rows=[
 article('uae-buyer-ninja-air-fryer-safe-checklist-nov188','AE','2026-11-22T19:56:00Z'),
 article('saudi-buyer-ninja-air-fryer-safe-checklist-nov170','SA','2026-11-22T19:54:00Z'),
 article('uae-buyer-ninja-air-fryer-safe-checklist-nov188','AE','2026-11-22T19:50:00Z',{title:'duplicate'}),
 article('saudi-buyer-hidden-draft-checklist-nov170','SA','2026-11-22T19:52:00Z',{status:'draft'}),
 article('uae-buyer-ineligible-wordcount-check-nov188','AE','2026-11-22T19:53:00Z',{wordCount:900}),
 article('uae-buyer-future-dated-checklist-nov188','AE','2026-11-23T19:00:00Z'),
 article('uae-buyer-noindex-hidden-checklist-nov188','AE','2026-11-22T19:55:00Z',{indexable:false})
];
const journal={version:1,updatedAt:'2026-11-22T19:57:00Z',articles:rows};
test('one bounded, quality-gated journal feeds the newest 15, not an archive scan or invented count',()=>{
 const win=liveBlogWindowRows(journal,{now:NOW});
 assert.equal(win.latest.length,2);
 assert.equal(win.journalEligible,2);
 assert.equal(win.observedLastHour,2);
 assert.deepEqual(win.latest.map(x=>x.country),['AE','SA']);
 assert.equal(win.latest[0].code,'NOV188');
 assert.equal(win.latest[1].code,'NOV170');
 assert.ok(win.latest.every(x=>x.href.startsWith('/articles/')));
 assert.throws(()=>liveBlogWindowRows({version:1,articles:new Array(451)}),/JOURNAL_INVALID/);
 assert.throws(()=>liveBlogWindowRows(journal,{limit:100}),/OPTIONS_INVALID/);
});
test('all three live pages are self-canonical with single R2 GET and country-specific coupon links',async()=>{
 for(const [path,market] of Object.entries(LIVE_BLOG_ROUTES)){
  const env=storage(journal);
  const res=await liveBlogResponse(new Request('https://noondealsnow.com'+path),env,{now:NOW});
  assert.equal(res.status,200,path);
  assert.equal(env.gets,1,'only one bounded journal GET '+path);
  const body=await res.text();
  assert.match(body,/<meta name="robots" content="index,follow,max-image-preview:large">/);
  assert.ok(body.includes('<link rel="canonical" href="https://noondealsnow.com'+path+'">'));
  assert.ok(body.includes('data')===false||!body.includes('api-secret'));
  assert.match(body,/<script type="application\/ld\+json">/);
  assert.match(body,/\/articles\//);
  assert.ok(body.includes(market==='AE'?'lang="en-AE" dir="ltr"':'lang="ar-SA" dir="rtl"'));
  assert.ok(body.includes(market==='AE'?'NOV188':'NOV170'));
  if(market==='SA')assert.doesNotMatch(body,/data-coupon="NOV188"/);
  if(market==='AE')assert.doesNotMatch(body,/data-coupon="NOV170"/);
 }
});
test('live JSON view returns redacted public rows only and ignores query-based caching',async()=>{
 const env=storage(journal),url='https://noondealsnow.com/blog/latest/uae?format=json';
 const req=new Request(url),res=await liveBlogResponse(req,env,{now:NOW});
 const payload=await res.json();
 assert.equal(res.status,200);
 assert.equal(env.gets,1);
 assert.equal(payload.ok,true);
 assert.equal(payload.source,'approved-public-r2-journal');
 assert.equal(payload.market,'AE');
 assert.equal(payload.observedLastHour,1);
 assert.equal(payload.articles.length,1);
 assert.equal(payload.articles[0].country,'AE');
 assert.equal(payload.articles[0].code,'NOV188');
 assert.equal(res.headers.get('x-robots-tag'),'noindex');
 assert.equal(publicEdgeCacheEligible(req),false,'query JSON must not become HTML cache');
 assert.doesNotMatch(JSON.stringify(payload),/keyRef|credentials|apiKey|authorization/i);
});
test('malformed source and missing storage fail visibly rather than showing zero published',async()=>{
 for(const source of [null,{version:9,articles:[]},{version:1,articles:[]}]){
  const env=storage(source);
  const res=await liveBlogResponse(new Request('https://noondealsnow.com/blog/latest'),env,{now:NOW});
  assert.equal(res.status,503);
  assert.equal(res.headers.get('x-robots-tag'),'noindex,nofollow');
  assert.equal(res.headers.get('cache-control'),'no-store');
 }
 assert.equal((await liveBlogResponse(new Request('https://noondealsnow.com/blog/latest'),{}, {now:NOW})).status,503);
 assert.equal(await liveBlogResponse(new Request('https://noondealsnow.com/blog'),storage(journal),{now:NOW}),null);
});
test('untrusted journal strings are escaped in HTML and images retain one valid entity',async()=>{
 const a=article('uae-buyer-safe-html-escaping-noon-nov188','AE','2026-11-22T19:56:00Z',{
  title:'Ninja air fryer <img src=x onerror=alert(1)>',
  metaDescription:'Check <b>exact</b> seller details and the official cart before a purchase.'});
 const res=await liveBlogResponse(new Request('https://noondealsnow.com/blog/latest/uae'),
  storage({version:1,articles:[a]}),{now:NOW});
 const body=await res.text();
 assert.equal(res.status,200);
 assert.doesNotMatch(body,/<img src=x onerror=/);
 assert.match(body,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(body,/\.svg\?v=12&amp;country=AE&amp;coupon=NOV188/);
 assert.doesNotMatch(body,/&amp;amp;/);
});
test('live pages are explicit 45-second-cacheable public routes; original blog stays static-first',()=>{
 for(const path of Object.keys(LIVE_BLOG_ROUTES)){
  assert.equal(publicRouteKind(path),'page');
  assert.equal(publicEdgeTtlSeconds(path),45);
  assert.equal(publicEdgeCacheEligible(new Request('https://noondealsnow.com'+path)),true);
 }
 assert.equal(publicEdgeTtlSeconds('/blog'),30);
 assert.equal(publicEdgeCacheEligible(new Request('https://noondealsnow.com/blog?page=2')),false);
 assert.equal(publicRouteKind('/api/admin'),null);
});
