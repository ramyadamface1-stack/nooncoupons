import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedEditorialModifiedAt,emergencyPublicR2Response,nativeBoundLegacyPublicFastResponse,unwrapLegacyArticleDocument,localizeLegacySiteNavigation} from '../r2-emergency-readonly.js';
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
test('migrated document shell is removed without losing the original article',()=>{
 const source='<!doctype html><html lang="ar"><head><title>Wrong old title</title>'+
  '<link rel="canonical" href="https://couponsnoon.com/old-article"><meta name="robots" content="noindex"></head>'+
  '<body><header>Old logo and navigation</header><main><article><h1>دليل شراء الجوالات</h1>'+
  '<p>نص مفيد عن المنتجات والتوصيل وكود NOV170.</p></article></main><footer>Old footer</footer></body></html>';
 const result=unwrapLegacyArticleDocument(source);
 assert.match(result,/<h1>دليل شراء الجوالات<\/h1>/);
 assert.match(result,/NOV170/);
 for(const tag of ['<!doctype','<html','<head','<body','<title','canonical','noindex','Old logo','Old footer'])
  assert.ok(!result.includes(tag),`obsolete shell should be removed: ${tag}`);
 assert.equal(unwrapLegacyArticleDocument('<article><h1>Preserve fragment</h1></article>'),'<article><h1>Preserve fragment</h1></article>');
});
test('old self-domain navigation returns to this site but official store links are unchanged',()=>{
 const markup='<a href="https://couponsnoon.com/">الرئيسية</a>'+
  '<a href="https://couponsnoon.com/saudi-arabia">السعودية</a>'+
  '<a href="https://www.couponsnoon.com/categories">التصنيفات</a>'+
  '<a href="https://couponsnoon.com/old-guide">المقال نفسه</a>'+
  '<a href="https://couponsnoon.com/other-article">مقال آخر غير مؤكد</a>'+
  '<a href="https://www.noon.com/saudi-ar/">متجر نون</a>';
 const localized=localizeLegacySiteNavigation(markup,'old-guide','SA');
 assert.match(localized,/href="\/">الرئيسية/);
 assert.match(localized,/href="\/saudi">السعودية/);
 assert.match(localized,/href="\/saudi\/categories">التصنيفات/);
 assert.match(localized,/href="\/articles\/old-guide">المقال نفسه/);
 assert.match(localized,/href="https:\/\/couponsnoon.com\/other-article"/,'unverified source path must not be guessed');
 assert.match(localized,/href="https:\/\/www.noon.com\/saudi-ar\/"/);
});
test('full archived document becomes one canonical page with functional coupon controls',async()=>{
 const source='<!doctype html><html><head><title>Old document</title>'+
  '<link rel="canonical" href="https://couponsnoon.com/old-embedded-guide"></head><body>'+
  '<header>old site header</header><main><article><h1>نون السعودية دليل شراء</h1>'+
  '<p>نص المقال الأصلي، ومقارنة الشحن والبائع، واستخدام الكود NOV170 قبل الشراء.</p>'+
  '<a href="https://couponsnoon.com/categories">الأقسام</a></article></main></body></html>';
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{async get(key){return key==='articles/old-embedded-guide.html'?{
  text:async()=>source,customMetadata:{status:'published',c:'SA',at:published}
 }:null}}};
 const res=await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com/articles/old-embedded-guide'),env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.equal((html.match(/<html\b/gi)||[]).length,1);
 assert.equal((html.match(/<head\b/gi)||[]).length,1);
 assert.equal((html.match(/<title\b/gi)||[]).length,1);
 assert.equal((html.match(/rel="canonical"/gi)||[]).length,1);
 assert.match(html,/href="https:\/\/noondealsnow.com\/articles\/old-embedded-guide"/);
 assert.match(html,/href="\/saudi\/categories"/);
 assert.match(html,/href="\/blog\/archive"/,'use the working archive route');
 assert.doesNotMatch(html,/href="\/blog\/archive\/catalog"/,'do not link customers to an observed 404');
 assert.match(html,/data-rescue-copy="NOV170"/);
 assert.doesNotMatch(html,/couponsnoon\.com/);
 assert.match(html,/نص المقال الأصلي/);
});
test('public archive menus do not advertise the currently unavailable catalog paths',()=>{
 const source=readFileSync(new URL('../r2-emergency-readonly.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/<a href="\/blog\/archive\/(?:english\/)?catalog(?:"|\/)/,
   'avoid dead live links in article and archive navigation');
 assert.match(source,/<a href="\/blog\/archive">/);
 assert.match(source,/<a href="\/blog\/archive\/english">/);
});
