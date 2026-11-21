import test from 'node:test';
import assert from 'node:assert/strict';
import marketApp from '../seo-layer.js';
import blogApp from '../auto-platform.js';
import {HOMEPAGE_COUPONS_BY_MARKET} from '../approved-coupons.js';

const ORIGIN='https://noondealsnow.com';

function readSchema(html){
  const json=html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(json,'page must contain parsable JSON-LD');
  return JSON.parse(json[1])['@graph'];
}

function checkVisibleFaq(html,graph,expectedCount){
  const faqs=graph.filter(entity=>entity['@type']==='FAQPage');
  assert.equal(faqs.length,1,'use one FAQPage entity');
  assert.equal(faqs[0].mainEntity.length,expectedCount);
  assert.match(html,/class="visible-coupon-faq"/);
  for(const entry of faqs[0].mainEntity){
    assert.equal(entry['@type'],'Question');
    assert.equal(entry.acceptedAnswer['@type'],'Answer');
    assert.ok(html.includes('<h3>'+entry.name+'</h3>'),'FAQ question must appear in visible HTML: '+entry.name);
    assert.ok(html.includes('<p>'+entry.acceptedAnswer.text+'</p>'),'FAQ answer must appear in visible HTML: '+entry.name);
  }
}

test('six country coupon landing pages expose the same FAQs in HTML and schema, without keyword lists',async()=>{
  for(const prefix of ['/saudi-arabia','/uae']){
    for(const suffix of ['', '-today', '-2026']){
      const path=prefix+'/noon-coupon-code'+suffix;
      const response=await marketApp.fetch(new Request(ORIGIN+path),{});
      assert.equal(response.status,200,path);
      const html=await response.text();
      const graph=readSchema(html);
      checkVisibleFaq(html,graph,suffix===''?6:3);
      assert.match(html,/لمن هذا الدليل؟/);
      assert.doesNotMatch(html,/طرق البحث التي تغطيها الصفحة/,'do not publish an SEO keyword-stuffing block');
      assert.ok(html.includes('<link rel="canonical" href="'+ORIGIN+path+'">'));
    }
  }
});

test('market-specific coupon pages preserve primary canonicals and render every JSON-LD FAQ answer',async()=>{
  for(const [country,prefix] of [['SA','saudi-arabia'],['AE','uae']]){
    for(const code of HOMEPAGE_COUPONS_BY_MARKET[country]){
      const path='/'+prefix+'/coupon/'+code.toLowerCase();
      const response=await marketApp.fetch(new Request(ORIGIN+path),{});
      assert.equal(response.status,200,path);
      const html=await response.text();
      const graph=readSchema(html);
      checkVisibleFaq(html,graph,2);
      assert.ok(html.includes('<link rel="canonical" href="'+ORIGIN+'/coupon/'+code.toLowerCase()+'">'));
      assert.ok(html.includes('نسخ الكود '+code));
    }
  }
});

test('public blog describes the quality gate without an unverified human-review claim',async()=>{
  const env={CONTENT_FINAL:{
    async get(key){
      if(key==='bulk/public-compact-v1.json')return {json:async()=>({version:1,articles:[{
        slug:'published-guide-for-test',status:'published',country:'SA',title:'دليل تسوق نون السعودية',
        coupon:'NOV170',publishedAt:'2026-11-19T12:00:00Z'
      }]})};
      return null;
    }
  }};
  const response=await blogApp.fetch(new Request(ORIGIN+'/blog'),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-blog-schema'),'collection-v1');
  const html=await response.text();
  assert.match(html,/تمرّ بفحوص جودة المحتوى/);
  assert.doesNotMatch(html,/يراجعها فريق التحرير للتأكد/);
  assert.match(html,/published-guide-for-test/);
});

test('primary Saudi and UAE coupon hubs explain cashback vs instant discount using Noon sources without fabricated code claims',async()=>{
  for(const [market,prefix,country] of [['SA','/saudi-arabia','السعودية'],['AE','/uae','الإمارات']]){
    const url=ORIGIN+prefix+'/noon-coupon-code',res=await marketApp.fetch(new Request(url),{});
    assert.equal(res.status,200);
    const html=await res.text(),graph=readSchema(html);
    const list=graph.find(entity=>entity['@type']==='ItemList');
    assert.ok(list,market+' needs an explicit schema link inventory');
    assert.equal(list.numberOfItems,HOMEPAGE_COUPONS_BY_MARKET[market].length);
    assert.deepEqual(list.itemListElement.map(x=>x.url),
      HOMEPAGE_COUPONS_BY_MARKET[market].map(code=>ORIGIN+'/coupon/'+code.toLowerCase()));
    assert.ok(html.includes('<html lang="ar-'+market+'" dir="rtl">'),'country locale remains valid');
    assert.match(html,/id="offer-types"/);
    assert.match(html,/id="checkout-diagnostics"/);
    assert.match(html,/id="official-noon-sources"/);
    assert.match(html,/id="coupon-list"/);
    assert.match(html,/href="#official-noon-sources"/);
    assert.match(html,/coupon-help-table/);
    assert.match(html,/ما الفرق بين الخصم الفوري والرصيد المسترجع/);
    assert.match(html,/https:\/\/help\.noon\.com\/portal\/en\/kb\/articles\/all-you-need-to-know-about-discounts/);
    assert.match(html,/https:\/\/help\.noon\.com\/portal\/en\/kb\/articles\/coupon-cashback-uae-ksa/);
    assert.ok(html.includes('نون '+country));
    assert.doesNotMatch(html,/(\d+)%\s*(?:خصم|كاش باك|استرداد)/,'no unsourced fixed percentage');
    assert.match(html,/لا تثبت صلاحية الأكواد المدرجة هنا/);
    assert.match(html,/rel="canonical" href="https:\/\/noondealsnow\.com/);
    checkVisibleFaq(html,graph,6);
  }
});
test('today/year page variants stay compact and do not duplicate the expanded core coupon guide',async()=>{
  for(const market of ['saudi-arabia','uae']){
    for(const ext of ['-today','-2026']){
      const url=ORIGIN+'/'+market+'/noon-coupon-code'+ext;
      const res=await marketApp.fetch(new Request(url),{});
      assert.equal(res.status,200);
      const html=await res.text(),graph=readSchema(html);
      assert.ok(!graph.some(item=>item['@type']==='ItemList'));
      assert.doesNotMatch(html,/id="offer-types"/);
      assert.doesNotMatch(html,/id="official-noon-sources"/);
      assert.match(html,/rel="canonical" href="/);
      checkVisibleFaq(html,graph,3);
    }
  }
});
