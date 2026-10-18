import test from 'node:test';
import assert from 'node:assert/strict';
import visualWorker from '../visual-platform.js';
import {readFileSync} from 'node:fs';

test('every public SVG variant renders without R2 HEAD/GET or Durable Object calls',async()=>{
  let readCount=0;
  const env={CONTENT_FINAL:{
    async head(){readCount++;throw Error('r2_head_not_allowed')},
    async get(){readCount++;throw Error('r2_get_not_allowed')}
  }};
  for(let v=1;v<=5;v++){
    const url='https://noondealsnow.com/assets/coupon-svg/en-samsung-tv-noon-uae-shopping-guide-dubai-deals/'+v+'.svg?v=10&coupon=NOV188&country=AE&kw=Samsung%20TV%20shopping%20guide%20UAE';
    const res=await visualWorker.fetch(new Request(url),env,{});
    const body=await res.text();
    assert.equal(res.status,200);
    assert.match(res.headers.get('content-type'),/image\/svg\+xml/);
    assert.equal(res.headers.get('x-image-source'),'deterministic-no-r2-head-v10');
    assert.match(body,/<svg\b/);
    assert.match(body,/NOV188/);
    assert.match(body,/Samsung/);
    assert.equal(readCount,0,'a public image must not touch R2');
  }
});
test('featured image redirect is deterministic and does not read R2',async()=>{
  const env={CONTENT_FINAL:{head(){throw Error('forbidden')},get(){throw Error('forbidden')}}};
  const res=await visualWorker.fetch(new Request('https://noondealsnow.com/assets/featured/my-samsung-guide.svg?coupon=NOV188&country=AE'),env,{});
  assert.equal(res.status,308);
  const target=new URL(res.headers.get('location'));
  assert.match(target.pathname,/^\/assets\/coupon-svg\/my-samsung-guide\/1\.svg$/);
  assert.equal(target.searchParams.get('country'),'AE');
  assert.equal(target.searchParams.get('coupon'),'NOV188');
});

test('public article enhancement does not include billable R2 metadata HEAD',()=>{
  const premium=readFileSync(new URL('../premium-entry.js',import.meta.url),'utf8');
  const visual=readFileSync(new URL('../visual-platform.js',import.meta.url),'utf8');
  assert.doesNotMatch(premium,/CONTENT_FINAL\.head\s*\(/);
  assert.doesNotMatch(visual,/CONTENT_FINAL\.head\s*\(/);
  assert.match(premium,/pickDate\('datePublished'\)/);
  assert.match(premium,/x-r2-head-avoided/);
});
