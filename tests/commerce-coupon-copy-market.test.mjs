import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {commerceLanding,ARABIC_MARKET_COUPON_COPY_SCRIPT,ENGLISH_MARKET_COUPON_COPY_SCRIPT} from '../commerce-pages-v2.js';
import {HOMEPAGE_COUPONS_BY_MARKET} from '../approved-coupons.js';

const origin='https://noondealsnow.com';

test('Arabic category and brand pages show both a real copy button and official store action',async()=>{
  for(const [path,market] of [['/saudi/category/mobiles','SA'],['/uae/brand/apple','AE']]){
    const response=await commerceLanding(path,origin,{});
    assert.equal(response.status,200);
    const html=await response.text();
    const code=html.match(/data-market-coupon-copy="(NOV\d{3})"/)?.[1];
    assert.ok(code,`missing Arabic copy button on ${path}`);
    assert.ok(HOMEPAGE_COUPONS_BY_MARKET[market].includes(code));
    assert.match(html,new RegExp('data-market="'+market+'"'));
    assert.ok(html.includes('id="arabic-market-coupon-copy-v1"'));
    assert.match(html,/<a class="cta official-store" href="https:\/\/www\.noon\.com\//);
    assert.equal((html.match(/id="arabic-market-coupon-copy-v1"/g)||[]).length,1);
  }
});

test('Arabic coupon clipboard emits success only after actual write, and rejects cross-market code',async()=>{
  const source=ARABIC_MARKET_COUPON_COPY_SCRIPT.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'');
  for(const scenario of [
    {code:'NOV170',market:'SA',copySucceeds:true,expectedCopies:1,expectedEvents:1},
    {code:'NOV188',market:'AE',copySucceeds:true,expectedCopies:1,expectedEvents:1},
    {code:'NOV188',market:'SA',copySucceeds:true,expectedCopies:0,expectedEvents:0},
    {code:'NOV170',market:'SA',copySucceeds:false,expectedCopies:1,expectedEvents:0}
  ]){
    const clicks=[],events=[];
    let callback;
    const b={textContent:'نسخ الكود',isConnected:true,getAttribute:name=>name==='data-market-coupon-copy'?scenario.code:name==='data-market'?scenario.market:''};
    const browser={
      window:{gtag:(...args)=>events.push(args)},
      document:{addEventListener:(event,fn)=>{assert.equal(event,'click');callback=fn}},
      navigator:{clipboard:{writeText:async code=>{clicks.push(code);if(!scenario.copySucceeds)throw Error('denied')}}},
      location:{pathname:'/saudi/category/mobiles'},
      setTimeout:()=>{}
    };
    runInNewContext(source,browser);
    await callback({target:{closest:()=>b}});
    assert.equal(clicks.length,scenario.expectedCopies);
    assert.equal(events.length,scenario.expectedEvents);
    if(events.length)assert.equal(events[0][1],'coupon_copy_success');
    if(!scenario.copySucceeds&&clicks.length)assert.match(b.textContent,/تعذّر النسخ/);
  }
});

test('Arabic country homepages use verified copy feedback and their own market coupon count',async()=>{
  for(const [path,market] of [['/saudi','SA'],['/uae','AE']]){
    const response=await commerceLanding(path,origin,{});
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,/data-placement="arabic_country_hero"/);
    assert.match(html,/data-market-coupon-copy="NOV\d{3}"/);
    assert.doesNotMatch(html,/onclick="navigator\.clipboard/);
    assert.match(html,new RegExp(HOMEPAGE_COUPONS_BY_MARKET[market].length+' أكواد معتمدة للسوق'));
    assert.equal((html.match(/id="arabic-market-coupon-copy-v1"/g)||[]).length,1);
  }
  const source=ARABIC_MARKET_COUPON_COPY_SCRIPT.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'');
  let click;const events=[];
  const button={textContent:'نسخ الكود',isConnected:true,getAttribute:name=>({
    'data-market-coupon-copy':'NOV170','data-market':'SA','data-placement':'arabic_country_hero'
  }[name]||'')};
  runInNewContext(source,{
    window:{gtag:(...args)=>events.push(args)},
    document:{addEventListener:(_event,fn)=>{click=fn}},
    navigator:{clipboard:{writeText:async()=>{throw Error('user denied')}}},
    location:{pathname:'/saudi'},setTimeout:()=>{}
  });
  await click({target:{closest:()=>button}});
  assert.match(button.textContent,/تعذّر النسخ/);
  assert.equal(events.length,0,'a denied clipboard write must not appear as a conversion');
});

test('English all-coupons directory visibly separates both markets and supports copying every code',async()=>{
  const response=await commerceLanding('/en/coupons',origin,{});
  const html=await response.text();
  assert.equal(response.status,200);
  assert.ok(html.includes('id="english-market-coupon-copy-v1"'));
  for(const [market,codes] of Object.entries(HOMEPAGE_COUPONS_BY_MARKET)){
    const portion=html.match(new RegExp('<section class="section" data-coupon-market="'+market+'">([\\s\\S]*?)<\\/section>'))?.[1];
    assert.ok(portion,`missing ${market} section`);
    for(const code of codes){
      assert.ok(portion.includes('data-english-copy="'+code+'"'));
      assert.ok(portion.includes('data-market="'+market+'"'));
    }
    const other=market==='SA'?'AE':'SA';
    for(const wrongCode of HOMEPAGE_COUPONS_BY_MARKET[other])assert.ok(!portion.includes('data-english-copy="'+wrongCode+'"'));
  }
  assert.equal((html.match(/data-english-copy="NOV\d{3}"/g)||[]).length,10);
  const header=html.match(/<header class="site-head"[\s\S]*?<\/header>/)?.[0];
  assert.ok(header);
  assert.doesNotMatch(header,/class="current"/,'mixed-market directory must not preselect a country');
  assert.doesNotMatch(header,/\/en\/(?:null|undefined)\//);
  assert.match(header,/<a class="site-cta" href="\/en\/coupons#market-codes">Choose market<\/a>/);
  assert.match(html,/<div id="market-codes">/);
});

test('English copy reports its real CTA placement after confirmed clipboard success',async()=>{
  const source=ENGLISH_MARKET_COUPON_COPY_SCRIPT.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'');
  let callback;const events=[];const writes=[];
  const btn={textContent:'Copy NOV188',isConnected:true,getAttribute:name=>({
    'data-english-copy':'NOV188','data-market':'AE','data-placement':'english_all_coupons'
  }[name]||'')};
  runInNewContext(source,{
    window:{gtag:(...a)=>events.push(a)},
    document:{addEventListener:(event,fn)=>{assert.equal(event,'click');callback=fn}},
    navigator:{clipboard:{writeText:async code=>writes.push(code)}},
    location:{pathname:'/en/coupons'},setTimeout:()=>{}
  });
  await callback({target:{closest:()=>btn}});
  assert.deepEqual(writes,['NOV188']);
  assert.equal(events.length,1);
  assert.equal(events[0][2].placement,'english_all_coupons');
  assert.equal(events[0][2].source,'confirmed_clipboard_write');
});

test('both language layouts expose accessible navigation at mobile widths',async()=>{
  for(const path of ['/saudi/category/mobiles','/en/uae/category/mobiles']){
    const response=await commerceLanding(path,origin,{});
    const html=await response.text();
    assert.equal((html.match(/class="mobile-nav"/g)||[]).length,1);
    assert.match(html,/<details class="mobile-nav"><summary aria-label=/);
    assert.match(html,/aria-label="(?:قائمة الموبايل|Mobile navigation)"/);
    assert.ok(html.includes('@media(max-width:900px)'));
    assert.ok(html.includes('.mobile-nav{display:block}'));
    assert.match(html,/\.site-nav \.mobile-nav nav\{[^}]*z-index:90/);
    assert.match(html,/href="\/coupon-verification"/);
  }
});
