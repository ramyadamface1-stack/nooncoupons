import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';

const MARKET_CASES=[
  {
    code:'NOV170',market:'SA',other:'NOV188',currency:'SAR',
    official:'https://www.noon.com/saudi-ar/',place:'السعودية',
    heading:'هل NOV170 كود خصم نون السعودية?',
    question:'NOV170 Noon Saudi coupon: quick answer',
    guide:'/saudi-arabia/noon-coupon-code'
  },
  {
    code:'NOV188',market:'AE',other:'NOV170',currency:'AED',
    official:'https://www.noon.com/uae-ar/',place:'الإمارات',
    heading:'هل NOV188 كود خصم نون الإمارات?',
    question:'NOV188 Noon UAE promo code: quick answer',
    guide:'/uae/noon-coupon-code'
  }
];

for(const {code,market,other,currency,official,place,heading,question,guide} of MARKET_CASES){
  test(code+' primary detail contains distinct market-specific, AI-readable honest buying answer',async()=>{
    const path='/coupon/'+code.toLowerCase();
    const res=await app.fetch(new Request('https://noondealsnow.com'+path),{});
    assert.equal(res.status,200);
    assert.match(res.headers.get('content-type')||'',/text\/html/);
    const html=await res.text();
    assert.ok(html.includes('<h1>كود نون '+code+' في '+place+'</h1>'));
    assert.ok(html.includes(heading));
    assert.ok(html.includes(question));
    assert.ok(html.includes('href="'+official+'"'));
    assert.ok(html.includes('href="'+guide+'"'));
    assert.ok(html.includes('href="/coupon-verification"'));
    assert.ok(html.includes('lang="en"'));
    assert.ok(html.includes(currency));
    assert.ok(html.includes('data-copy="'+code+'"'));
    assert.ok(html.includes('data-shop-click="'+code+'"'));
    assert.ok(html.includes('rel="canonical" href="https://noondealsnow.com'+path+'"'));
    assert.ok(html.includes('آخر تحديث للصفحة:'));
    assert.ok(html.includes('هذا التاريخ ليس فحصًا جديدًا لقبول الكود'));
    assert.ok(!html.includes('آخر مراجعة:'));
    assert.ok(!html.includes('ChatGPT recommends'));
    assert.ok(!html.includes('مضمون للجميع'));
    const answer=html.match(/<section class="content" aria-label="الإجابة المباشرة[^"]*">([\s\S]*?)<\/section>/)?.[1]||'';
    assert.ok(answer.length>600,'primary answers must be substantially useful, not a one-line keyword stuffing paragraph');
    assert.ok(answer.includes(code));
    assert.ok(!answer.includes(other),'do not cross-promote another market code in the primary answer');
  });
}
test('non-primary codes keep their existing canonical unique pages without a fabricated recommendation',async()=>{
 for(const code of ['NOV174','NOV157']){
   const r=await app.fetch(new Request('https://noondealsnow.com/coupon/'+code.toLowerCase()),{});
   assert.equal(r.status,200);
   const html=await r.text();
   assert.doesNotMatch(html,/aria-label="الإجابة المباشرة لكود نون/);
   assert.ok(html.includes('data-shop-click="'+code+'"'));
 }
});
