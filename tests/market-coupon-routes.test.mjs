import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import {APPROVED_COUPON_CODES,HOMEPAGE_COUPONS_BY_MARKET,PRIMARY_COUPON_BY_MARKET} from '../approved-coupons.js';

const responseFor = async path => {
  const response = await app.fetch(new Request('https://noondealsnow.com'+path), {});
  assert.equal(response.status,200,path+' must remain accessible');
  return response.text();
};
const cardsFrom = html => [...html.matchAll(/<article class="coupon">[\s\S]*?<h3>[^<]*<span[^>]*>(NOV\d+)<\/span>/g)].map(m=>m[1]);

test('coupons hub shows five codes for each market, never labels a code under another market',async()=>{
  const html=await responseFor('/coupons');
  const [left,right]=html.split('<h2>🇦🇪 الإمارات</h2>');
  assert.ok(right,'UAE heading must be present');
  const saSegment=left.slice(left.lastIndexOf('<h2>🇸🇦 السعودية</h2>'));
  const sa=cardsFrom(saSegment);
  const ae=cardsFrom(right);
  assert.deepEqual(sa,HOMEPAGE_COUPONS_BY_MARKET.SA);
  assert.deepEqual(ae,HOMEPAGE_COUPONS_BY_MARKET.AE);
  assert.equal(sa[0],PRIMARY_COUPON_BY_MARKET.SA);
  assert.equal(ae[0],PRIMARY_COUPON_BY_MARKET.AE);
  assert.deepEqual(new Set([...sa,...ae]),new Set(APPROVED_COUPON_CODES));
  assert.match(html,/<link rel="canonical" href="https:\/\/noondealsnow.com\/coupons"/);
});

test('country routes use the matching approved list without deleting or reordering coupons',async()=>{
  for(const [market,path] of [['SA','/saudi'],['AE','/uae']]){
    const html=await responseFor(path);
    assert.deepEqual(cardsFrom(html),HOMEPAGE_COUPONS_BY_MARKET[market]);
    assert.ok(html.includes('نسخ الكود'));
    assert.ok(html.includes('نون'));
  }
});

test('existing homepage keeps the primary Saudi NOV170 and the navigation links',async()=>{
  const html=await responseFor('/');
  assert.ok(html.includes('ابدأ بالكود NOV170'));
  assert.ok(html.includes('href="/coupons"'));
  assert.ok(html.includes('href="/saudi"'));
  assert.ok(html.includes('href="/uae"'));
});
