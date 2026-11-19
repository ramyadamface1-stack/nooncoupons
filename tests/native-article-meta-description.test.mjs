import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeArticleMetaDescription} from '../automation/ai-v2/meta-description.mjs';

test('Saudi and UAE native meta snippets end at complete sentences and include market and coupon',()=>{
 for(const row of [
  {country:'SA',code:'NOV170',market:'نون السعودية'},
  {country:'AE',code:'NOV188',market:'Noon UAE'}
 ]){
  for(const label of ['سوني','An extremely long model branding with many extra words used to stress descriptions']){
   const text=nativeArticleMetaDescription({...row,brand:label,category:label});
   assert.ok(text.length>=60&&text.length<=160,JSON.stringify({row,text}));
   assert.ok(text.endsWith('.'),text);
   assert.ok(text.includes(row.code),text);
   assert.ok(text.includes(row.market),text);
   assert.doesNotMatch(text,/[,،:]\s*(?:and|or|with|مع|ثم)$/i);
  }
 }
 assert.throws(()=>nativeArticleMetaDescription({country:'XX'}),/UNSUPPORTED_META_MARKET/);
});
