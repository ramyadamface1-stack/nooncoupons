import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedEditorialModifiedAt,emergencyPublicR2Response,nativeBoundLegacyPublicFastResponse} from '../r2-emergency-readonly.js';
import {readFileSync} from 'node:fs';

const published='2026-08-06T11:20:00.000Z';
test('old archive publication dates stay original while real edits may have dateModified',()=>{
 assert.equal(verifiedEditorialModifiedAt({editorialUpdatedAt:'2026-11-17T12:00:00Z'},published,new Date('2026-11-19T09:00:00Z')),'2026-11-17T12:00:00.000Z');
 assert.equal(verifiedEditorialModifiedAt({editorialUpdatedAt:'2026-12-04T00:00:00Z'},published,new Date('2026-11-19T09:00:00Z')),null,'never future-date already published content');
 assert.equal(verifiedEditorialModifiedAt({updatedAt:'2026-11-17T12:00:00Z'},published,new Date('2026-11-19T09:00:00Z')),null,'migration/storage touch is not an editorial update');
 assert.equal(verifiedEditorialModifiedAt({editorialUpdatedAt:'2026-08-01T00:00:00Z'},published,new Date('2026-11-19T09:00:00Z')),null);
});
test('legacy article rescue shows honest original timestamp and schema without invented update',async()=>{
 const article='<article><h1>اختيار حقيبة السفر من نون السعودية</h1><p>'+('قارن المقاس والخامة والضمان وحالة البائع قبل الدفع على نون السعودية. '.repeat(45))+'</p></article>';
 const env={R2_RESCUE_READONLY_ENABLED:'true',CONTENT_FINAL:{
  async get(key){if(key==='articles/old-luggage-guide.html')return {
   text:async()=>article,
   customMetadata:{status:'published',c:'SA',at:published}
  };return null;}
 }};
 const res=await emergencyPublicR2Response(new Request('https://noondealsnow.com/articles/old-luggage-guide'),env);
 assert.equal(res?.status,200);
 const html=await res.text();
 assert.match(html,/<time datetime="2026-08-06T11:20:00.000Z">/);
 assert.match(html,/"datePublished":"2026-08-06T11:20:00.000Z"/);
 assert.doesNotMatch(html,/"dateModified"/);
 assert.match(html,/rel="canonical" href="https:\/\/noondealsnow.com\/articles\/old-luggage-guide"/);
});
test('production read-only fast route bypasses the legacy decorators for archived articles and blog',async()=>{
 let reads=[],writes=0;
 const html='<article><h1>دليل كود نون السعودية للحقائب</h1><p>'+('قارن أسعار الحقائب والخامة والشحن والبائع والضمان على نون السعودية. '.repeat(40))+'</p></article>';
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{
   async get(key){reads.push(key);if(key==='articles/old-suitcase-review.html')return {
     text:async()=>html,customMetadata:{status:'published',c:'SA',at:published}
   };return null;},
   async list(){return {objects:[{key:'articles/old-suitcase-review.html',uploaded:new Date(published),customMetadata:{status:'published',c:'SA',at:published,t:encodeURIComponent('مراجعة حقائب نون السعودية')}}],truncated:false}},
   async put(){writes++;throw Error('public read only')}
 }};
 const req=new Request('https://noondealsnow.com/articles/old-suitcase-review');
 const page=await nativeBoundLegacyPublicFastResponse(req,env);
 assert.equal(page.status,200);
 assert.equal(page.headers.get('x-r2-public-fast-route'),'legacy-readonly-v1');
 assert.match(await page.text(),/"datePublished":"2026-08-06T11:20:00.000Z"/);
 const blog=await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com/blog'),env);
 assert.equal(blog.status,200);
 assert.match(await blog.text(),/old-suitcase-review/);
 assert.equal(writes,0);
 assert.ok(reads.includes('articles/old-suitcase-review.html'));
});
test('read-only fast path never exposes scheduled, missing, private or non-GET articles',async()=>{
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{async get(key){return key==='articles/draft.html'?{
   text:async()=>'<article><h1>Draft</h1></article>',customMetadata:{status:'scheduled',at:'2026-12-02T00:00:00Z'}
 }:null}}};
 for(const route of ['/articles/draft','/articles/missing']){
  const res=await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com'+route),env);
  assert.equal(res?.status,404);
 }
 const future={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{async get(){return {
  text:async()=>'<article><h1>December launch</h1></article>',
  customMetadata:{status:'published',c:'SA',at:'2026-12-05T08:00:00Z'}
 }}}};
 const notYet=await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com/articles/december-launch'),future);
 assert.equal(notYet.status,404,'future publication must remain hidden even when status is mistakenly published');
 for(const path of ['/admin','/api/revision','/','/articles/a/b'])
  assert.equal(await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com'+path),env),null);
 assert.equal(await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com/articles/draft',{method:'HEAD'}),env),null);
 assert.equal(await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com/articles/draft'),{...env,R2_RESCUE_READONLY_ENABLED:'true'}),null);
 const src=readFileSync(new URL('../discovery-entry.js',import.meta.url),'utf8');
 assert.ok(src.indexOf('nativeBoundLegacyPublicFastResponse(req,env)')<src.indexOf('let res=await app.fetch(req,env,ctx)'));
});
