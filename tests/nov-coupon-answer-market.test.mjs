import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import {HOMEPAGE_COUPONS_BY_MARKET} from '../approved-coupons.js';
for(const [market,region] of [['SA','السعودية'],['AE','الإمارات']]){
  for(const code of HOMEPAGE_COUPONS_BY_MARKET[market]){
    test(code+' coupon detail is exclusively for '+market,async()=>{
      const response=await app.fetch(new Request('https://noondealsnow.com/coupon/'+code.toLowerCase()),{});
      assert.equal(response.status,200);
      const body=await response.text();
      assert.ok(body.includes('كود نون '+code+' | نون '+region));
      assert.match(body,new RegExp('<article class="coupon"'));
      assert.equal((body.match(/<article class="coupon">/g)||[]).length,1);
      assert.ok(body.includes('ضمن أكواد نون '+region));
      assert.ok(body.includes('rel="canonical"')&&body.includes('/coupon/'+code.toLowerCase()));
      assert.ok(!body.includes('نسخ الكود '+(market==='SA'?'NOV188':'NOV170')));
    });
  }
}
