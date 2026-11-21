import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
test('full R2 HTML corpus has accessible canonical index pages for every saved article key',()=>{
 const a=JSON.parse(readFileSync('.ndn-blog-staging/full-r2-article-keys.json','utf8'));
 const b=JSON.parse(readFileSync('.ndn-blog-staging/full-archive-audit.json','utf8'));
 const expected=new Set(a.articleSlugs);
 assert.equal(expected.size,a.articleSlugs.length);
 assert.equal(b.archiveObjects,expected.size);
 assert.ok(b.archiveObjects>=150000);
 assert.ok(b.freeAssetFiles<20000);
 const found=new Set();
 for(let n=1;n<=b.archivePages;n++){
   const path=n===1?'/blog/archive/all':'/blog/archive/all/page/'+n;
   const html=readFileSync('.ndn-static-assets'+path+'.html','utf8');
   assert.ok(html.includes('href="https://noondealsnow.com'+path+'"'),path);
   assert.ok(html.includes('name="ndn-complete-r2-archive" content="v1"'),path);
   const links=[...html.matchAll(/<a href="\/(?:en\/)?articles\/([^"]+)" class="article-link"/g)].map(x=>decodeURIComponent(x[1]));
   assert.equal(links.length,Math.min(100,b.archiveObjects-(n-1)*100),path);
   for(const slug of links){
      assert.ok(expected.has(slug),slug);
      assert.ok(!found.has(slug),'DUPLICATE_ARCHIVE_LINK_'+slug);
      found.add(slug);
   }
 }
 assert.equal(found.size,expected.size,'NOT_ALL_ARCHIVE_LINKS_VISIBLE');
 assert.equal(existsSync('.ndn-static-assets/admin.html'),false);
});
