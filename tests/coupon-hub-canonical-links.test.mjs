import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import {HOMEPAGE_COUPONS_BY_MARKET,APPROVED_COUPON_CODES} from '../approved-coupons.js';

const origin='https://noondealsnow.com';
async function page(path){
  const response=await app.fetch(new Request(origin+path),{});
  assert.equal(response.status,200,path+' still resolves');
  return response.text();
}
function couponDetailHrefs(html){
  return [...html.matchAll(/<a\s+href="\/coupon\/(nov\d+)"[^>]*>تفاصيل وشروط كود\s+(NOV\d+)/g)].map(x=>({slug:x[1].toUpperCase(),label:x[2]}));
}
test('Saudi hub exposes five real detail links and retains copy controls',async()=>{
  const html=await page('/saudi');
  const links=couponDetailHrefs(html);
  assert.equal(links.length,5);
  assert.deepEqual(links.map(x=>x.slug),HOMEPAGE_COUPONS_BY_MARKET.SA);
  assert.ok(links.every(x=>x.slug===x.label));
  for(const code of HOMEPAGE_COUPONS_BY_MARKET.SA){
    assert.ok(html.includes('data-copy="'+code+'"'));
  }
});
test('UAE hub exposes its five own detail links, no Saudi codes',async()=>{
  const html=await page('/uae');
  const links=couponDetailHrefs(html);
  assert.equal(links.length,5);
  assert.deepEqual(links.map(x=>x.slug),HOMEPAGE_COUPONS_BY_MARKET.AE);
  assert.ok(links.every(x=>x.slug===x.label));
});
test('all-coupon page links exactly to all ten approved code details',async()=>{
  const html=await page('/coupons');
  const links=couponDetailHrefs(html);
  assert.equal(links.length,10);
  assert.deepEqual(new Set(links.map(x=>x.slug)),new Set(APPROVED_COUPON_CODES));
  assert.ok(html.includes('data-copy="NOV170"'));
});
test('each detail target remains public with one canonical owner URL',async()=>{
  for(const code of APPROVED_COUPON_CODES){
    const url='/coupon/'+code.toLowerCase();
    const html=await page(url);
    assert.ok(html.includes('<link rel="canonical" href="'+origin+url+'">'),url);
  }
});
