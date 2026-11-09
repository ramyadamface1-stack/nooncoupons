import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import {HOMEPAGE_COUPONS_BY_MARKET,APPROVED_COUPON_CODES,PRIMARY_COUPON_BY_MARKET} from '../approved-coupons.js';
import {commerceLanding} from '../commerce-pages-v2.js';
import {publicEdgePolicyRevision} from '../r2-public-cache-policy.js';

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

test('production commerce country hubs lead with the owner-primary NOV and link its unique canonical detail',async()=>{
  for(const [market,code] of [['saudi',PRIMARY_COUPON_BY_MARKET.SA],['uae',PRIMARY_COUPON_BY_MARKET.AE]]){
    const detail='/coupon/'+code.toLowerCase();
    const arabic=await commerceLanding('/'+market,origin,{});
    assert.equal(arabic.status,200);
    const html=await arabic.text();
    assert.ok(html.includes('<span class="code">'+code+'</span>'),'country hero displays approved primary '+code);
    assert.ok(html.includes('href="'+detail+'">تفاصيل كود '+code+' الأساسية</a>'),'country link points at the primary canonical detail');
    assert.ok(html.includes('href="'+detail+'">شروط كود '+code+'</a>'),'coupon CTA links to canonical details');
    const english=await commerceLanding('/en/'+market,origin,{});
    assert.equal(english.status,200);
    const enHtml=await english.text();
    assert.ok(enHtml.includes('<span class="code">'+code+'</span>'),'English hub leads with approved primary '+code);
    assert.ok(enHtml.includes('href="'+detail+'">Primary coupon '+code+' details</a>'),'English hub links canonical code');
  }
});

test('landing-page canonical links receive a fresh cache key without purging article or blog caches',()=>{
  assert.equal(publicEdgePolicyRevision('/coupons'),'nov-coupon-detail-links-v1');
  for(const path of ['/saudi','/uae','/en/saudi','/en/uae'])
    assert.equal(publicEdgePolicyRevision(path),'primary-market-nov-canonical-v1');
  assert.notEqual(publicEdgePolicyRevision('/blog'),'nov-coupon-detail-links-v1');
  assert.notEqual(publicEdgePolicyRevision('/articles/nov170-tips'),'nov-coupon-detail-links-v1');
  assert.notEqual(publicEdgePolicyRevision('/sitemap-core.xml'),'nov-coupon-detail-links-v1');
});
