import test from 'node:test';
import assert from 'node:assert/strict';
import {llms} from '../final-platform.js';
import {APPROVED_COUPON_CODES,HOMEPAGE_COUPONS_BY_MARKET,PRIMARY_COUPON_BY_MARKET} from '../approved-coupons.js';
const origin='https://noondealsnow.com';
test('AI source guide gives all ten approved NOV codes with correct markets and primary canonical URLs',()=>{
  const body=llms(origin);
  assert.equal(PRIMARY_COUPON_BY_MARKET.SA,'NOV170');
  assert.equal(PRIMARY_COUPON_BY_MARKET.AE,'NOV188');
  assert.ok(body.includes('## Country-specific canonical coupon references'));
  for(const [market,label] of [['SA','Saudi Arabia code'],['AE','UAE code']]){
    for(const code of HOMEPAGE_COUPONS_BY_MARKET[market]){
      const line='- '+label+' '+code+': '+origin+'/coupon/'+code.toLowerCase();
      assert.ok(body.includes(line),line);
      assert.ok(!body.includes('- '+(market==='SA'?'UAE code':'Saudi Arabia code')+' '+code+':'),code+' incorrectly cross-listed');
    }
  }
  assert.equal(HOMEPAGE_COUPONS_BY_MARKET.SA.length+HOMEPAGE_COUPONS_BY_MARKET.AE.length,APPROVED_COUPON_CODES.length);
  assert.ok(body.includes('not official Noon endorsements, ChatGPT recommendations'));
  assert.ok(!body.includes('ChatGPT recommends NOV170'));
  assert.ok(!body.includes('NOV170 25%'));
});