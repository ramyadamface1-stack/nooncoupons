import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAiV2NativePayload,publishAiV2NativeArticle} from '../ai-v2-native-publish-bridge.js';
const topic={country:'SA',language:'ar-SA',code:'NOV170',slug:'saudi-samsung-storage-warranty-seller-checklist-2026'};
const base={topic,checkpoint:{state:'PREPARED_FOR_NATIVE_AUDIT',articleId:'a'.repeat(24),contentHash:'b'.repeat(64)},
article:{slug:topic.slug,country:'SA',coupon:'NOV170',primaryKeyword:'مقارنة التخزين سامسونج',title:'مقارنة التخزين سامسونج',
metaDescription:'تفاصيل تساعد على المقارنة قبل الطلب',html:'<article><h1>كوبون NOV170</h1><p>https://www.noon.com/</p>'+('<p>معلومات عن الشحن وسلة نون والبائع.</p>'.repeat(250))+'</article>'}};
test('rejects unapproved checkpoint and coupon before all network activity',async()=>{
 let calls=0;
 const env={CONTENT_FINAL:{get(){calls++}},GENERATOR_CONTROL:{}};
 assert.equal((await publishAiV2NativeArticle(env,{...base,checkpoint:{...base.checkpoint,state:'DRAFT_SAVED'}})).reason,'CHECKPOINT_NOT_APPROVED');
 assert.equal(validateAiV2NativePayload({...base,article:{...base.article,coupon:'NOV188'}}).reason,'INVALID_MARKET_COUPON');
 assert.equal(calls,0);
});
test('rejects executable HTML, accepts only structural preview not live approval',()=>{
 assert.equal(validateAiV2NativePayload(base).ok,true);
 assert.equal(validateAiV2NativePayload({...base,article:{...base.article,html:base.article.html+'<img onerror="alert(1)" src=x>'}}).reason,'UNSAFE_MARKUP');
});

test('publisher original full quality index retains signature and category but reuses its one-minute cold read',async()=>{
 const {readFullNativeQualityFeed}=await import('../ai-v2-native-publish-bridge.js');
 let reads=0;
 const original=[{slug:'unique-test',primaryKeyword:'original wording',signature:'important-signature',category:'phones',country:'SA'}];
 const env={CONTENT_FINAL:{get:async key=>{reads++;assert.equal(key,'bulk/latest.json');return {json:async()=>({articles:original})}}}};
 const one=await readFullNativeQualityFeed(env);
 const two=await readFullNativeQualityFeed(env);
 assert.equal(reads,1);
 assert.deepEqual(one,original);
 assert.equal(two[0].signature,'important-signature');
 assert.equal(two[0].category,'phones');
});

test('native publisher prefers the full-signature compact quality index only with an unchanged source ETag',async()=>{
 const {readFullNativeQualityFeed}=await import('../ai-v2-native-publish-bridge.js');
 let getKeys=[],headKeys=[];
 const original=[{slug:'quality-unique-n3',signature:'full-fingerprint',category:'kitchen',country:'AE',blueprint:'test',primaryKeyword:'specific kitchen shopping'}];
 const env={CONTENT_FINAL:{
  head:async key=>{headKeys.push(key);return {etag:'source-unchanged-01'}},
  get:async key=>{
   getKeys.push(key);
   if(key==='_ops/ai-v2-native-quality-index-v1.json')return {json:async()=>({version:1,sourceKey:'bulk/latest.json',sourceEtag:'source-unchanged-01',sourceCount:1,articles:original})};
   throw Error('full original should not be parsed with valid ETag');
  }
 }};
 const res=await readFullNativeQualityFeed(env,Date.now()+122000);
 assert.deepEqual(res,original);
 assert.deepEqual(headKeys,['bulk/latest.json']);
 assert.deepEqual(getKeys,['_ops/ai-v2-native-quality-index-v1.json']);
});
test('native publisher falls back to unabridged quality set on changed source ETag',async()=>{
 const {readFullNativeQualityFeed}=await import('../ai-v2-native-publish-bridge.js');
 let getKeys=[];
 const full=[{slug:'existing-full-quality-item',signature:'secure-sig',country:'SA',primaryKeyword:'unchanged'}];
 const env={CONTENT_FINAL:{
  head:async()=>({etag:'source-changed-now'}),
  get:async key=>{
    getKeys.push(key);
    if(key==='_ops/ai-v2-native-quality-index-v1.json')return {json:async()=>({version:1,sourceKey:'bulk/latest.json',sourceEtag:'stale-source',sourceCount:1,articles:[]})};
    assert.equal(key,'bulk/latest.json');
    return {json:async()=>({articles:full})};
  }
 }};
 const actual=await readFullNativeQualityFeed(env,Date.now()+244000);
 assert.deepEqual(actual,full);
 assert.deepEqual(getKeys,['_ops/ai-v2-native-quality-index-v1.json','bulk/latest.json']);
});


test('rejects old-year seasonal offers presented as current, while keeping historical dates',()=>{
  const old=base.article.html.replace('</article>','<p>Beauty offers 2024 are available now</p></article>');
  assert.equal(validateAiV2NativePayload({...base,article:{...base.article,html:old}}).reason,'STALE_CURRENT_SEASON_CLAIM');
  const historical=base.article.html.replace('</article>','<p>In 2024 the laptop launched as a previous generation.</p></article>');
  assert.equal(validateAiV2NativePayload({...base,article:{...base.article,html:historical}}).ok,true);
});
