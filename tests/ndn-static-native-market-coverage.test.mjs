import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
const root='.ndn-static-assets';
const snapshot=JSON.parse(readFileSync('.ndn-blog-staging/public-snapshot.json','utf8'));
const ledger=snapshot.objects['_ops/ai-v2-publication-ledger-v1.json'].articles;
const cached=new Set(snapshot.cachedArticleSlugs);
const counts={SA:0,AE:0};
const four=[
 'saudi-buyer-baseus-powerbank-multiport-power-budget-sharing-nov170-2026-n6',
 'uae-buyer-baseus-powerbank-multiport-power-budget-sharing-nov188-2026-n6',
 'saudi-buyer-hp-laptop-ssd-replacement-panel-access-nov170-2026-n10',
 'uae-buyer-xiaomi-phone-nfc-wallet-regional-compatibility-nov188-2026-n10'
];
test('static market article coverage expands without changing native R2 source or private routes',()=>{
 assert.ok(cached.size>=760,'CACHED_NATIVE_ARTICLES_UNDER_760 '+cached.size);
 assert.equal(cached.size,snapshot.cachedArticleSlugs.length,'DUPLICATE_CACHED_SLUGS');
 const original=new Map(ledger.map(a=>[a.slug,a]));
 for(const slug of cached){
  const a=original.get(slug);
  assert.ok(a,'not a ledger published native article '+slug);
  assert.ok(a.country==='SA'||a.country==='AE','invalid market '+slug);
  counts[a.country]++;
  assert.ok(existsSync(root+'/articles/'+slug+'.html'),slug);
 }
 assert.ok(counts.SA>=380,'SA coverage '+counts.SA);
 assert.ok(counts.AE>=380,'AE coverage '+counts.AE);
 for(const slug of four){
  assert.ok(cached.has(slug),'priority recovery missing '+slug);
  const html=readFileSync(root+'/articles/'+slug+'.html','utf8');
  assert.ok(html.includes('ndn-static-native-article'),slug);
  assert.ok(html.includes('<link rel="canonical" href="https://noondealsnow.com/articles/'+slug+'">'),slug);
  assert.ok(html.includes(slug.startsWith('saudi-')?'NOV170':'NOV188'),slug);
 }
 assert.ok(!existsSync(root+'/api/health.html')&&!existsSync(root+'/admin.html'));
 console.log('NATIVE_STATIC_MARKET_COVERAGE='+JSON.stringify({SA:counts.SA,AE:counts.AE,total:cached.size}));
});
