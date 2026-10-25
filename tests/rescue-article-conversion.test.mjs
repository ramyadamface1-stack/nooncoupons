import test from 'node:test';
import assert from 'node:assert/strict';
import {primaryCodeForMarket,presentMarketCouponText,renderCouponAction,renderRelatedArticles,rescueCopyScript,rescueArticleStyles} from '../rescue-article-conversion.js';
import {emergencyPublicR2Response} from '../r2-emergency-readonly.js';

test('primary code is locked to country; never show Saudi code to UAE shoppers',()=>{
  assert.equal(primaryCodeForMarket('SA'),'NOV170');
  assert.equal(primaryCodeForMarket('AE'),'NOV188');
  assert.match(renderCouponAction('SA'),/data-rescue-copy="NOV170"/);
  assert.match(renderCouponAction('AE',true),/data-rescue-copy="NOV188"/);
  assert.doesNotMatch(renderCouponAction('AE'),/NOV170/);
});
test('rewrite displayed article codes but do not change old URLs, scripts or original stored body',()=>{
  const original='<h1>نون NOV174</h1><p>كوبون NOV195، كود RAMY25</p><a href="/coupon/nov174">NOV174</a><img src="/assets/coupon-svg/abc/1.svg?v=9&amp;coupon=NOV174"/><script type="application/ld+json">{"code":"NOV174"}</script>';
  const rendered=presentMarketCouponText(original,'SA');
  assert.match(rendered,/<h1>نون NOV170<\/h1>/);
  assert.match(rendered,/<p>كوبون NOV170، كود NOV170<\/p>/);
  assert.match(rendered,/href="\/coupon\/nov174">NOV170<\/a>/);
  assert.match(rendered,/coupon=NOV170/);
  assert.match(rendered,/<script type="application\/ld\+json">{"code":"NOV174"}<\/script>/);
  assert.match(original,/نون NOV174/,'stored HTML remains unchanged');
});
test('copy UI is keyboard accessible, makes no guaranteed discount claim, and has fallback',()=>{
  const x=renderCouponAction('SA',false,'top');
  assert.match(x,/<button type="button"/);
  assert.match(x,/role="status" aria-live="polite"/);
  assert.match(x,/noon\.com\/saudi-ar/);
  assert.match(x,/rel="noopener noreferrer sponsored"/);
  assert.match(rescueCopyScript,/navigator\.clipboard\.writeText/);
  assert.match(rescueCopyScript,/execCommand\('copy'\)/);
  assert.match(rescueCopyScript,/\/api\/track-event/);
  assert.match(rescueCopyScript,/sendBeacon/);
  assert.match(rescueCopyScript,/doNotTrack/);
  assert.match(rescueCopyScript,/track\('copy_code'/);
  assert.match(rescueCopyScript,/track\('open_noon'/);
  assert.match(rescueArticleStyles,/a:not\(\.rescue-shop\)/);
  assert.match(rescueArticleStyles,/position:static!important/);
});
test('related article suggestions only come from published, right-market, genuinely distinct URLs',()=>{
  const items=[
    {slug:'saudi-sunscreen-review',title:'تقييم sunscreen نون السعودية',country:'SA',status:'published',createdAt:'2026-10-25T00:00:00Z'},
    {slug:'en-uae-sunscreen',title:'UAE skincare',country:'AE',status:'published'},
    {slug:'saudi-draft',title:'Sunscreen سعودي',country:'SA',status:'draft'},
    {slug:'saudi-phone',title:'مقارنة الجوالات على نون السعودية',country:'SA',status:'published'}
  ];
  const html=renderRelatedArticles(items,'saudi-sunscreen-guide','SA',false);
  assert.match(html,/\/articles\/saudi-sunscreen-review/);
  assert.match(html,/\/articles\/saudi-phone/);
  assert.doesNotMatch(html,/en-uae-sunscreen|saudi-draft/);
});
test('actual emergency R2 article responds with market-specific copy CTA, contrast links and canonical',async()=>{
  const realFetch=globalThis.fetch;
  const pageHtml='<h1>تجربة NOV174 في نون السعودية</h1><p>جرّب NOV174 بعد المقارنة.</p><p><a href="/saudi">دليل السعودية</a> و<a href="https://www.noon.com/saudi-ar/">نون</a></p>';
  globalThis.fetch=async url=>{
    const key=decodeURIComponent(new URL(url).pathname);
    if(key.includes('/articles/'))return new Response(pageHtml,{status:200,headers:{'x-amz-meta-c':'SA','x-amz-meta-status':'published','content-type':'text/html'}});
    if(key.includes('/blog/latest-live-v1.json'))return new Response('{"articles":[]}',{status:200});
    throw Error('Unexpected mock R2 key '+key);
  };
  try{
    const env={R2_RESCUE_READONLY_ENABLED:'true',NOON_RESCUE_R2_ACCESS_KEY_ID:'TEST',NOON_RESCUE_R2_SECRET_ACCESS_KEY:'TEST'};
    const response=await emergencyPublicR2Response(new Request('https://noondealsnow.com/articles/saudi-legacy-nov174'),env);
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,/<link rel="canonical" href="https:\/\/noondealsnow.com\/articles\/saudi-legacy-nov174"/);
    assert.match(html,/<button type="button" class="rescue-copy" data-rescue-copy="NOV170"/);
    assert.match(html,/class="rescue-mobile-offer"/);
    assert.match(html,/id="rescue-coupon-copy"/);
    assert.match(html,/id="rescue-article-ux"/);
    assert.match(html,/href="\/saudi"/);
    assert.doesNotMatch(html,/تجربة NOV174/);
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
  }finally{globalThis.fetch=realFetch}
});
