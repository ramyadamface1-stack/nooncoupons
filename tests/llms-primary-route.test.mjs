import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../discovery-entry.js';
import {HOMEPAGE_COUPONS_BY_MARKET} from '../approved-coupons.js';

test('the primary llms.txt route itself publishes all approved country-specific canonical coupons',async()=>{
  const res=await app.fetch(new Request('https://noondealsnow.com/llms.txt'),{});
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-type')||'',/text\/plain/);
  assert.equal(res.headers.get('x-llms-source'),'canonical-approved-market-codes-v1');
  const text=await res.text();
  assert.ok(text.includes('## Country-specific canonical coupon references'));
  for(const [market,label] of [['SA','Saudi Arabia code'],['AE','UAE code']]){
    for(const code of HOMEPAGE_COUPONS_BY_MARKET[market]){
      const line='- '+label+' '+code+': https://noondealsnow.com/coupon/'+code.toLowerCase();
      assert.ok(text.includes(line),line);
    }
  }
  assert.ok(text.includes('not official Noon endorsements, ChatGPT recommendations'));
});
