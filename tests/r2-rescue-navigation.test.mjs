import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const rescue=readFileSync(new URL('../r2-emergency-readonly.js',import.meta.url),'utf8');
const cache=readFileSync(new URL('../r2-public-cache-policy.js',import.meta.url),'utf8');

test('public R2 rescue articles have topic-hub paths for crawl discovery',()=>{
  assert.match(rescue,/id="article-topic-path"/);
  assert.match(rescue,/\/topics\/buying-guides/);
  assert.match(rescue,/\/topics\/coupon-help/);
});

test('R2 rescue blog filters market and buying intent, with noindex on faceted result',()=>{
  assert.match(rescue,/const countryParam=u\.searchParams\.get\('market'\)/);
  assert.match(rescue,/const topic=\['buying','coupon','price','trust'\]/);
  assert.match(rescue,/rescueIntentGroup\(item\.intent\)/);
  assert.match(rescue,/id="premium-blog-browser"/);
  assert.match(rescue,/x-robots-tag','noindex, follow'/);
});

test('article and blog cache revisions force new rescue markup after deploy',()=>{
  assert.match(cache,/r2-rescue-security-ga4-topic-links-v20/);
  assert.match(cache,/r2-blog-rescue-topic-filters-v18/);
});
