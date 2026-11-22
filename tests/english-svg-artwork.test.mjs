import test from 'node:test';
import assert from 'node:assert/strict';
import {couponSvg,featuredSvg,englishArtworkTitle,SVG_LAYOUT_INFO} from '../svg-engine.js';
import app from '../visual-platform.js';

const hasArabic=value=>/[\u0600-\u06ff]/u.test(value);

test('new coupon-first artwork has Saudi Arabic title, UAE English title and consistent safe canvas',()=>{
  for(const title of [
    'كود خصم نون السعودية على جوالات سامسونج نوفمبر 2026',
    'عروض نون الإمارات على العطور وكود الخصم',
    'iPhone 18 Pro Max Noon Abu Dhabi buying guide'
  ]){
    const coupon=couponSvg({coupon:'NOV188',country:'AE',variant:2,title});
    const featured=featuredSvg({coupon:'NOV188',country:'AE',title});
    for(const svg of [coupon,featured]){
      assert.ok(!hasArabic(svg),'UAE English language artwork must remain ASCII');
      assert.match(svg,/width="1600" height="1000"/);
      assert.match(svg,/NOV188/);
      assert.match(svg,/UAE/);
      assert.match(svg,/Noon|NOON|noon/);
    }
  }
  assert.equal(englishArtworkTitle('خصم جوالات سامسونج'), 'Samsung shopping guide');
  const sa=couponSvg({coupon:'NOV170',country:'SA',title:'كوبون خصم نون السعودية',variant:1});
  assert.match(sa,/كوبون خصم نون/);
  assert.match(sa,/NOV170/);
  assert.match(sa,/Saudi Arabia/);
  assert.match(sa,/data-noon-cover="coupon-first-v12"/);
  assert.match(featuredSvg({coupon:'NOV170',country:'SA'}),/كوبون خصم نون/);
  assert.equal(SVG_LAYOUT_INFO.version,12);
});

test('all five public SVG assets use the new immutable cache version without R2 lookup',async()=>{
  const env={CONTENT_FINAL:{head(){throw Error('R2 HEAD forbidden for deterministic artwork')},get(){throw Error('R2 GET forbidden')}}};
  for(const variant of [1,2,3,4,5]){
    const req=new Request(`https://noondealsnow.com/assets/coupon-svg/en-iphone-duo/${variant}.svg?v=12&country=AE&coupon=NOV188&kw=iPhone%20Duo%20Noon%20UAE`);
    const res=await app.fetch(req,env,{});
    assert.equal(res.status,200);
    assert.equal(res.headers.get('x-svg-layout'),'responsive-v12');
    assert.match(res.headers.get('cache-control'),/immutable/);
    const svg=await res.text();
    assert.match(svg,/width="1600" height="1000"/);
    assert.match(svg,/NOV188/);
    assert.ok(!hasArabic(svg));
    assert.match(svg,/NOON DISCOUNT COUPON/);
    assert.match(svg,/data-noon-cover="coupon-first-v12"/);
  }
});
