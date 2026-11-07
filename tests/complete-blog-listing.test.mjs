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
 assert.ok(env.calls.every(x=>x.limit<=80));
});
test('if 6 bounded market scans cannot fill a page, a cursor still allows forward progress',async()=>{
 const entries=Array.from({length:800},(_,i)=>({key:key(i,i<700?'SA':'AE')}));
 const env=mockEnv(entries);
 const result=await listFullBlogPublished(env,{market:'AE'});
 assert.equal(result.calls,6);
 assert.equal(result.rows.length,0);
 assert.equal(result.more,true);
 assert.equal(result.nextAfter,key(479,'SA'));
 const second=await listFullBlogPublished(env,{market:'AE',after:result.nextAfter});
 assert.equal(second.rows.length,15);
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
