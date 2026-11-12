import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeBoundAiV2ArticleFastResponse} from '../r2-emergency-readonly.js';

const sample=(code,lang)=>'<article lang="'+lang+'"><h1>Verified Noon guide '+code+'</h1><p>'+
  (('Verify Noon seller, official warranty and the final cart with '+code+' before ordering. ').repeat(100))+
  '</p><script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:'Verified Noon guide '+code})+'</script></article>';
const metadata=(country,code)=>({
  status:'published',p:'ai-v2-native',c:country,cp:code,q:'100',w:'1775',at:'2026-11-08T20:40:15.702Z',
  t:encodeURIComponent('Safe buying guide | Noon '+country+' '+code),
  m:encodeURIComponent('Compare a real product listing, warranty, delivery and final Noon cart total before payment.')
});
function fixture({country='SA',badMetadata={},body=null,enabled='false'}={}){
  let gets=0,writes=0;
  const code=country==='AE'?'NOV188':'NOV170';
  return {
    env:{R2_RESCUE_READONLY_ENABLED:enabled,CONTENT_FINAL:{
      async get(key){gets++;assert.ok(key.startsWith('articles/'));return{text:async()=>body??sample(code,country==='AE'?'en-AE':'ar-SA'),customMetadata:{...metadata(country,code),...badMetadata}}},
      async put(){writes++;throw Error('Unexpected native R2 write')},
      async list(){writes++;throw Error('Unexpected native R2 listing')}
    }},
    calls:()=>({gets,writes})
  };
}
test('destination-bound Saudi native N6 uses one read and fast HTML with correct indexation and Cairo publication time',async()=>{
  const item=fixture();
  const url='https://noondealsnow.com/articles/saudi-buyer-baseus-powerbank-multiport-power-budget-sharing-nov170-2026-n6?verify=bypass';
  const res=await nativeBoundAiV2ArticleFastResponse(new Request(url),item.env);
  assert.equal(res?.status,200);
  assert.equal(res.headers.get('x-native-article-renderer'),'approved-fast-v1');
  assert.equal(res.headers.get('content-language'),'ar');
  const s=await res.text();
  assert.match(s,/<html lang="ar-SA" dir="rtl"/);
  assert.match(s,/rel="canonical"/);
  assert.match(s,/<meta property="article:published_time"/);
  assert.match(s,/Cairo time/);
  assert.match(s,/<script type="application\/ld\+json"/);
  assert.match(s,/rescue-site-analytics/);
  assert.match(s,/NOV170/);
  assert.ok(!s.includes('verify=bypass'),'Tracking query must not pollute canonical');
  assert.deepEqual(item.calls(),{gets:1,writes:0});
});
test('destination-bound UAE native N6 is English LTR with NOV188 and exactly one safe read',async()=>{
  const item=fixture({country:'AE'});
  const res=await nativeBoundAiV2ArticleFastResponse(
    new Request('https://noondealsnow.com/articles/uae-buyer-baseus-powerbank-multiport-power-budget-sharing-nov188-2026-n6'),item.env);
  assert.equal(res?.status,200);
  assert.equal(res.headers.get('content-language'),'en');
  const s=await res.text();
  assert.match(s,/<html lang="en-AE" dir="ltr"/);
  assert.match(s,/hreflang="en-AE"/);
  assert.match(s,/NOV188/);
  assert.ok(s.includes('Safe buying guide | Noon AE NOV188'));
  assert.deepEqual(item.calls(),{gets:1,writes:0});
});
test('private routes, old articles, unapproved market/code and non-GET never enter direct fast path',async()=>{
  const item=fixture();
  const badUrls=[
    'https://noondealsnow.com/admin',
    'https://noondealsnow.com/api/health',
    'https://noondealsnow.com/articles/old-legacy-article',
    'https://noondealsnow.com/articles/saudi-buyer-baseus-powerbank-multiport-power-budget-sharing-nov188-2026-n6',
    'https://noondealsnow.com/articles/uae-buyer-baseus-powerbank-multiport-power-budget-sharing-nov170-2026-n6'
  ];
  for(const url of badUrls)assert.equal(await nativeBoundAiV2ArticleFastResponse(new Request(url),item.env),null);
  assert.equal(await nativeBoundAiV2ArticleFastResponse(
    new Request('https://noondealsnow.com/articles/saudi-buyer-baseus-powerbank-multiport-power-budget-sharing-nov170-2026-n6',{method:'POST'}),item.env),null);
  assert.deepEqual(item.calls(),{gets:0,writes:0});
});
test('rescue mode and rejected native metadata preserve the existing full legacy route',async()=>{
  const old=fixture({enabled:'true'});
  assert.equal(await nativeBoundAiV2ArticleFastResponse(new Request(
    'https://noondealsnow.com/articles/saudi-buyer-baseus-powerbank-multiport-power-budget-sharing-nov170-2026-n6'),old.env),null);
  assert.deepEqual(old.calls(),{gets:0,writes:0});
  for(const patch of [{status:'scheduled'},{p:'not-native'},{q:'89'},{w:'1000'},{cp:'NOV188'}]){
    const f=fixture({badMetadata:patch});
    const res=await nativeBoundAiV2ArticleFastResponse(new Request(
      'https://noondealsnow.com/articles/saudi-buyer-baseus-powerbank-multiport-power-budget-sharing-nov170-2026-n6'),f.env);
    assert.equal(res,null,JSON.stringify(patch));
    assert.equal(f.calls().writes,0);
  }
});


test('new approved N9 URL missing from native R2 returns uncached 404 without legacy CPU fallback',async()=>{
 let gets=0,writes=0;
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{
  async get(key){gets++;assert.equal(key,'articles/uae-buyer-asus-router-warranty-checklist-nov188-2026-n9.html');return null},
  async put(){writes++;throw Error('no writes')},
  async list(){writes++;throw Error('no list')}
 }};
 const url='https://noondealsnow.com/articles/uae-buyer-asus-router-warranty-checklist-nov188-2026-n9';
 const result=await nativeBoundAiV2ArticleFastResponse(new Request(url),env);
 assert.equal(result.status,404);
 assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal(result.headers.get('x-native-article-absence'),'r2-confirmed-v1');
 assert.equal(gets,1);
 assert.equal(writes,0);
});

test('uncertain native R2 read does not invent an article-absence 404',async()=>{
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{
  async get(){throw Error('temporary R2 failure')}
 }};
 const url='https://noondealsnow.com/articles/saudi-buyer-netgear-router-test-preflight-nov170-2026-n9';
 assert.equal(await nativeBoundAiV2ArticleFastResponse(new Request(url),env),null);
});

test('missing unapproved or legacy URLs never use the native 404 fast path',async()=>{
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{
  async get(){throw Error('R2 must not be read for a non-native slug')}
 }};
 for(const slug of ['legacy-store-article-2026','saudi-buyer-router-test-nov188-2026-n9']){
  assert.equal(await nativeBoundAiV2ArticleFastResponse(
   new Request('https://noondealsnow.com/articles/'+slug),env),null);
 }
});


test('published N10 Saudi and UAE articles use the single-read CPU-safe renderer',async()=>{
 for(const {country,slug,code,language} of [
  {country:'SA',slug:'saudi-buyer-hp-laptop-ssd-replacement-panel-access-nov170-2026-n10',code:'NOV170',language:'ar'},
  {country:'AE',slug:'uae-buyer-xiaomi-phone-nfc-wallet-regional-compatibility-nov188-2026-n10',code:'NOV188',language:'en'}
 ]){
  const item=fixture({country});
  const res=await nativeBoundAiV2ArticleFastResponse(
   new Request('https://noondealsnow.com/articles/'+slug+'?origin=regression'),item.env);
  assert.equal(res?.status,200,country);
  assert.equal(res.headers.get('x-native-article-renderer'),'approved-fast-v1');
  assert.equal(res.headers.get('content-language'),language);
  assert.match(await res.text(),new RegExp(code));
  assert.deepEqual(item.calls(),{gets:1,writes:0},country);
 }
});

test('an unpublished N10 slug is a confirmed, uncached native R2 miss rather than a legacy CPU-heavy fallback',async()=>{
 let calls=0;
 const slug='saudi-buyer-hp-laptop-privacy-safety-nov170-2026-n10';
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{
  async get(key){calls++;assert.equal(key,'articles/'+slug+'.html');return null},
  async put(){throw Error('Native public read must not write')},
  async list(){throw Error('Native public read must not enumerate')}
 }};
 const res=await nativeBoundAiV2ArticleFastResponse(
  new Request('https://noondealsnow.com/articles/'+slug),env);
 assert.equal(res.status,404);
 assert.equal(res.headers.get('cache-control'),'no-store');
 assert.equal(calls,1);
});

test('N10 fast path never admits future/unapproved slugs or cross-market coupon codes',async()=>{
 const item=fixture();
 for(const slug of [
  'saudi-buyer-hp-laptop-ssd-replacement-panel-access-nov188-2026-n10',
  'uae-buyer-xiaomi-phone-nfc-wallet-regional-compatibility-nov170-2026-n10',
  'saudi-buyer-hp-laptop-ssd-replacement-panel-access-nov170-2026-n12',
  'saudi-buyer-hp-laptop-ssd-replacement-panel-access-nov170-2026-n100',
  'saudi-buyer-hp-laptop-ssd-replacement-panel-access-nov170-2026-n4'
 ]){
  const res=await nativeBoundAiV2ArticleFastResponse(
   new Request('https://noondealsnow.com/articles/'+slug),item.env);
  assert.equal(res,null,slug);
 }
 assert.deepEqual(item.calls(),{gets:0,writes:0});
});

test('N11 Saudi and UAE originals use the same cheap native rendering as N10',async()=>{
 const inputs=[
  {country:'SA',slug:'saudi-buyer-samsung-tablet-offline-annotation-workflow-nov170-2026-n11',code:'NOV170',lang:'ar'},
  {country:'AE',slug:'uae-buyer-samsung-tablet-pdf-handwriting-export-file-formats-nov188-2026-n11',code:'NOV188',lang:'en'}
 ];
 for(const row of inputs){
  const item=fixture({country:row.country});
  const res=await nativeBoundAiV2ArticleFastResponse(
   new Request('https://noondealsnow.com/articles/'+row.slug),item.env);
  assert.equal(res?.status,200,row.country);
  assert.equal(res.headers.get('x-native-article-renderer'),'approved-fast-v1');
  assert.equal(res.headers.get('content-language'),row.lang);
  const html=await res.text();
  assert.ok(html.includes(row.code));
  assert.match(html,/rel="canonical"/);
  assert.deepEqual(item.calls(),{gets:1,writes:0});
 }
});

test('unpublished approved N11 article returns uncached 404 instead of expensive 1102 legacy fallback',async()=>{
 const slug='uae-buyer-samsung-tablet-pdf-handwriting-export-file-formats-nov188-2026-n11';
 let gets=0;
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{
  async get(key){gets++;assert.equal(key,'articles/'+slug+'.html');return null},
  async list(){throw Error('Must not enumerate R2')},
  async put(){throw Error('Read-only route must not write')}
 }};
 const response=await nativeBoundAiV2ArticleFastResponse(
  new Request('https://noondealsnow.com/articles/'+slug),env);
 assert.equal(response?.status,404);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('x-native-article-absence'),'r2-confirmed-v1');
 assert.equal(gets,1);
});
