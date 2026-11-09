import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROVED_COUPON_CODES} from '../approved-coupons.js';
import {coreSitemap,prioritySitemap,hubSitemap,imageSitemap,boundedEnglishSitemapRecords} from '../discovery-entry.js';

const ORIGIN='https://noondealsnow.com';
function fakeR2({englishAvailable=true}={}){
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
      return {json:async()=>({version:1,articles:[ae]})};
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
    ['hubs',hubSitemap,'/en/uae/category/beauty'],
    ['images',imageSitemap,'en-uae-nov188-verified']
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
test('missing English snapshot degrades to stable valid XML without heavy-state fallback',async()=>{
  const {env,calls}=fakeR2({englishAvailable:false});
  const english=await boundedEnglishSitemapRecords(env);
  assert.deepEqual(english,[]);
  for(const fn of [prioritySitemap,hubSitemap,imageSitemap]){
    const res=await fn(env,ORIGIN),xml=await res.text();
    assert.equal(res.status,200);
    assert.ok(xml.startsWith('<?xml version="1.0"'));
  }
  assert.ok(!calls.includes('english-canary/state.json'));
});
