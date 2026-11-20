import test from 'node:test';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import marketApp from '../seo-layer.js';
import xmlApp from '../auto-platform.js';
import couponApp from '../index.js';
import {HOMEPAGE_COUPONS_BY_MARKET,APPROVED_COUPON_CODES} from '../approved-coupons.js';

const ROOT='https://noondealsnow.com';

test('ten approved NOV codes still have one primary canonical coupon article each',async()=>{
  const canonicalUrls=new Set();
  for(const [market,prefix] of [['SA','saudi-arabia'],['AE','uae']]){
    for(const code of HOMEPAGE_COUPONS_BY_MARKET[market]){
      const key=code.toLowerCase(),primary=ROOT+'/coupon/'+key,secondary=ROOT+'/'+prefix+'/coupon/'+key;
      canonicalUrls.add(primary);
      const response=await marketApp.fetch(new Request(secondary),{});
      assert.equal(response.status,200,secondary);
      const body=await response.text();
      assert.ok(body.includes('<link rel="canonical" href="'+primary+'">'),'canonical must equal primary coupon detail');
      assert.ok(!body.includes('<link rel="canonical" href="'+secondary+'">'),'no self-canonical duplicate');
      assert.ok(body.includes('href="'+primary+'">تفاصيل الكود الأساسية</a>'),'market page must provide accessible canonical link');
      assert.ok(body.includes('"url":"'+primary+'"'),'WebPage structured URL agrees with canonical');
      assert.ok(body.includes('"item":"'+primary+'"'),'Breadcrumb agrees with canonical');
      assert.ok(body.includes('نسخ الكود '+code));
      const primaryResponse=await couponApp.fetch(new Request(primary),{});
      assert.equal(primaryResponse.status,200);
      assert.ok((await primaryResponse.text()).includes('<link rel="canonical" href="'+primary+'">'));
    }
  }
  assert.equal(canonicalUrls.size,APPROVED_COUPON_CODES.length);
});

test('country coupon sitemaps list primary URLs, not self-canonical duplicate market URLs',async()=>{
  for(const [name,market,prefix] of [['saudi','SA','saudi-arabia'],['uae','AE','uae']]){
    const response=await xmlApp.fetch(new Request(ROOT+'/sitemap-coupons-'+name+'.xml'),{});
    assert.equal(response.status,200);
    const xml=await response.text();
    assert.ok(xml.startsWith('<?xml version="1.0"'));
    assert.match(xml,/<urlset/);
    for(const code of HOMEPAGE_COUPONS_BY_MARKET[market]){
      assert.ok(xml.includes(ROOT+'/coupon/'+code.toLowerCase()));
      assert.ok(!xml.includes(ROOT+'/'+prefix+'/coupon/'+code.toLowerCase()));
    }
  }
});

test('country coupon detail only claims copy success after a confirmed clipboard write',async()=>{
  for(const [market,prefix] of [['SA','saudi-arabia'],['AE','uae']]){
    for(const couponCode of HOMEPAGE_COUPONS_BY_MARKET[market]){
      const resp=await marketApp.fetch(new Request(ROOT+'/'+prefix+'/coupon/'+couponCode.toLowerCase()),{});
      assert.equal(resp.status,200);
      const html=await resp.text();
      const m=html.match(/<button class="btn" type="button" data-copy="([^"]+)"[^>]*onclick="([^"]+)"/);
      assert.ok(m,'country coupon needs a visible copy control');
      assert.equal(m[1],couponCode);
      const handler='(function(){'+m[2]+'}).call(button)';
      const copied=[];
      const okButton={dataset:{copy:couponCode},textContent:'نسخ الكود'};
      await runInNewContext(handler,{button:okButton,navigator:{clipboard:{writeText:async text=>copied.push(text)}}});
      assert.deepEqual(copied,[couponCode]);
      assert.ok(okButton.textContent.includes('تم نسخ الكود'),couponCode);
      const deniedButton={dataset:{copy:couponCode},textContent:'نسخ الكود'};
      const deniedNavigator={clipboard:{writeText:async()=>{throw Error('denied')}}};
      await runInNewContext(handler,{button:deniedButton,navigator:deniedNavigator});
      assert.ok(deniedButton.textContent.includes('تعذر النسخ'),couponCode);
      assert.ok(!deniedButton.textContent.includes('تم نسخ'),couponCode);
    }
  }
});
