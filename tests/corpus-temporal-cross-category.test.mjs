import test from 'node:test';
import assert from 'node:assert/strict';
import {staleCurrentClaims,refreshLiveTemporalArticleHtml} from '../article-temporal-freshness.js';
const examples=['fashion','perfumes','beauty','kitchen','home','appliances','laptops','electronics','gaming','toys','baby','groceries','sports'];
test('detect stale marketing across all commerce sectors',()=>{
  for(const category of examples){
    assert.equal(staleCurrentClaims(`<p>${category} offers 2024 are available now</p>`,2026,11).length,1,category);
  }
});
test('detect stale H1/H2/table/list and same-year outdated campaigns',()=>{
  assert.equal(staleCurrentClaims('<h2>دليل شراء اللابتوب في 2024</h2>',2026,11).length,1);
  assert.equal(staleCurrentClaims('<h1>أفضل عروض العطور في ٢٠٢٥</h1>',2026,11).length,1);
  assert.equal(staleCurrentClaims('<li>عروض موسم 2024 متاحة الآن</li>',2026,11).length,1);
  assert.equal(staleCurrentClaims('<td>Offers April 2026 available now</td>',2026,11).length,1);
});
test('preserve publication dates, real launch years and historic archives',()=>{
  const html='<article data-published="2024-05-12"><time datetime="2024-05-12">2024</time><h2>أرشيف عروض رمضان 2024</h2><p>In 2024 this product was launched; historical release.</p></article>';
  assert.equal(staleCurrentClaims(html,2026,11).length,0);
  assert.match(refreshLiveTemporalArticleHtml(html,{date:new Date('2026-11-10T12:00:00Z')}).html,/data-published="2024-05-12"/);
  assert.equal(staleCurrentClaims('<h2>عروض أبريل 2026 اليوم</h2>',2026,4).length,0);
});
