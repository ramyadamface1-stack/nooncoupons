import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';

test('static blog uses published R2 articles, not the stale 8-guide template',()=>{
 const a=JSON.parse(readFileSync('.ndn-blog-staging/public-snapshot.json','utf8'));
 assert.ok(a.objects['_ops/ai-v2-publication-ledger-v1.json'].articles.length>30);
 const cached=new Set(a.cachedArticleSlugs);
 for(const path of ['blog','blog/saudi','blog/uae']){
  const html=readFileSync('.ndn-static-assets/'+path+'.html','utf8');
  assert.ok(html.includes('data-blog-premium="v1"'),path);
  assert.ok(html.includes('href="/golden-keywords"'),path);
  assert.equal((html.match(/aria-label="Quick shopping navigation"/g)||[]).length,0,'duplicate header '+path);
  assert.match(html,/<meta name="ndn-verified-r2-article-listing" content="v2">/);
  assert.match(html,/<meta name="robots" content="index,follow,max-image-preview:large">/);
  const cards=[...html.matchAll(/<article class="card[^"]*">/g)];
  const slugs=[...new Set([...html.matchAll(/href="\/articles\/([a-z0-9-]{16,120})"/g)].map(x=>x[1]))];
  assert.equal(cards.length,15,path);
  assert.equal(slugs.length,15,path);
  for(const slug of slugs){
   assert.ok(cached.has(slug),slug);
   const article=readFileSync('.ndn-static-assets/articles/'+slug+'.html','utf8');
   assert.ok(article.includes('https://noondealsnow.com/articles/'+slug));
  }
  assert.ok(html.includes('<link rel="canonical" href="https://noondealsnow.com/'+path+'"'));
  if(path==='blog/saudi')assert.ok(html.includes('مدونة نون السعودية'));
  if(path==='blog/uae')assert.ok(html.includes('مدونة نون الإمارات'));
 }
 const home=readFileSync('.ndn-static-assets/index.html','utf8');
 assert.ok(home.includes('id="latest-published-articles"'));
 assert.ok(home.includes('href="/articles/'));
 assert.equal(existsSync('.ndn-static-assets/api/health.html'),false);
 assert.equal(existsSync('.ndn-static-assets/admin.html'),false);
 assert.ok(readdirSync('.ndn-static-assets/articles').length>=24);
});
