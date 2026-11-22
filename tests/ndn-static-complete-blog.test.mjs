import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root='.ndn-static-assets';
const audit=JSON.parse(readFileSync('.ndn-blog-staging/asset-audit.json','utf8'));
test('every physically verified published R2 article is listed exactly once per market',()=>{
 const snap=JSON.parse(readFileSync('.ndn-blog-staging/public-snapshot.json','utf8'));
 assert.equal(audit.published,snap.verifiedArticleSlugs.length);
 assert.equal(audit.images,audit.published);
 const counts={ALL:new Set(),SA:new Set(),AE:new Set()};
 const route=n=>n===1?'/blog':'/blog/page/'+n;
 for(const [base,country] of [['/blog','ALL'],['/blog/saudi','SA'],['/blog/uae','AE']]){
   const pages=audit.pageCounts[base];assert.ok(pages>0);
   for(let n=1;n<=pages;n++){
     const path=n===1?base:base+'/page/'+n;
     const html=readFileSync(root+path+'.html','utf8');
     assert.ok(html.includes('<link rel="canonical" href="https://noondealsnow.com'+path+'">'),path);
     assert.ok(html.includes('ndn-verified-r2-article-listing'),path);
     assert.ok(html.includes('data-blog-premium="v1"'),path);
     assert.equal((html.match(/class="blogHeroAside"/g)||[]).length,1,'balanced hero missing '+path);
     assert.equal((html.match(/aria-label="Quick shopping navigation"/g)||[]).length,0,'duplicate navbar '+path);
     assert.equal((html.match(/class="cardTopic"/g)||[]).length,Math.min(15,audit.markets[base]-(n-1)*15),path);
     const slugs=[...html.matchAll(/href="\/articles\/([^"]+)"/g)].map(x=>decodeURIComponent(x[1]));
     assert.equal(slugs.length,3*Math.min(15,audit.markets[base]-(n-1)*15),path);
     const uniq=new Set(slugs);
     assert.equal(uniq.size,Math.min(15,audit.markets[base]-(n-1)*15),path);
     for(const slug of uniq){
       assert.ok(!counts[country].has(slug),'duplicate '+slug+' '+base);
       counts[country].add(slug);
       const svg=readFileSync(root+'/assets/coupon-svg/'+slug+'/1.svg','utf8');
       assert.ok(svg.includes('<svg')&&svg.includes('</svg>'));
       assert.ok(svg.includes('data-noon-cover="coupon-first-v12"'),slug);
       assert.ok(svg.includes('font-size="136"'),slug);
     }
     assert.ok(!html.includes('href="/blog?page='),'query_only_pagination_link '+path);
   }
   assert.equal(counts[country].size,audit.markets[base],base);
 }
 assert.equal(counts.ALL.size,audit.published);
 for(const slug of counts.SA)assert.ok(counts.ALL.has(slug));
 for(const slug of counts.AE)assert.ok(counts.ALL.has(slug));
 assert.equal(counts.SA.size+counts.AE.size,counts.ALL.size);
 assert.equal(existsSync(root+'/admin.html'),false);
});
