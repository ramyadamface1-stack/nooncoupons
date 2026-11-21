import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root='.ndn-static-assets',origin='https://noondealsnow.com';
test('historical conversion and keyword URLs cannot return Worker 1027',()=>{
 const names=['/saudi-arabia','/saudi-arabia/noon-coupon-code','/brands',
 '/golden-keywords','/coupon/noon-discount-50',
 '/guide/noon-yellow-friday','/guide/noon-refund-credit'];
 for(const p of names){
  const file=root+p+'.html';
  assert.ok(existsSync(file),'MISSING '+file);
  const html=readFileSync(file,'utf8');
  assert.ok(html.includes('<h1'),p);
  assert.ok(html.includes('ndn-legacy-static-bridge'),p);
  assert.ok(html.includes('id="ndn-static-ga4"'),p);
  assert.ok(html.includes('href="/saudi/noon-coupon-code"'),p);
  assert.ok(html.includes('href="/uae/noon-coupon-code"'),p);
  assert.ok(html.includes('<link rel="canonical" href="'+
    (p==='/saudi-arabia'?origin+'/saudi':origin+p)+'">'),p);
  assert.ok(!html.includes('Please check back later'),p);
 }
 const coupon=readFileSync(root+'/saudi-arabia/noon-coupon-code.html','utf8');
 assert.ok(coupon.includes('NOV170')&&coupon.includes('data-code="NOV170"'));
 const qa=readFileSync(root+'/guide/noon-yellow-friday.html','utf8');
 assert.ok(qa.includes('"@type":"FAQPage"'));
 const gold=readFileSync(root+'/golden-keywords.html','utf8');
 assert.ok(gold.includes('<meta name="robots" content="noindex,follow">'));
});
