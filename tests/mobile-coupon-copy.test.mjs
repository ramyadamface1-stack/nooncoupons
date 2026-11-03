import test from 'node:test';
import assert from 'node:assert/strict';
import seo from '../seo-layer.js';
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
