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
 assert.equal(report.generatedPages,105);
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
   assert.ok(html.includes('Quick shopping navigation'),p);
   assert.ok(html.includes('id="ndn-static-ga4"')||html.includes('id="rescue-site-analytics"'),p);
 }
});
