import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PUBLIC_CATEGORIES} from '../index.js';
const base='.ndn-static-assets';
const slugs=['first-order','mobile-phones','home-appliances','electronics','perfumes-beauty','baby'];
const ae=['first-order','electronics','beauty','home-appliances'];
const report=JSON.parse(readFileSync('.ndn-blog-staging/market-seo-report.json','utf8'));
const page=path=>readFileSync(base+path+'.html','utf8');
test('no missing market root, category, or buying-intent pages under quota exhaustion',()=>{
 assert.equal(PUBLIC_CATEGORIES.length,42);
 assert.equal(report.categoryPages,84);
 assert.equal(report.keywordGuides,10);
 assert.equal(report.generatedPages,110);
 for(const m of ['saudi','uae']){
   const coupon=m==='saudi'?'NOV170':'NOV188';
   for(const p of ['/'+m+'/categories','/'+m+'/noon-coupon-code','/'+m+'/shopping-guide']){
     const html=page(p);
     assert.ok(html.includes('<h1>'),p);
     const canonical=p==='/saudi/noon-coupon-code'?'/saudi-arabia/noon-coupon-code':p;
     assert.ok(html.includes('<link rel="canonical" href="https://noondealsnow.com'+canonical+'">'),p);
     assert.ok(html.includes(coupon),p);
     assert.ok(html.includes('id="ndn-static-ga4"'),p);
   }
   for(const c of PUBLIC_CATEGORIES){
     const p='/'+m+'/category/'+c[0];
     assert.ok(existsSync(base+p+'.html'),p);
     assert.ok(page(p).includes('<meta name="robots" content="noindex,follow">'),p);
   }
   const topics=m==='saudi'?slugs:ae;
   for(const slug of topics){
     const p='/'+m+'/buying-guide/'+slug;
     const html=page(p),img=base+'/assets/coupon-svg/seo-'+m+'-'+slug+'/1.svg';
     assert.ok(html.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),p);
     assert.ok(html.includes('<link rel="canonical" href="https://noondealsnow.com'+p+'">'),p);
     assert.ok(html.includes('data-code="'+coupon+'"'),p);
     assert.ok(html.includes('data-shop-click="'+coupon+'"'),p);
     assert.ok(html.includes('coupon_copy_success'),p);
     assert.ok(html.includes('store_outbound_click'),p);
     assert.ok(existsSync(img),img);
     const svg=readFileSync(img,'utf8');
     assert.ok(svg.includes('<svg')&&svg.includes('width="1600"')&&svg.includes(coupon));
   }
 }
});
test('homepage sells with correct Saudi coupon, non-duplicated analytics, and working blog navigation',()=>{
 const home=readFileSync(base+'/index.html','utf8');
 assert.ok(home.includes('id="commercial-buying-intent"'));
 assert.ok(home.includes('كود خصم نون السعودية NOV170'));
 assert.ok(home.includes('/saudi/noon-coupon-code'));
 assert.ok(home.includes('/uae/noon-coupon-code'));
 assert.ok(home.includes('/saudi/categories'));
 assert.ok(home.includes('/uae/categories'));
 assert.equal((home.match(/id="ndn-static-ga4"/g)||[]).length,1);
 for(const p of ['/blog','/blog/saudi','/blog/uae','/blog/page/2']){
   const html=page(p);
   assert.ok(html.includes('data-blog-premium="v1"'),p);
   const navigationLabel=p==='/blog/uae'? 'aria-label="Main navigation"':'aria-label="روابط الموقع الرئيسية"';
   assert.ok(html.includes(navigationLabel),p);
   if(p==='/blog/uae')assert.ok(html.includes('<html lang="en-AE" dir="ltr">'),p);
   assert.equal((html.match(/aria-label="Quick shopping navigation"/g)||[]).length,0,'duplicate_header_'+p);
   assert.ok(html.includes('href="/golden-keywords"'),p);
   assert.ok(html.includes('id="ndn-static-ga4"')||html.includes('id="rescue-site-analytics"'),p);
 }
});

test('golden keyword hub is public, static, country-safe and routes every intent to a detailed guide',()=>{
 const index=page('/golden-keywords');
 assert.ok(index.includes('<html lang="ar-SA" dir="rtl">'));
 assert.ok(index.includes('<meta name="ndn-public-golden-keywords"'));
 assert.ok(index.includes('<meta name="robots" content="index,follow,max-image-preview:large">'));
 assert.ok(index.includes('<link rel="canonical" href="https://noondealsnow.com/golden-keywords">'));
 assert.ok(index.includes('الكلمات المفتاحية الذهبية'));
 assert.ok(index.includes('NOV170')&&index.includes('NOV188'));
 assert.ok(index.includes('دون')||index.includes('ليست ترتيبًا'));
 for(const market of ['saudi','uae']){
  const path='/'+market+'/golden-keywords',country=page(path);
  const code=market==='saudi'?'NOV170':'NOV188',other=market==='saudi'?'NOV188':'NOV170';
  assert.ok(country.includes('<link rel="canonical" href="https://noondealsnow.com'+path+'">'));
  assert.ok(country.includes('<meta name="robots" content="index,follow,max-image-preview:large">'));
  assert.ok(country.includes('data-code="'+code+'"'));
  assert.ok(!country.includes('data-code="'+other+'"'));
  assert.ok(country.includes('id="ndn-static-ga4"'));
  assert.ok(country.includes('/'+market+'/buying-guide/'+(market==='saudi'?'samsung-s26-ultra':'mini-led-tv')));
  assert.ok(country.includes('/'+market+'/categories')||country.includes('/'+market+'/buying-guide/first-order'));
  const guide=market==='saudi'?'mobile-phones':'beauty';
  assert.ok(country.includes('/'+market+'/buying-guide/'+guide));
  assert.ok(existsSync(base+'/'+market+'/buying-guide/'+guide+'.html'));
  assert.ok(existsSync(base+'/'+market+'/buying-guide/'+(market==='saudi'?'samsung-s26-ultra':'mini-led-tv')+'.html'));
  assert.ok(country.includes('لا تتوفر')||country.includes('have not yet been measured'));
  assert.ok(index.includes('href="'+path+'"'));
 }
 const home=readFileSync(base+'/index.html','utf8');
 assert.ok(home.includes('href="/golden-keywords"'));
 assert.ok(home.includes('صفحة الكلمات المفتاحية الذهبية'));
 for(const p of ['/blog','/blog/saudi','/blog/uae'])assert.ok(page(p).includes('href="/golden-keywords"'),p);
});

test('golden keyword page has actual observed query evidence and no cloned brand coupon index',()=>{
 const report=JSON.parse(readFileSync('.ndn-blog-staging/golden-keyword-evidence-report.json','utf8'));
 assert.equal(report.version,2);
 assert.equal(report.monthlySearchVolumeMeasured,false);
 assert.equal(report.organicKeywordDifficultyMeasured,false);
 assert.equal(report.sa.length,9);
 assert.equal(report.ae.length,6);
 for(const group of [report.sa,report.ae]){
  assert.equal(new Set(group.map(x=>x.target)).size,group.length,'duplicate page targets');
  for(const row of group){
   assert.ok(row.query.length>15);
   assert.ok(row.target.startsWith('/'));
   assert.ok(existsSync(base+row.target+'.html')||row.target.startsWith('/articles/'),row.target);
  }
 }
 const observed=report.sa.filter(x=>x.gscEvidence);
 assert.equal(observed.length,5);
 assert.ok(observed.some(x=>x.observedKeyword==='noon s26 ultra'&&x.gscEvidence.impressions===2));
 const index=page('/golden-keywords');
 assert.ok(index.includes('س26')||index.includes('S26 Ultra'));
 assert.ok(index.includes('الجمعة الصفراء نون'));
 assert.ok(index.includes('Noon UAE Mini LED TV'));
 assert.ok(!index.includes('كود نون السعودية Huawei NOV170'));
 assert.ok(!index.includes('/saudi/brand/honor'));
 assert.ok(index.includes('غير متاح')||index.includes('لا تتوفر'));
});
test('each newly discovered keyword has a non-template, detailed and crawlable article with its own artwork',()=>{
 for(const [market,slug,coupon] of [['saudi','samsung-s26-ultra','NOV170'],['uae','mini-led-tv','NOV188']]){
  const route='/'+market+'/buying-guide/'+slug,html=page(route);
  assert.ok(html.includes('href="https://noondealsnow.com'+route+'"'));
  assert.ok(html.includes('index,follow,max-image-preview:large'));
  assert.ok(html.includes('data-code="'+coupon+'"'));
  assert.ok(html.includes('"@type":"Article"'));
  assert.ok(html.includes('"@type":"FAQPage"'));
  assert.ok((html.match(/<h2>/g)||[]).length>=7);
  assert.ok(html.includes('https://www.noon.com/'));
  const svg=base+'/assets/coupon-svg/seo-'+market+'-'+slug+'/1.svg';
  assert.ok(existsSync(svg));
  assert.ok(readFileSync(svg,'utf8').includes(coupon));
  assert.ok(!html.includes('data-code="'+(coupon==='NOV170'?'NOV188':'NOV170')+'"'));
 }
});
