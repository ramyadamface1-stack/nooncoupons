import test from 'node:test';
import assert from 'node:assert/strict';
import {BRANDS} from '../commerce-taxonomy.js';
import {readFileSync,existsSync} from 'node:fs';
const root='.ndn-static-assets';
test('entire brand directory has country-specific quota-free market URLs',()=>{
 const names=Object.keys(BRANDS).filter(slug=>BRANDS[slug]?.label);
 assert.equal(names.length,30);
 const directory=readFileSync(root+'/brands.html','utf8');
 const report=JSON.parse(readFileSync('.ndn-blog-staging/brand-route-coverage.json','utf8'));
 assert.equal(report.marketRoutes,60);
 for(const slug of names){
   for(const m of ['saudi','uae']){
     const path='/'+m+'/brand/'+slug;
     assert.ok(directory.includes('href="'+path+'"'),'directory link missing '+path);
     assert.ok(existsSync(root+path+'.html'),'BRAND_429_RISK '+path);
     const html=readFileSync(root+path+'.html','utf8');
     const code=m==='saudi'?'NOV170':'NOV188';
     assert.ok(html.includes('<h1>'),path);
     assert.ok(html.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),path);
     assert.ok(html.includes('<link rel="canonical" href="https://noondealsnow.com'+path+'">'),path);
     assert.ok(html.includes('name="ndn-static-brand-catalog" content="v1"'),path);
     assert.ok(html.includes('id="ndn-static-ga4"'),path);
     assert.ok(html.includes('data-code="'+code+'"'),path);
     assert.ok(html.includes('"@type":"FAQPage"'),path);
     assert.ok(html.includes('coupon_copy_success')&&html.includes('store_outbound_click'),path);
     assert.ok(html.includes('href="/brands"'),path);
     assert.ok(!html.includes('Please check back later'),path);
   }
 }
});
