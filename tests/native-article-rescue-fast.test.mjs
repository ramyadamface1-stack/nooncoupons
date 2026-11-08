import test from 'node:test';
import assert from 'node:assert/strict';
import {renderApprovedNativeAiV2Fast} from '../r2-emergency-readonly.js';
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
