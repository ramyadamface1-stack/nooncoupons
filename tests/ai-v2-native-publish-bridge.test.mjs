import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAiV2NativePayload,publishAiV2NativeArticle} from '../ai-v2-native-publish-bridge.js';
const topic={country:'SA',language:'ar-SA',code:'NOV170',slug:'saudi-samsung-storage-warranty-seller-checklist-2026'};
const base={topic,checkpoint:{state:'QUALITY_PASSED',articleId:'a'.repeat(24),contentHash:'b'.repeat(64)},
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
