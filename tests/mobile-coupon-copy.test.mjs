import test from 'node:test';
import assert from 'node:assert/strict';
import seo from '../seo-layer.js';
import {mobileCouponBar} from '../public-entry.js';
for(const [market,path,code] of [['SA','/saudi-arabia/noon-coupon-code','NOV170'],['AE','/uae/noon-coupon-code','NOV188']]){
 test(market+' canonical coupon hub offers copy, proof feedback, details and official Noon',async()=>{
  const r=await seo.fetch(new Request('https://noondealsnow.com'+path),{},{});
  assert.equal(r.status,200);
  const html=await r.text();
  assert.ok(html.includes('data-copy-code="'+code+'"'));
  assert.ok(html.includes('id="market-coupon-copy-runtime-v1"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('تفاصيل وتجربة '+code));
  assert.ok(html.includes('https://www.noon.com/'));
  assert.ok(html.includes('min-height:46px'));
 });
}
test('narrow mobile coupon banner keeps the official Noon store action visible in both markets',()=>{
 for(const [market,code,url] of [
   ['SA','NOV170','https://www.noon.com/saudi-ar/'],
   ['AE','NOV188','https://www.noon.com/uae-ar/']
 ]){
   const html=mobileCouponBar('<html><body><p>Guide</p></body></html>',url,code,market);
   assert.match(html,new RegExp('data-sticky-copy="'+code+'"'));
   assert.ok(html.includes('href="'+url+'"'));
   assert.match(html,/<style id="mobile-coupon-bar-narrow-fix">[\s\S]*#mobile-coupon-bar a\{display:inline-block/);
   assert.ok(html.indexOf('mobile-coupon-bar-narrow-fix')>html.indexOf('mobile-coupon-bar-style'),
     'narrow rule must override the earlier hide rule');
 }
});
