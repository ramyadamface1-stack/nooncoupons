import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {establishedEditorialFamilies} from '../automation/ai-v2/topic-expansion.mjs';
import {eleventhEditorialTopicWave} from '../automation/ai-v2/topic-refresh-n11.mjs';
import {twelfthEditorialTopicWave,N12_TOPIC_CATALOG_VERSION,N12_EXPECTED_FAMILY_COUNT} from '../automation/ai-v2/topic-refresh-n12.mjs';

const code=readFileSync(new URL('../cloudflare-ai-direct/engine.mjs',import.meta.url),'utf8');
test('N12 replenishment keeps a genuinely new, bounded product-specific question inventory',()=>{
 assert.equal(N12_TOPIC_CATALOG_VERSION,'n12-original-buyer-questions-v1');
 assert.ok(N12_EXPECTED_FAMILY_COUNT>=40);
 assert.equal(twelfthEditorialTopicWave.length>=160,true,
  'fresh N12 corpus should not be a two-topic template');
 const baseline=new Set(eleventhEditorialTopicWave.map(row=>row.slug));
 const all=new Set();
 const byMarket={SA:0,AE:0},byFamily=new Map(),byAngle={q1:0,q2:0};
 for(const topic of twelfthEditorialTopicWave){
  assert.match(topic.slug,/^[a-z0-9-]{16,120}$/);
  assert.ok(!topic.slug.includes('--'),topic.slug);
  assert.match(topic.slug,/-2026-n12$/);
  assert.ok(!baseline.has(topic.slug),'append-only must never reuse historical N11 identity');
  assert.ok(!all.has(topic.slug),'N12 slugs must be unique: '+topic.slug);
  all.add(topic.slug);
  assert.ok(topic.topic.length>=28&&topic.topic.length<=72,topic.topic);
  assert.ok(topic.topic.includes(topic.brand),'brand included in actual question');
  assert.ok(topic.topic.includes(topic.country==='SA'?'نون السعودية NOV170':'Noon UAE NOV188'));
  assert.equal(topic.coupon,topic.country==='SA'?'NOV170':'NOV188');
  assert.equal(topic.language,topic.country==='SA'?'ar-SA':'en-AE');
  assert.ok(topic.queryModifier.length>=14);
  assert.equal(topic.sections.length,5);
  assert.ok(topic.comparisonKey.startsWith('editorial-n12-'));
  byMarket[topic.country]++;
  const family=topic.comparisonKey.slice('editorial-n12-'.length).replace(/-q[12]$/,'');
  byFamily.set(family,(byFamily.get(family)||0)+1);
  byAngle[topic.comparisonKey.endsWith('q1')?'q1':'q2']++;
 }
 assert.ok(byMarket.SA>=80&&byMarket.AE>=80);
 assert.ok(byFamily.size>=40,'protect sector and intent diversity');
 assert.ok(byAngle.q1>=80&&byAngle.q2>=80);
 assert.ok(establishedEditorialFamilies.length>=40);
});
test('Cloudflare direct generator uses separate N12 cursor, untouched N11 catalog and original audit',()=>{
 assert.match(code,/from '\.\.\/automation\/ai-v2\/topic-refresh-n12\.mjs'/);
 assert.match(code,/cursor-n12\//);
 assert.match(code,/freshByMarket=/);
 assert.match(code,/N12_TOPIC_CATALOG_VERSION/);
 assert.match(code,/topicWave==='N11'/);
 assert.match(code,/const checkpointKey=ROOT\+'checkpoint\/'\+topic\.slug\+'\.json'/);
 assert.match(code,/const published=await env\.CONTENT_FINAL\.head\('articles\/'\+candidate\.slug\+'\.html'\)/);
 assert.match(code,/const checkpoint=await env\.CONTENT_FINAL\.head\(ROOT\+'checkpoint\/'\+candidate\.slug\+'\.json'\)/);
 assert.match(code,/buildSaudiAiV2Article\(topic,sections\)/);
 assert.match(code,/buildEnglishAiV2Article\(topic,sections\)/);
 assert.match(code,/directTopicSpaceLength\(topics\)/);
 assert.match(code,/topicCatalog:'N12\+N11'/);
 assert.doesNotMatch(code,/api\.github\.com|actions\/workflows|GITHUB_DISPATCH_TOKEN/);
});
test('public health separates scheduler configured from verified publication progress',()=>{
 assert.match(code,/publishingHealthy/);
 assert.match(code,/minutesSinceLastVerifiedPublish/);
 assert.match(code,/PUBLISHING_STALLED/);
 assert.match(code,/LIVE_PUBLICATION_RECENT/);
 assert.match(code,/last-live-verification\.json/);
});
