import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import app,{JS} from '../index.js';
import {HOMEPAGE_COUPONS_BY_MARKET} from '../approved-coupons.js';

function boot({canCopy=true}={}){
  const handlers={};
  const events=[];
  const prompts=[];
  const button={
    dataset:{copy:'NOV170'},
    textContent:'نسخ الكود',
    getAttribute:(name)=>({'data-market':'SA','data-placement':'coupon_card'})[name]||null
  };
  const document={addEventListener:(type,handler)=>{handlers[type]=handler}};
  const navigator={clipboard:{async writeText(code){if(!canCopy)throw Error('blocked');assert.equal(code,'NOV170')}}};
  const window={gtag:(...args)=>events.push(args)};
  const source=JS.replace(/^<script>/,'').replace(/<\/script>$/,'');
  runInNewContext(source,{document,navigator,window,location:{pathname:'/coupons'},setTimeout(){},prompt:(...args)=>prompts.push(args)});
  return {events,handlers,prompts,button,click:()=>handlers.click({target:{closest:()=>button}})};
}
test('confirmed clipboard success fires one attributable copy-success event',async()=>{
  const env=boot();
  await env.click();
  const success=env.events.filter(e=>e[1]==='coupon_copy_success');
  assert.equal(success.length,1);
  assert.equal(success[0][2].coupon_code,'NOV170');
  assert.equal(success[0][2].market,'SA');
  assert.equal(success[0][2].page_path,'/coupons');
  assert.equal(success[0][2].placement,'coupon_card');
  assert.equal(env.prompts.length,0);
  assert.ok(!env.events.some(e=>e[1]==='purchase'));
});
test('blocked clipboard is not misreported as a successful copy',async()=>{
  const env=boot({canCopy:false});
  await env.click();
  assert.equal(env.events.filter(e=>e[1]==='coupon_copy_success').length,0);
  assert.equal(env.prompts.length,1);
});
test('public market cards identify correct country on the actual copy button',async()=>{
  for (const [market,path] of [['SA','/saudi'],['AE','/uae']]){
    const res=await app.fetch(new Request('https://noondealsnow.com'+path),{});
    assert.equal(res.status,200);
    const html=await res.text();
    const matches=[...html.matchAll(/<button class="copy" data-copy="(NOV\d+)" data-market="(SA|AE)" data-placement="(featured_coupon|coupon_card)">/g)];
    assert.equal(matches.length,5);
    assert.deepEqual(matches.map(m=>m[1]),HOMEPAGE_COUPONS_BY_MARKET[market]);
    assert.ok(matches.every(m=>m[2]===market));
  }
});
