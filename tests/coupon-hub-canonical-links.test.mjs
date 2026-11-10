import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import {HOMEPAGE_COUPONS_BY_MARKET,APPROVED_COUPON_CODES,PRIMARY_COUPON_BY_MARKET} from '../approved-coupons.js';
import {commerceLanding} from '../commerce-pages-v2.js';
import {publicEdgePolicyRevision} from '../r2-public-cache-policy.js';

const origin='https://noondealsnow.com';
async function page(path){
  const response=await app.fetch(new Request(origin+path),{});
  assert.equal(response.status,200,path+' still resolves');
  return response.text();
}
function couponDetailHrefs(html){
  return [...html.matchAll(/<a\s+href="\/coupon\/(nov\d+)"[^>]*>تفاصيل وشروط كود\s+(NOV\d+)/g)].map(x=>({slug:x[1].toUpperCase(),label:x[2]}));
}
test('Saudi hub exposes five real detail links and retains copy controls',async()=>{
  const html=await page('/saudi');
  const links=couponDetailHrefs(html);
  assert.equal(links.length,5);
  assert.deepEqual(links.map(x=>x.slug),HOMEPAGE_COUPONS_BY_MARKET.SA);
  assert.ok(links.every(x=>x.slug===x.label));
  for(const code of HOMEPAGE_COUPONS_BY_MARKET.SA){
    assert.ok(html.includes('data-copy="'+code+'"'));
  }
});
test('UAE hub exposes its five own detail links, no Saudi codes',async()=>{
  const html=await page('/uae');
  const links=couponDetailHrefs(html);
  assert.equal(links.length,5);
  assert.deepEqual(links.map(x=>x.slug),HOMEPAGE_COUPONS_BY_MARKET.AE);
  assert.ok(links.every(x=>x.slug===x.label));
});
test('all-coupon page links exactly to all ten approved code details',async()=>{
  const html=await page('/coupons');
  const links=couponDetailHrefs(html);
  assert.equal(links.length,10);
  assert.deepEqual(new Set(links.map(x=>x.slug)),new Set(APPROVED_COUPON_CODES));
  assert.ok(html.includes('data-copy="NOV170"'));
});
test('each detail target remains public with one canonical owner URL',async()=>{
  for(const code of APPROVED_COUPON_CODES){
    const url='/coupon/'+code.toLowerCase();
    const html=await page(url);
    assert.ok(html.includes('<link rel="canonical" href="'+origin+url+'">'),url);
  }
});

test('production commerce country hubs lead with the owner-primary NOV and link its unique canonical detail',async()=>{
  for(const [market,code] of [['saudi',PRIMARY_COUPON_BY_MARKET.SA],['uae',PRIMARY_COUPON_BY_MARKET.AE]]){
    const detail='/coupon/'+code.toLowerCase();
    const arabic=await commerceLanding('/'+market,origin,{});
    assert.equal(arabic.status,200);
    const html=await arabic.text();
    assert.ok(html.includes('<span class="code">'+code+'</span>'),'country hero displays approved primary '+code);
    assert.ok(html.includes('href="'+detail+'">تفاصيل كود '+code+' الأساسية</a>'),'country link points at the primary canonical detail');
    assert.ok(html.includes('href="'+detail+'">شروط كود '+code+'</a>'),'coupon CTA links to canonical details');
    const english=await commerceLanding('/en/'+market,origin,{});
    assert.equal(english.status,200);
    const enHtml=await english.text();
    assert.ok(enHtml.includes('<span class="code">'+code+'</span>'),'English hub leads with approved primary '+code);
    assert.ok(enHtml.includes('href="'+detail+'">Primary coupon '+code+' details</a>'),'English hub links canonical code');
  }
});

test('landing-page canonical links receive a fresh cache key without purging article or blog caches',()=>{
  assert.equal(publicEdgePolicyRevision('/coupons'),'nov-coupon-detail-links-v1');
  for(const path of ['/saudi','/uae'])
    assert.equal(publicEdgePolicyRevision(path),'primary-market-nov-canonical-v1');
  for(const path of ['/en/saudi','/en/uae'])
    assert.equal(publicEdgePolicyRevision(path),'english-market-copy-approved-v1');
  assert.notEqual(publicEdgePolicyRevision('/blog'),'nov-coupon-detail-links-v1');
  assert.notEqual(publicEdgePolicyRevision('/articles/nov170-tips'),'nov-coupon-detail-links-v1');
  assert.notEqual(publicEdgePolicyRevision('/sitemap-core.xml'),'nov-coupon-detail-links-v1');
});


test('English market coupon pages only list five codes approved for that market and link canonical details',async()=>{
  const {commerceLanding,ENGLISH_MARKET_COUPON_COPY_SCRIPT}=await import('../commerce-pages-v2.js');
  for(const [market,key] of [['saudi','SA'],['uae','AE']]){
    const res=await commerceLanding('/en/'+market+'/noon-coupon-code',origin,{});
    assert.equal(res.status,200);
    const html=await res.text();
    const section=html.split('<h2>Codes to test now</h2>')[1]?.split('</section>')[0];
    assert.ok(section,market+' has coupon listing');
    const listed=[...section.matchAll(/data-english-copy="(NOV\d{3})"/g)].map(x=>x[1]);
    assert.deepEqual(listed,HOMEPAGE_COUPONS_BY_MARKET[key]);
    assert.equal(listed.length,5,'exactly five market-approved copy controls');
    assert.ok(!section.includes('onclick='),'no stripped/inert inline copy handlers');
    assert.ok(section.includes('data-market="'+key+'"'));
    for(const code of listed)assert.ok(section.includes('href="/coupon/'+code.toLowerCase()+'"'),'canonical detail for '+code);
    const primary=PRIMARY_COUPON_BY_MARKET[key];
    assert.ok(html.includes('href="/coupon/'+primary.toLowerCase()+'">Primary '+primary+' coupon details</a>'));
    assert.ok(html.includes(ENGLISH_MARKET_COUPON_COPY_SCRIPT),'live HTML contains real delegated copy implementation');
    assert.equal(publicEdgePolicyRevision('/en/'+market+'/noon-coupon-code'),'english-market-coupon-copy-canonical-v1');
  }
  assert.equal(publicEdgePolicyRevision('/en/coupons'),'r2-jsonld-dedupe-r16','generic ten-code catalog stays untouched');
});

test('English coupon copy records success ONLY when the clipboard write succeeds',async()=>{
  const {runInNewContext}=await import('node:vm');
  const {ENGLISH_MARKET_COUPON_COPY_SCRIPT}=await import('../commerce-pages-v2.js');
  const source=ENGLISH_MARKET_COUPON_COPY_SCRIPT.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'');
  const run=async success=>{
    const handlers={}; const events=[]; const pending=[];
    const btn={
      textContent:'Copy NOV188',
      isConnected:true,
      getAttribute:key=>({'data-english-copy':'NOV188','data-market':'AE'})[key]||null
    };
    const document={addEventListener:(event,handler)=>{handlers[event]=handler}};
    const navigator={clipboard:{async writeText(code){assert.equal(code,'NOV188');if(!success)throw Error('blocked')}}};
    const window={gtag:(...args)=>events.push(args)};
    runInNewContext(source,{document,navigator,window,location:{pathname:'/en/uae/noon-coupon-code'},setTimeout:(fn)=>pending.push(fn)});
    await handlers.click({target:{closest:(selector)=>selector==='button[data-english-copy]'?btn:null}});
    return{btn,events,pending};
  };
  const copied=await run(true);
  assert.equal(copied.btn.textContent,'Copied NOV188 ✓');
  const successEvents=copied.events.filter(x=>x[1]==='coupon_copy_success');
  assert.equal(successEvents.length,1);
  assert.equal(successEvents[0][2].coupon_code,'NOV188');
  assert.equal(successEvents[0][2].market,'AE');
  assert.ok(!copied.events.some(x=>x[1]==='purchase'));
  copied.pending[0]();
  assert.equal(copied.btn.textContent,'Copy NOV188');
  const denied=await run(false);
  assert.match(denied.btn.textContent,/Copy unavailable/);
  assert.equal(denied.events.filter(x=>x[1]==='coupon_copy_success').length,0);
});



test('English country/category/product/savings CTAs are functional and never expose opposite-market approved codes',async()=>{
  const {commerceLanding,ENGLISH_MARKET_COUPON_COPY_SCRIPT}=await import('../commerce-pages-v2.js');
  const paths=[
    ['/en/saudi','SA'],['/en/uae','AE'],
    ['/en/saudi/category/mobiles','SA'],['/en/uae/category/mobiles','AE'],
    ['/en/uae/product/iphone-duo','AE'],['/en/uae/saving-guide','AE']
  ];
  for(const [path,market] of paths){
    const response=await commerceLanding(path,origin,{});
    assert.equal(response.status,200,path);
    const html=await response.text();
    const btn=[...html.matchAll(/<button class="cta" type="button" data-english-copy="(NOV\d{3})" data-copy-code="\1" data-market="(SA|AE)"/g)];
    assert.equal(btn.length,1,path+' has one live-market Copy control');
    assert.equal(btn[0][2],market,path+' must label market accurately');
    assert.ok(HOMEPAGE_COUPONS_BY_MARKET[market].includes(btn[0][1]),path+' cannot offer a code belonging to the other market');
    assert.ok(html.includes(ENGLISH_MARKET_COUPON_COPY_SCRIPT),path+' must embed the tested copy handler');
    assert.ok(!html.includes('onclick="navigator.clipboard'),path+' must not depend on stripped handlers');
    assert.equal(publicEdgePolicyRevision(path),'english-market-copy-approved-v1');
  }
  assert.equal(publicEdgePolicyRevision('/en/uae/noon-coupon-code'),'english-market-coupon-copy-canonical-v1','PR #136 pages retain their own cache revision');
});

test('Arabic country commerce guides choose only approved coupons belonging to that country',async()=>{
  const {commerceLanding}=await import('../commerce-pages-v2.js');
  const paths=[
    ['/saudi/categories','SA'],['/uae/categories','AE'],
    ['/saudi/category/mobiles','SA'],['/uae/category/mobiles','AE']
  ];
  for(const [path,market] of paths){
    const response=await commerceLanding(path,origin,{});
    assert.equal(response.status,200,path);
    const html=await response.text();
    const cards=[...html.matchAll(/<aside class="coupon">[\s\S]*?<span class="code">(NOV\d{3})<\/span>/g)].map(x=>x[1]);
    assert.ok(cards.length>=1,path+' displays a source-approved offer');
    assert.ok(cards.every(code=>HOMEPAGE_COUPONS_BY_MARKET[market].includes(code)),path+' shows no cross-market code');
  }
});



test('2026 current-device navigation cites only evidence-backed models without rewriting article dates',async()=>{
  const {currentDevicesEditorialPanel,EDITORIAL_DEVICE_REFERENCES_2026,commerceLanding}=await import('../commerce-pages-v2.js');
  assert.ok(EDITORIAL_DEVICE_REFERENCES_2026.apple.source.includes('apple.com'));
  assert.ok(EDITORIAL_DEVICE_REFERENCES_2026.samsung.source.includes('samsung.com'));
  assert.ok(EDITORIAL_DEVICE_REFERENCES_2026.oppo.source.includes('oppo.com'));
  assert.ok(EDITORIAL_DEVICE_REFERENCES_2026.xiaomi.source.includes('mi.com'));
  const onlyApple=currentDevicesEditorialPanel('saudi','apple');
  assert.match(onlyApple,/iPhone 18 Pro Max/);
  assert.doesNotMatch(onlyApple,/iPhone 15/);
  assert.doesNotMatch(onlyApple,/Galaxy S26/);
  assert.match(onlyApple,/مراجعة 10 نوفمبر 2026/);
  const countries=['saudi','uae'];
  for(const country of countries){
    for(const path of ['/'+country+'/category/mobiles','/en/'+country+'/category/mobiles','/'+country+'/brand/apple','/'+country+'/brand/samsung']){
      const res=await commerceLanding(path,origin,{});
      assert.equal(res.status,200,path);
      const html=await res.text();
      assert.ok(html.includes('data-current-device-evidence="2026-11-10"'),path);
      assert.ok(html.includes('iPhone 18 Pro Max') || html.includes('Galaxy S26 Ultra'));
      assert.equal(publicEdgePolicyRevision(path),'editorial-verified-device-20261110-v1',path);
    }
  }
  for(const key of ['honor','xiaomi']){
    const panel=currentDevicesEditorialPanel('uae',key);
    assert.match(panel,/الإتاحة المحلية|توافره المحلي/);
  }
});
