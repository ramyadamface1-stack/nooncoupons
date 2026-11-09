import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../scripts/cloudflare-ai-crawler-analytics.mjs',import.meta.url),'utf8');
test('Cloudflare report labels synthetic probe-pattern traffic separately',()=>{
  assert.ok(source.includes('Known probe-pattern') || source.includes('Test-pattern traffic'));
  assert.ok(source.includes('Other (unverified)'));
  assert.ok(source.includes('automated-readonly-visibility-monitor'));
  assert.ok(source.includes("ua===('Mozilla/5.0 (compatible; '+agent+'/1.0)')"));
  assert.ok(source.includes('otherCouponHits'));
  assert.ok(source.includes('Remaining traffic is still UNVERIFIED'));
});
test('coupon-only counts guard both market detail URLs',()=>{
  assert.ok(source.includes("if(['/coupon/nov170','/coupon/nov188'].includes(row.dimensions?.clientRequestPath)){"));
  assert.ok(source.includes('if(!probePattern)otherCouponHits.set(path'));
  assert.ok(source.includes('const path=row.dimensions.clientRequestPath;'));
});
