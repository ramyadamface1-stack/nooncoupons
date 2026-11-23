import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const BASE='.ndn-static-assets';
const origin='https://noondealsnow.com';
const load=path=>readFileSync(BASE+path+'.html','utf8');
const cases=[
 {market:'saudi',locale:'ar-SA',code:'NOV170',other:'NOV188',
  canonical:'/saudi-arabia/noon-coupon-code',
  question:'ما كود خصم نون السعودية الموجود هنا؟',
  existing:'هل يمكن للعميل الحالي استخدام NOV170؟',
  refund:'هل الكاش باك يساوي الخصم الفوري في نون؟',
  firstOrder:'هل NOV170 مخصص لأول طلب فقط؟',
  official:'https://www.noon.com/saudi-ar/'},
 {market:'uae',locale:'en-AE',code:'NOV188',other:'NOV170',
  canonical:'/uae/noon-coupon-code',
  question:'What is the Noon UAE promo code shown here?',
  existing:'Can existing Noon UAE customers try NOV188?',
  refund:'Is Noon UAE cashback the same as instant savings?',
  firstOrder:'Does NOV188 automatically apply to first orders?',
  official:'https://www.noon.com/uae-en/'}
];
const graph=html=>{
 const match=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(match,'missing JSON-LD');
 const obj=JSON.parse(match[1]);
 assert.equal(obj['@context'],'https://schema.org');
 return obj['@graph'];
};
test('both coupon hubs have unique answer-first content with exact canonical market coupon and no unsupported guarantee',()=>{
 for(const t of cases){
  const p='/'+t.market+'/noon-coupon-code',html=load(p);
  assert.ok(html.includes('<html lang="'+t.locale+'" dir="'+(t.market==='uae'?'ltr':'rtl')+'">'),p);
  assert.ok(html.includes('<link rel="canonical" href="'+origin+t.canonical+'">'),p);
  assert.ok(html.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),p);
  assert.ok(html.includes('data-ndn-aeo="market-answer-first-v1"'),p);
  assert.ok(html.includes('data-code="'+t.code+'"'),p);
  assert.ok(html.includes('data-shop-click="'+t.code+'"'),p);
  assert.ok(!html.includes('data-code="'+t.other+'"'),p);
  assert.ok(html.includes(t.question),p);
  assert.ok(html.includes(t.existing),p);
  assert.ok(html.includes(t.refund),p);
  assert.ok(html.includes(t.firstOrder),p);
  assert.equal(html.split('<h3>'+t.existing+'</h3>').length-1,1,
   'Q&A should not duplicate in visible HTML '+p);
  for(const path of [
   '/'+t.market+'/buying-guide/existing-customers',
   '/'+t.market+'/buying-guide/first-order',
   '/guide/coupon-not-working','/guide/noon-refund-credit',
   '/coupon-verification','/editorial-policy']){
   assert.ok(html.includes('href="'+path+'"'),p+' missing '+path);
  }
  assert.ok(html.includes('href="'+t.official+'"'),p);
  assert.match(html,/<h2>[\s\S]*?<h3>/,p);
  assert.ok(html.length>10500,p+' too thin for semantic answer page');
  assert.ok(!/guaranteed for everyone|خصم مضمون للجميع|90% off|50% off|نسبة خصم مؤكدة/i.test(html),p);
  const schema=graph(html);
  const main=schema.find(x=>x['@type']==='WebPage');
  assert.ok(main&&main.url===origin+t.canonical);
  assert.equal(main.inLanguage,t.locale);
  const faq=schema.find(x=>x['@type']==='FAQPage');
  assert.ok(faq,'visible FAQ should have structured data');
  assert.equal(faq.mainEntity.length,5);
  for(const row of faq.mainEntity){
   assert.equal(row['@type'],'Question');
   assert.ok(html.includes('<h3>'+row.name+'</h3>'));
   assert.ok(html.includes('<p>'+row.acceptedAnswer.text+'</p>'));
  }
 }
});
test('Saudi legacy canonical page replicates stronger content instead of accidentally losing it',()=>{
 const primary=load('/saudi/noon-coupon-code'),canonical=load('/saudi-arabia/noon-coupon-code');
 for(const snippet of [
  'data-ndn-aeo="market-answer-first-v1"',
  'هل يمكن للعميل الحالي استخدام NOV170؟',
  'href="/saudi/buying-guide/existing-customers"',
  'href="/saudi/buying-guide/first-order"'
 ]){
  assert.ok(primary.includes(snippet));
  assert.ok(canonical.includes(snippet));
 }
 assert.ok(canonical.includes('<link rel="canonical" href="'+origin+'/saudi-arabia/noon-coupon-code">'));
 assert.ok(!canonical.includes('<link rel="canonical" href="'+origin+'/saudi/noon-coupon-code">'));
});
test('homepage offers buyer-intent questions without replacing the commercial coupon actions',()=>{
 const html=readFileSync(BASE+'/index.html','utf8');
 for(const market of ['saudi','uae']){
  assert.ok(html.includes('href="/'+market+'/buying-guide/existing-customers"'));
  assert.ok(html.includes('href="/'+market+'/buying-guide/first-order"'));
 }
 assert.ok(html.includes('href="/guide/coupon-not-working"'));
 assert.ok(html.includes('id="commercial-buying-intent"'));
 assert.ok(html.includes('NOV170')&&html.includes('NOV188'));
 assert.ok(html.includes('id="ndn-static-ga4"'));
});
