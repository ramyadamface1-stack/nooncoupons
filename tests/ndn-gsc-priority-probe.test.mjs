import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAll,checkOne,priorities} from '../scripts/ndn-gsc-recovery-priority-probe.mjs';
const base='https://noondealsnow.com';
const headers={'content-type':'text/html'};
const html=url=>'<html><head><link rel="canonical" href="'+url+'"><meta name="robots" content="index,follow"></head><body><h1>Valid Noon guide</h1></body></html>';
test('only previously impression-bearing public URLs and a bounded request budget',()=>{
 assert.ok(priorities.length>=20&&priorities.length<=40);
 assert.equal(new Set(priorities.map(x=>x[0])).size,priorities.length);
 assert.ok(priorities.some(x=>x[0]==='/saudi-arabia/noon-coupon-code'));
 assert.ok(priorities.some(x=>x[0].startsWith('/en/articles/')));
 assert.ok(priorities.some(x=>x[0]==='/saudi'));
});
test('HTTP 5xx, noindex and canonical drift are visible as technical flags',async()=>{
 const broken=await checkOne('/saudi',390,'commercial',async()=>new Response('<h1>Error</h1>',{status:503,headers}));
 assert.equal(broken.result,'FAIL');
 assert.ok(broken.reasons.includes('HTTP_503'));
 const mismatch=await checkOne('/coupons',102,'commercial',async()=>new Response(html(base+'/somewhere-else'),{status:200,headers}));
 assert.ok(mismatch.reasons.includes('CANONICAL_MISMATCH_OR_MISSING'));
 const valid=await checkOne('/coupons',102,'commercial',async()=>new Response(html(base+'/coupons'),{status:200,headers}));
 assert.equal(valid.result,'PASS');
});
test('intentional legacy English UAE canonical/noindex is a normalized alias, not a false failure',async()=>{
 const alias=await checkOne('/en/uae/noon-coupon-code',48,'commercial',async()=>
  new Response('<html><head><meta name="robots" content="noindex,follow"><link rel="canonical" href="'+base+'/uae/noon-coupon-code"></head><body><h1>Noon UAE coupon</h1></body></html>',{status:200,headers}));
 assert.equal(alias.result,'EXPECTED_CANONICAL_ALIAS');
 assert.deepEqual(alias.reasons,[]);
});
test('mocked end-to-end audit makes zero writes and preserves original URLs',async()=>{
 let calls=0;
 const mock=async url=>{
  calls++;
  return new Response(html(url),{status:200,headers});
 };
 const report=await checkAll(mock);
 assert.equal(report.checked,priorities.length);
 assert.equal(report.passed,priorities.length);
 assert.equal(report.failed,0);
 assert.equal(calls,priorities.length);
 assert.match(report.caveat,/not Google indexed/);
});
