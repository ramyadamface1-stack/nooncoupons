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


test('closed global AI publication window returns before heavy R2 quality reads or slot claim',async()=>{
 const {createHash}=await import('node:crypto');
 const digest=createHash('sha256').update(base.article.html).digest('hex');
 const input={...base,checkpoint:{...base.checkpoint,contentHash:digest}};
 const log=[],next='2026-11-10T21:05:00.000Z';
 const env={
  CONTENT_FINAL:{
   async get(){log.push('R2_GET');throw Error('Heavy original quality data must not be read')},
   async head(){log.push('R2_HEAD');throw Error('No article HEAD before due')},
   async put(){log.push('R2_WRITE');throw Error('No article write before due')}
  },
  GENERATOR_CONTROL:{
   idFromName(name){assert.equal(name,'primary');return 'id'},
   get(){return{fetch:async(_,options)=>{
    log.push(options.method);
    assert.equal(options.method,'GET','The first slot probe must NEVER claim the slot');
    return new Response(JSON.stringify({
     ok:true,aiV2Eligible:false,aiV2NextEligibleAt:next,eligible:true
    }),{status:200,headers:{'content-type':'application/json'}});
   }}}
  }
 };
 const result=await publishAiV2NativeArticle(env,input);
 assert.deepEqual(result,{ok:false,reason:'GLOBAL_PUBLICATION_SLOT_NOT_DUE',nextEligibleAt:next});
 assert.deepEqual(log,['GET'],'No heavy quality audit, no R2 write and no publication claim');
});

test('closed publication check remains fail-closed for malformed or missing DO policy',async()=>{
 const {createHash}=await import('node:crypto');
 const digest=createHash('sha256').update(base.article.html).digest('hex');
 const input={...base,checkpoint:{...base.checkpoint,contentHash:digest}};
 let calls=0;
 const env={CONTENT_FINAL:{async get(){throw Error('must not read R2')}},
  GENERATOR_CONTROL:{idFromName:()=> 'id',get:()=>({fetch:async()=>{calls++;return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})}})}
 };
 const result=await publishAiV2NativeArticle(env,input);
 assert.equal(result.reason,'GLOBAL_PUBLICATION_SLOT_NOT_DUE');
 assert.equal(calls,1);
 const source=(await import('node:fs')).readFileSync(new URL('../ai-v2-native-publish-bridge.js',import.meta.url),'utf8');
 const precheckAt=source.indexOf("const earlySlot=await getPublicationSlotStatus");
 const auditAt=source.indexOf("const originals=await readFullNativeQualityFeed");
 const claimAt=source.indexOf("const permit=await claimPublicationSlot");
 const writeAt=source.indexOf("const saved=await env.CONTENT_FINAL.put");
 assert.ok(precheckAt>=0&&precheckAt<auditAt&&auditAt<claimAt&&claimAt<writeAt);
});
