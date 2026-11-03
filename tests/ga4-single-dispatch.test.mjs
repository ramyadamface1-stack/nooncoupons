import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('brand runtime is the single GA4 coupon-click and Noon-outbound event owner',()=>{
  const source=load('brand-runtime.js');
  assert.match(source,/__ndnConversionOwner='brand-runtime-v3'/);
  assert.match(source,/type==='copy_code'\?'coupon_copy'/);
  assert.match(source,/type==='shop_click'\|\|type==='open_noon'/);
  assert.match(source,/'\/api\/track-event'/);
});

test('old overlapping click reporters yield to the event owner, preserving view events',()=>{
  for(const file of ['premium-entry.js','public-entry.js','router.js','network-entry.js','visual-platform.js']){
    const source=load(file);
    assert.match(source,/window\.__ndnConversionOwner==='brand-runtime-v3'/,file+' lacks owner guard');
  }
  assert.match(load('router.js'),/fire\('coupon_view'/);
  assert.match(load('network-entry.js'),/fire\('coupon_view'/);
  assert.match(load('visual-platform.js'),/fire\('copy_code'/);
});

test('optional GA4 settings do not configure the same already-loaded measurement tag twice',()=>{
  const source=load('brand-runtime.js');
  assert.match(source,/var gaLoaded=Array\.from\(document\.querySelectorAll\('script\[src\]'\)\)/);
  assert.match(source,/if\(!gaLoaded\)\{window\.dataLayer/);
});

test('coupon-country XML edge cache uses a new revision after whitelist corrections',()=>{
  const source=load('r2-public-cache-policy.js');
  assert.match(source,/market-coupon-canonical-v2/);
  assert.match(source,/sitemap-coupons-/);
});
