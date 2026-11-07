import test from 'node:test';
import assert from 'node:assert/strict';
import {completeBlogResponse,listFullBlogPublished} from '../complete-blog-listing.js';

function mockEnv(entries){
 const sorted=[...entries].sort((a,b)=>a.key.localeCompare(b.key,'en'));
 const calls=[];
 return {calls,CONTENT_FINAL:{
  async list(options){
   calls.push({...options});
   const start=options.startAfter?sorted.findIndex(x=>x.key===options.startAfter)+1:0;
   const idx=options.startAfter&&start===0?sorted.findIndex(x=>x.key>options.startAfter):start;
   const base=Math.max(0,idx);
   const objects=sorted.slice(base,base+options.limit);
   return {objects,truncated:base+options.limit<sorted.length,cursor:null};
  },
  async get(key){
   if(key==='_ops/article-count.json')return {json:async()=>({count:133746,countedAt:'2026-09-28T21:39:16Z'})};
   if(key==='blog/latest-live-v1.json')return {json:async()=>({articles:[
    {slug:'newest-noon-uae-today',title:'Newest verified published guide',status:'published'}
   ]})};
   return null;
  }
 }};
}
const key=(i,market='SA')=>'articles/'+String(i).padStart(3,'0')+'-'+(market==='AE'?'uae':'saudi')+'-article.html';
const rows=n=>Array.from({length:n},(_,i)=>({key:key(i,i%2?'AE':'SA'),size:900,customMetadata:{status:'published'}}));
const go=(env,part='/blog')=>completeBlogResponse(env,new URL('https://noondealsnow.com'+part));
function urls(html){return [...html.matchAll(/<article class="article-card"[^>]*>[\s\S]*?<h2><a href="([^"]+)"/g)].map(m=>m[1])}
function more(html){const m=html.match(/href="([^"]+)"[^>]*>المقالات التالية/);return m?.[1]?.replace(/&amp;/g,'&')||null}
test('blog default exposes real corpus count, 15 articles and latest editorial shortcuts',async()=>{
 const env=mockEnv(rows(47));
 const page=await go(env);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.match(html,/١٣٣٬٧٤٦/);
 assert.match(html,/Newest verified published guide/);
 assert.equal(urls(html).length,15);
 assert.equal(env.calls[0].limit,16);
 assert.match(html,/canonical" href="https:\/\/noondealsnow.com\/blog"/);
 assert.equal(page.headers.get('x-full-blog-r2'),'read-only-cursor-v1');
});
test('cursor pagination visits every R2 HTML object exactly once without a 4149 cap',async()=>{
 const env=mockEnv(rows(47));
 let next='/blog',collected=[],pages=0;
 while(next){
   const res=await go(env,next),html=await res.text();
   collected.push(...urls(html));
   pages++;
   next=more(html);
   assert.ok(pages<10,'no infinite pagination');
 }
 assert.equal(pages,4);
 assert.equal(collected.length,47);
 assert.equal(new Set(collected).size,47);
 assert.equal(collected[0],'/articles/000-saudi-article');
 assert.equal(collected.at(-1),'/articles/046-saudi-article');
});
test('direct list skips non-published metadata without hiding later published articles',async()=>{
 const all=rows(36);
 all[2].customMetadata.status='draft';
 all[8].customMetadata.status='scheduled';
 const env=mockEnv(all),found=[];
 let next='/blog',tries=0;
 while(next&&tries++<8){
  const h=await (await go(env,next)).text();
  found.push(...urls(h));next=more(h);
 }
 assert.equal(found.length,34);
 assert.ok(!found.some(u=>u.endsWith('002-saudi-article')||u.endsWith('008-saudi-article')));
 assert.equal(new Set(found).size,34);
});
test('country pages scan bounded windows and preserve all Saudi and UAE articles',async()=>{
 const env=mockEnv(rows(70));
 for(const [path,country] of [['/blog/saudi','saudi'],['/blog/uae','uae']]){
  let next=path,collected=[],pages=0;
  while(next&&pages++<8){
   const h=await (await go(env,next)).text();collected.push(...urls(h));next=more(h);
  }
  assert.equal(collected.length,35);
  assert.ok(collected.every(u=>u.includes(country)));
  assert.equal(new Set(collected).size,collected.length);
 }
 assert.ok(env.calls.every(x=>x.limit<=256));
});
test('bounded country scan never drops 4000 consecutive out-of-market objects',async()=>{
 const entries=Array.from({length:5100},(_,i)=>({
   key:'articles/'+String(i).padStart(5,'0')+'-'+(i<4600?'saudi':'uae')+'-article.html',
   customMetadata:{status:'published'}
 }));
 const env=mockEnv(entries);
 const result=await listFullBlogPublished(env,{market:'AE'});
 assert.equal(result.calls,16);
 assert.equal(result.rows.length,0);
 assert.equal(result.more,true);
 assert.equal(result.nextAfter,'articles/04095-saudi-article.html');
 const second=await listFullBlogPublished(env,{market:'AE',after:result.nextAfter});
 assert.equal(second.rows.length,15);
 assert.ok(second.rows.every(r=>r.country==='AE'));
});
test('invalid cursor and broken listing fail safely without claiming no articles',async()=>{
 const env=mockEnv(rows(12));
 const bad=await go(env,'/blog?after=private%2Fsecret.json');
 assert.equal(bad.status,400);
 assert.equal(env.calls.length,0);
 const fail={CONTENT_FINAL:{list:async()=>{throw Error('private storage unavailable')},get:async()=>null}};
 const res=await go(fail);
 assert.equal(res.status,503);
 assert.match(await res.text(),/temporarily unavailable/);
});
test('no bucket/list uses legacy rescue, and empty real bucket has no next link',async()=>{
 const noList=await go({CONTENT_FINAL:{get:async()=>null}});
 assert.equal(noList,null);
 const res=await go(mockEnv([]));assert.equal(res.status,200);
 assert.equal(more(await res.text()),null);
});

test('unusual legacy punctuation remains reachable through HTML and next cursor safely',async()=>{
 const env=mockEnv([
  {key:"articles/000-abc'<tag>.html",customMetadata:{status:'published'}},
  {key:"articles/001-abc&weird?#.html",customMetadata:{status:'published'}}
 ]);
 const html=await (await go(env)).text();
 assert.equal(urls(html).length,2);
 assert.match(html,/\/articles\/000-abc/);
 assert.ok(!html.includes("<tag>.html"));
 assert.ok(html.includes('%3Ctag%3E'),'HTML-sensitive filename must be encoded');
 assert.ok(html.includes('%3F%23'),'query and fragment characters are encoded');
});
test('actual emergency rescue route uses complete blog when R2 LIST exists',async()=>{
 const {emergencyPublicR2Response}=await import('../r2-emergency-readonly.js');
 const e=mockEnv(rows(36));
 const res=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog'),{
  ...e,R2_RESCUE_READONLY_ENABLED:'true'
 });
 assert.equal(res.status,200);
 assert.equal(res.headers.get('x-full-blog-r2'),'read-only-cursor-v1');
 assert.equal(urls(await res.text()).length,15);
 const old=await emergencyPublicR2Response(new Request('https://noondealsnow.com/blog?page=2'),{
  ...e,R2_RESCUE_READONLY_ENABLED:'true'
 });
 assert.equal(old.status,200);
 assert.equal(old.headers.get('x-full-blog-r2'),null,'numeric legacy URLs keep their historical behavior');
});

test('published noindex page remains visible while unpublished drafts stay private',async()=>{
 const e=mockEnv([
   {key:'articles/000-noindex-saudi.html',customMetadata:{status:'published',indexable:'false'}},
   {key:'articles/001-draft-saudi.html',customMetadata:{status:'draft'}}
 ]);
 const html=await (await go(e)).text();
 assert.equal(urls(html).length,1);
 assert.match(html,/000-noindex-saudi/);
 assert.ok(!html.includes('001-draft-saudi'));
});

test('R2 directory survives non-HTML keys between published article files',async()=>{
 const mixed=[...Array.from({length:97},(_,i)=>({key:'articles/'+String(i).padStart(3,'0')+'.json'})),
   ...Array.from({length:18},(_,i)=>({key:'articles/'+String(i+200).padStart(3,'0')+'-saudi-article.html',customMetadata:{status:'published'}}))];
 const env=mockEnv(mixed);
 let url='/blog',found=[],emptyPages=0,tries=0;
 while(url&&tries++<7){
   const res=await go(env,url);
   assert.equal(res.status,200);
   const html=await res.text(),items=urls(html);
   if(!items.length)emptyPages++;
   found.push(...items);url=more(html);
 }
 assert.ok(emptyPages>=1);
 assert.equal(found.length,18);
 assert.equal(new Set(found).size,18);
 assert.equal(url,null);
});
test('unpublished and case-variant published R2 metadata are handled consistently',async()=>{
 const env=mockEnv([
  {key:'articles/001-saudi-a.html',customMetadata:{status:'PUBLISHED'}},
  {key:'articles/002-saudi-b.html',customMetadata:{status:'scheduled'}},
  {key:'articles/003-saudi-c.html',customMetadata:{status:'draft'}}
 ]);
 const html=await (await go(env)).text();
 assert.equal(urls(html).length,1);
 assert.match(html,/001-saudi-a/);
 assert.ok(!html.includes('002-saudi-b')&&!html.includes('003-saudi-c'));
});
