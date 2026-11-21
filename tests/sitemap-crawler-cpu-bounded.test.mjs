import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROVED_COUPON_CODES} from '../approved-coupons.js';
import {coreSitemap,prioritySitemap,hubSitemap,imageSitemap,englishRecentSitemap,boundedEnglishSitemapRecords,sitemapArticleLastmod} from '../discovery-entry.js';

const ORIGIN='https://noondealsnow.com';
function fakeR2({englishAvailable=true,englishArticles=null}={}){
  const calls=[];
  const sa={slug:'saudi-article-nov170',country:'SA',status:'published',quality:98,qualityFloor:92,wordCount:1900,
    createdAt:'2026-11-07T14:00:00Z',updatedAt:'2026-11-08T14:00:00Z',
    coupon:'NOV170',categoryKey:'mobiles',brandKey:'apple',modelKey:'iphone'};
  const ae={slug:'en-uae-nov188-verified',urlPath:'/en/articles/en-uae-nov188-verified',
    languageSource:'native-intent-v6-canary',country:'AE',status:'published',indexable:true,
    quality:97,qualityFloor:92,wordCount:1250,createdAt:'2026-11-08T10:00:00Z',
    updatedAt:'2026-11-08T10:00:00Z',coupon:'NOV188',categoryKey:'beauty',brandKey:'noon'};
  const env={CONTENT_FINAL:{get:async key=>{
    calls.push(key);
    // This object can grow to many MB and must NEVER be read on a public
    // priority, hub, or image sitemap route under the Worker Free CPU limit.
    if(key==='english-canary/state.json')throw Error('unbounded-English-state-fetch');
    if(key==='english-canary/public-recent-v1.json'&&englishAvailable)
      return {json:async()=>({version:1,articles:englishArticles??[ae]})};
    if(key==='bulk/public-compact-v1.json')
      return {json:async()=>({version:1,articles:[sa]})};
    return null;
  }}};
  return {env,calls};
}
test('always-discoverable core sitemap directly exposes all ten canonical NOV details',async()=>{
  const res=coreSitemap(ORIGIN),xml=await res.text();
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-type'),/xml/);
  for(const code of APPROVED_COUPON_CODES){
    const uri=ORIGIN+'/coupon/'+code.toLowerCase();
    assert.ok(xml.includes('<loc>'+uri+'</loc>'),uri);
  }
  assert.ok(xml.includes('<loc>'+ORIGIN+'/saudi</loc>'));
  assert.ok(xml.includes('<loc>'+ORIGIN+'/uae</loc>'));
});
test('CPU-bounded priority, hubs and images use only precomputed R2 public snapshots',async()=>{
  const {env,calls}=fakeR2();
  for(const [label,fn,expected] of [
    ['priority',prioritySitemap,'en-uae-nov188-verified'],
    ['hubs',hubSitemap,'/en/uae/noon-coupon-code'],
    ['images',imageSitemap,'en-uae-nov188-verified'],
    ['english',englishRecentSitemap,'en-uae-nov188-verified']
  ]){
    const res=await fn(env,ORIGIN),xml=await res.text();
    assert.equal(res.status,200,label);
    assert.match(res.headers.get('content-type'),/xml/);
    assert.ok(xml.includes('<urlset'),label);
    assert.ok(xml.includes(expected),label+' missing quality-gated English projection');
  }
  assert.ok(calls.includes('english-canary/public-recent-v1.json'));
  assert.ok(!calls.includes('english-canary/state.json'),'Must never parse full English state on public sitemap');
  assert.ok(!calls.includes('bulk/latest.json'),'Must prefer the 300-entry compact public manifest');
});
test('priority sitemap deduplicates a static English hub without losing a verified lastmod',async()=>{
  const {env}=fakeR2();
  const xml=await (await prioritySitemap(env,ORIGIN)).text();
  const canonical='<loc>'+ORIGIN+'/en/uae/noon-coupon-code</loc>';
  assert.equal(xml.split(canonical).length-1,1,'the hub must appear only once');
  assert.ok(xml.includes(canonical+'<lastmod>2026-11-08T10:00:00.000Z</lastmod>'),
    'the dynamic article update must not be hidden by a static sitemap entry: '+xml.slice(xml.indexOf(canonical),xml.indexOf(canonical)+180));
});
test('missing English snapshot degrades to stable valid XML without heavy-state fallback',async()=>{
  const {env,calls}=fakeR2({englishAvailable:false});
  const english=await boundedEnglishSitemapRecords(env);
  assert.deepEqual(english,[]);
  for(const fn of [prioritySitemap,hubSitemap,imageSitemap,englishRecentSitemap]){
    const res=await fn(env,ORIGIN),xml=await res.text();
    assert.equal(res.status,200);
    assert.ok(xml.startsWith('<?xml version="1.0"'));
  }
  assert.ok(!calls.includes('english-canary/state.json'));
});
test('English sitemaps submit only category and product hubs that meet page indexability thresholds',async()=>{
  const record=(slug,categoryKey,title)=>({slug,urlPath:'/en/articles/'+slug,
    languageSource:'native-intent-v6-canary',country:'AE',status:'published',indexable:true,
    quality:98,qualityFloor:92,wordCount:1600,categoryKey,title,
    createdAt:'2026-11-19T10:00:00Z',updatedAt:'2026-11-19T10:00:00Z'});
  const sparse=fakeR2({englishArticles:[
    record('beauty-one','beauty','Beauty cart checklist'),
    record('phone-one','mobiles','iPhone 18 Pro Max buying guide')
  ]});
  for(const fn of [prioritySitemap,hubSitemap]){
    const xml=await (await fn(sparse.env,ORIGIN)).text();
    assert.ok(!xml.includes('<loc>'+ORIGIN+'/en/uae/category/beauty</loc>'));
    assert.ok(!xml.includes('<loc>'+ORIGIN+'/en/uae/product/iphone-18-pro-max</loc>'));
  }
  const core=await coreSitemap(ORIGIN).text();
  assert.ok(!core.includes('<loc>'+ORIGIN+'/en/uae/category/grocery</loc>'),
    'Core sitemap must not advertise a conditional noindex grocery hub');
  const mature=fakeR2({englishArticles:[
    record('grocery-one','grocery','Grocery shopper guide'),
    record('grocery-two','grocery','Noon Grocery cart guide'),
    record('phone-one','mobiles','iPhone 18 Pro Max buying guide'),
    record('phone-two','mobiles','iPhone 18 Pro Max seller guide')
  ]});
  for(const fn of [prioritySitemap,hubSitemap]){
    const xml=await (await fn(mature.env,ORIGIN)).text();
    assert.ok(xml.includes('<loc>'+ORIGIN+'/en/uae/category/grocery</loc>'));
    assert.ok(xml.includes('<loc>'+ORIGIN+'/en/uae/product/iphone-18-pro-max</loc>'));
  }
});
test('priority sitemap retains verified canonical English search recovery targets, not redirecting slugs',async()=>{
  const {env}=fakeR2({englishAvailable:false});
  const xml=await (await prioritySitemap(env,ORIGIN)).text();
  for(const path of [
    '/en/articles/en-iphone-18-pro-max-noon-abu-dhabi-price',
    '/en/articles/en-iphone-duo-noon-abu-dhabi-coupon-code'
  ])assert.ok(xml.includes('<loc>'+ORIGIN+path+'</loc>'),path);
  assert.ok(!xml.includes('/en/articles/en-iphone-duo-noon-abu-dhabi-deals</loc>'));
});

test('sitemap lastmod uses real publication and verified editorial revisions, not sync timestamps',async()=>{
  const published='2026-10-05T09:00:00.000Z';
  const revision='2026-11-18T16:00:00.000Z';
  const snapshot={slug:'sample-safe',country:'SA',status:'published',quality:98,qualityFloor:92,wordCount:1800,
    createdAt:published,updatedAt:'2026-11-20T22:50:00.000Z',categoryKey:'mobiles'};
  assert.equal(sitemapArticleLastmod(snapshot,new Date('2026-11-21T00:00:00Z')),published);
  assert.equal(sitemapArticleLastmod({...snapshot,editorialUpdatedAt:revision},new Date('2026-11-21T00:00:00Z')),revision);
  assert.equal(sitemapArticleLastmod({...snapshot,editorialUpdatedAt:'2026-12-10T00:00:00Z'},new Date('2026-11-21T00:00:00Z')),published);
  assert.equal(sitemapArticleLastmod({...snapshot,publishedAt:'2026-12-10T00:00:00Z'},new Date('2026-11-21T00:00:00Z')),null);
  assert.equal(sitemapArticleLastmod({...snapshot,createdAt:'nonsense'},new Date('2026-11-21T00:00:00Z')),null);
  // Use the English projection (not the shared cached Arabic manifest) for
  // integration assertions so unrelated earlier tests cannot contaminate data.
  const english={...snapshot,slug:'english-safe',urlPath:'/en/articles/english-safe',country:'AE',
    languageSource:'native-intent-v6-canary',wordCount:1400};
  const englishEnv=fakeR2({englishArticles:[english]});
  const enXml=await (await englishRecentSitemap(englishEnv.env,ORIGIN)).text();
  assert.ok(enXml.includes('<loc>'+ORIGIN+'/en/articles/english-safe</loc><lastmod>'+published+'</lastmod>'));
  assert.ok(!enXml.includes('<lastmod>'+snapshot.updatedAt+'</lastmod>'));
  const priority=await (await prioritySitemap(englishEnv.env,ORIGIN)).text();
  assert.ok(priority.includes('<loc>'+ORIGIN+'/en/articles/english-safe</loc><lastmod>'+published+'</lastmod>'));
  const hubs=await (await hubSitemap(englishEnv.env,ORIGIN)).text();
  assert.ok(hubs.includes('<loc>'+ORIGIN+'/en/uae/noon-coupon-code</loc><lastmod>'+published+'</lastmod>'));
});
