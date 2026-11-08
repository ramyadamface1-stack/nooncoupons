import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeBoundAiV2ArticleFastResponse} from '../r2-emergency-readonly.js';

const sample=(code,lang)=>'<article lang="'+lang+'"><h1>Verified Noon guide '+code+'</h1><p>'+
  ('Verify Noon seller, official warranty and the final cart with '+code+' before ordering. '.repeat(100))+
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
