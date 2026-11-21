import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedEditorialModifiedAt,emergencyPublicR2Response,nativeBoundLegacyPublicFastResponse,unwrapLegacyArticleDocument,localizeLegacySiteNavigation,tidyLegacyArabicH1,legacyDirectAnswerSnippet} from '../r2-emergency-readonly.js';
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

test('legacy Arabic UAE titles, intro and FAQ schema say نون الإمارات without altering URLs or stored R2',async()=>{
 const slug='american-tourister-arabic-uae-legacy';
 const src='<article><p>مقارنة حقائب السفر في نون uae مع مراجعة الشحن.</p>'+
  '<h1>American Tourister Backpacks السعر النهائي على نون uae</h1>'+
  '<p>قارن حقائب السفر بين البائعين في نون uae. جرّب NOV188 في السلة قبل الدفع.</p>'+
  '<a href="https://noondealsnow.com/uae">نون uae</a>'+
  '<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',
   mainEntity:[{'@type':'Question',name:'ما شروط نون uae؟',acceptedAnswer:{'@type':'Answer',text:'راجع سلة نون uae.'}}]})+'</script>'+
  '</article>';
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{async get(key){
  return key==='articles/'+slug+'.html'?{text:async()=>src,customMetadata:{status:'published',c:'AE',at:'2026-10-14T06:32:32.875Z'}}:null;
 }}};
 const u='https://noondealsnow.com/articles/'+slug;
 const res=await nativeBoundLegacyPublicFastResponse(new Request(u),env);
 assert.equal(res?.status,200);
 const html=await res.text();
 assert.match(html,/<h1>American Tourister Backpacks السعر النهائي على نون الإمارات<\/h1>/);
 assert.match(html,/<title>American Tourister Backpacks السعر النهائي على نون الإمارات/);
 assert.match(html,/<meta name="description" content="[^"]*نون الإمارات/);
 assert.match(html,/href="https:\/\/noondealsnow.com\/uae">نون الإمارات<\/a>/);
 assert.doesNotMatch(html,/نون uae/i);
 assert.match(html,/rel="canonical" href="https:\/\/noondealsnow.com\/articles\/american-tourister-arabic-uae-legacy"/);
 assert.match(html,/data-rescue-copy="NOV188"/);
 const schemas=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>JSON.parse(m[1]));
 const article=schemas.find(x=>x['@type']==='Article');
 const faq=schemas.find(x=>x['@type']==='FAQPage');
 assert.ok(article&&faq);
 assert.match(article.headline,/نون الإمارات/);
 assert.match(faq.mainEntity[0].name,/نون الإمارات/);
 assert.match(faq.mainEntity[0].acceptedAnswer.text,/نون الإمارات/);
 assert.equal(src.includes('نون uae'),true,'original source stays unmodified');
});


test('legacy Arabic headline ending in dangling مع is cleaned only in the visible H1',()=>{
 const text='<article><h1>American Tourister Backpacks السعر النهائي بعد تجربة الكود نون الإمارات مع </h1>'+
   '<p>المقارنة مع البائع والشحن قبل الدفع.</p><h2>طريقة الشراء مع التأكد من الشحن</h2></article>';
 const result=tidyLegacyArabicH1(text,false);
 assert.match(result,/<h1>American Tourister Backpacks السعر النهائي بعد تجربة الكود نون الإمارات<\/h1>/);
 assert.match(result,/<h2>طريقة الشراء مع التأكد من الشحن<\/h2>/);
 assert.equal(tidyLegacyArabicH1(result,false),result,'idempotent');
 assert.equal(tidyLegacyArabicH1(text,true),text,'English content must never change');
 assert.equal(tidyLegacyArabicH1('<h1>تجربة الكود مع نون الإمارات</h1>',false),'<h1>تجربة الكود مع نون الإمارات</h1>');
});

test('archived Arabic UAE page uses nonduplicative buyer-focused snippet and consistent original schema without mutating R2',async()=>{
 const slug='american-tourister-backpacks-final-price-legacy-audit';
 const oldHeading='American Tourister Backpacks السعر النهائي بعد تجربة الكود نون uae مع ';
 const raw='<article lang="ar-AE"><p class="eyebrow">مقارنة سعر · نون uae · American Tourister Backpacks السعر النهائي بعد تجربة الكود</p>'+
   '<h1>'+oldHeading+'</h1>'+
   '<p class="direct-answer"><strong>الخلاصة العملية:</strong> إذا كان بحثك هو «American Tourister Backpacks السعر النهائي بعد تجربة الكود نون الإمارات»، فابدأ بمراجعة المواصفات والبائع والشحن. وفي هذا الدليل نركز على الاختيار المناسب قبل الدفع. جرّب NOV188 على سلة ثابتة في نون uae، واجعل الإجمالي النهائي هو المرجع بدل أي نسبة خصم غير موثقة.</p>'+
   '<h2>مقارنة بديلين على أساس واحد</h2><p>كوّن جدول مقارنة بين بديلين من حيث البائع والشحن والإرجاع.</p>'+
   '<a href="https://noondealsnow.com/categories">التصنيفات</a>'+
   '<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:[{'@type':'Question',name:'كيف أختبر NOV188 على نون uae؟',acceptedAnswer:{'@type':'Answer',text:'راجع سلة نون uae.'}}]})+'</script></article>';
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{async get(key){
   return key==='articles/'+slug+'.html'?{text:async()=>raw,
     customMetadata:{status:'published',c:'AE',at:'2026-10-14T06:32:32.875Z'}}:null;
 }}};
 const u='https://noondealsnow.com/articles/'+slug;
 const result=await nativeBoundLegacyPublicFastResponse(new Request(u),env);
 assert.equal(result.status,200);
 const html=await result.text();
 const title='American Tourister Backpacks السعر النهائي بعد تجربة الكود نون الإمارات';
 assert.ok(html.includes('<h1>'+title+'</h1>'),'visible H1 ends on a complete term');
 assert.ok(html.includes('<title>'+title+' | كوبونات نون</title>'),'title matches cleaned H1');
 const snippet=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
 assert.ok(snippet,'meta description exists');
 assert.ok(snippet.startsWith(title+' — جرّب NOV188'),'snippet uses a source-backed checkout sentence');
 assert.equal((snippet.match(/American Tourister Backpacks/g)||[]).length,1,'no repeated keyword block');
 assert.ok(!snippet.endsWith('مع')&&!snippet.endsWith('الد'),'snippet must not end on dangling connector');
 assert.ok(html.includes('<meta property="og:description" content="'+snippet+'">'));
 const json=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m=>JSON.parse(m[1]));
 const article=json.find(x=>x['@type']==='Article'),faq=json.find(x=>x['@type']==='FAQPage');
 assert.equal(article.headline,title);
 assert.equal(article.description,snippet);
 assert.equal(article.mainEntityOfPage,u);
 assert.ok(faq.mainEntity[0].name.includes('نون الإمارات'));
 assert.ok(html.includes('href="https://noondealsnow.com/categories"'),'working category URL remains unchanged');
 assert.ok(html.includes('data-rescue-copy="NOV188"'));
 assert.ok(html.includes('datePublished'));
 assert.ok(raw.includes('نون uae مع'),'original R2 article body remains intact');
});

test('snippet enhancement uses only existing direct answers and leaves unrelated archive formats alone',()=>{
 const heading='كود نون الإمارات للحقائب والمنتجات';
 const archived='<p>تصفح المقارنة واتبع دليل الشراء.</p><h1>'+heading+'</h1>';
 assert.equal(legacyDirectAnswerSnippet(archived,heading,false),null);
 assert.equal(legacyDirectAnswerSnippet(
  '<p class="direct-answer">يجب أن تتأكد من البائع بدون ادعاء خصم معين.</p>',heading,false),null);
});


test('SEO snippet keeps the buyer guidance as a complete sentence after removing the old repetitive disclaimer',()=>{
 const title='American Tourister Backpacks السعر النهائي بعد تجربة الكود نون الإمارات';
 const checkout='جرّب NOV188 على سلة ثابتة في نون الإمارات، واجعل الإجمالي النهائي هو المرجع بدل أي ادعاء غير موثق عن نسبة الخصم.';
 const html='<article><h1>'+title+'</h1><p class="direct-answer"><strong>الخلاصة العملية:</strong> إذا كان بحثك عن الحقائب، راجع البائع أولًا. '+checkout+'</p></article>';
 const snippet=legacyDirectAnswerSnippet(html,title,false);
 const expected=title+' — جرّب NOV188 على سلة ثابتة في نون الإمارات، واجعل الإجمالي النهائي هو المرجع.';
 assert.equal(snippet,expected);
 assert.ok(snippet.length<=170,'Google snippet remains concise');
 assert.ok(snippet.endsWith('المرجع.'),'no trailing fragment');
 assert.ok(!snippet.includes('…')&&!snippet.includes('ادعاء'),'no clipped disclaimer');
 assert.equal((snippet.match(/American Tourister Backpacks/g)||[]).length,1);
});


test('legacy Nintendo Switch 2 English article uses its true checkout answer instead of duplicated clipped metadata',async()=>{
 const slug='en-noon-uae-final-price-guide-nintendo-switch-2-coupon-eligibility';
 const u='https://noondealsnow.com/en/articles/'+slug;
 const heading='Noon UAE final price guide Nintendo Switch 2 coupon eligibility';
 const expected='Nintendo Switch 2 on Noon UAE — Start with a stable cart, copy NOV188, and use the final Noon checkout total as the reference.';
 const faq={'@context':'https://schema.org','@type':'FAQPage',mainEntity:[{
   '@type':'Question',name:'Can NOV188 be tested on Noon UAE?',acceptedAnswer:{'@type':'Answer',text:'Use the actual Noon UAE checkout.'}
 }]};
 const source='<article lang="en" data-market="AE"><p class="eyebrow">Noon UAE · gaming consoles</p>'+
  '<h1>'+heading+'</h1>'+
  '<p class="direct-answer"><strong>Quick answer:</strong> Start with a stable cart, copy NOV188, and use the final Noon checkout total as the reference instead of assuming a fixed discount.</p>'+
  '<h2>Value analysis</h2><p>Compare the exact console model and seller before checking the final cart.</p>'+
  '<script type="application/ld+json">'+JSON.stringify(faq)+'</script></article>';
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{
   async get(key){return key==='articles/'+slug+'.html'?{
     text:async()=>source,customMetadata:{status:'published',c:'AE',at:'2026-10-24T17:45:00Z'}
   }:null}
 }};
 const page=await nativeBoundLegacyPublicFastResponse(new Request(u),env);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.match(html,new RegExp('<h1>'+heading+'</h1>'));
 assert.ok(html.includes('<meta name="description" content="'+expected+'">'));
 assert.ok(html.includes('<meta property="og:description" content="'+expected+'">'));
 const schemas=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(x=>JSON.parse(x[1]));
 assert.equal(schemas.filter(x=>x['@type']==='Article').length,1);
 assert.equal(schemas.find(x=>x['@type']==='Article').description,expected);
 assert.deepEqual(schemas.find(x=>x['@type']==='FAQPage'),faq);
 assert.ok(html.includes('<link rel="canonical" href="'+u+'">'));
 assert.ok(html.includes('data-rescue-copy="NOV188"'));
 assert.match(html,/<html lang="en-AE" dir="ltr"/);
 assert.equal(source.includes('instead of assuming a fixed discount.'),true,'original stored English article unchanged');
});
