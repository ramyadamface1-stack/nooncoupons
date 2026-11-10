import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshLiveTemporalArticleHtml,staleCurrentClaims} from '../article-temporal-freshness.js';
const date = new Date('2026-11-10T13:00:00Z');
test('all categories have historical offer correction inside body, without touching timestamps',()=>{
  for(const category of ['fashion','beauty','home','appliances','toys','grocery','electronics']){
    const html='<article data-published="2024-05-12"><p>'+category+' offers 2024 are available now.</p><p>Use approved coupon NOV170.</p></article>';
    const result=refreshLiveTemporalArticleHtml(html,{date,english:true});
    assert.equal(result.corrected,1);
    assert.match(result.html,/November 2026/);
    assert.doesNotMatch(result.html,/offers 2024 are available now/);
    assert.match(result.html,/data-published="2024-05-12"/);
    assert.match(result.html,/NOV170/);
  }
});
test('historical product release and original links cannot be rewritten',()=>{
  const html='<article><p>In 2024 the appliance was launched.</p><p>مراجعة iPhone 15 من جيل أقدم.</p><p>2024 offers available now <a href="/coupon/nov188">NOV188</a></p></article>';
  assert.equal(refreshLiveTemporalArticleHtml(html,{date}).html,html);
});
test('older phone falsely called newest is corrected for current buyers',()=>{
  assert.equal(refreshLiveTemporalArticleHtml('<p>أحدث إصدار iPhone 15 متاح الآن</p>',{date}).corrected,1);
});
test('correct calendar rollover without falsifying actual article publication date',()=>{
  const s='<p>Offers 2026 are available now</p>';
  assert.equal(staleCurrentClaims(s,2027).length,1);
  assert.match(refreshLiveTemporalArticleHtml(s,{date:new Date('2027-01-06T12:00:00Z'),english:true}).html,/January 2027/);
});
