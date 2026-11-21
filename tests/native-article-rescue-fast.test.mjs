import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderApprovedNativeAiV2Fast,rescueGscSnippet,refreshArtworkUrlsInHtml,neutralizeUnverifiedEditorialReview,repairArchivedProductCategoryHtml,supplementNativeArticleJsonLd,decodeNativeMetadataText,articleJsonLdDescription,nativeMetaDescription,nativeCompleteSearchSnippet} from '../r2-emergency-readonly.js';
const url=new URL('https://noondealsnow.com/articles/saudi-buyer-samsung-tablet-offline-annotation-workflow-nov170-2026-n5');
const source='<article><h1>جدول مقارنة سامسونج تابلت</h1><p>'+('معايير مقارنة الكود NOV170 والمواصفات والضمان وشروط نون السعودية. '.repeat(110))+'</p></article>';
const item={body:source,meta:{status:'published',p:'ai-v2-native',c:'SA',cp:'NOV170',q:'100',w:'1775',
  t:encodeURIComponent('دليل مقارنة تابلت سامسونج نون السعودية NOV170'),
  m:encodeURIComponent('دليل عملي للتحقق من التوافق والضمان والشحن والأهلية في سلة نون السعودية قبل الدفع.')}};
test('already approved native article has bounded public rendering without rewriting original source or dropping coupon',async()=>{
 const r=renderApprovedNativeAiV2Fast(item,url.pathname.split('/').pop(),url,false);
 assert.equal(r?.status,200);
 assert.equal(r.headers.get('x-native-article-renderer'),'approved-fast-v1');
 const html=await r.text();
 assert.ok(html.includes(source),'keep approved article bytes');
 assert.ok(html.includes('NOV170'));
 assert.ok(html.includes('rel="canonical"'));
 assert.ok(html.includes('article-topic-path'));
 assert.ok(html.includes('index,follow'));
});
test('only actual native QA-approved, country-matched originals take fast route',()=>{
 for(const patch of [
  {status:'scheduled'},{p:'legacy-bulk'},{q:'94'},{w:'1499'},
  {cp:'NOV188'},{c:'AE'}
 ]){
  const r=renderApprovedNativeAiV2Fast({...item,meta:{...item.meta,...patch}},
   url.pathname.split('/').pop(),url,false);
  assert.equal(r,null,JSON.stringify(patch));
 }
 assert.equal(renderApprovedNativeAiV2Fast({...item,body:'<article>no coupon</article>'},
  'bad',url,false),null);
});
test('legacy article fast-path rejection does not read or transform its large HTML body',()=>{
 const legacy={meta:{p:'legacy-bulk',status:'published',c:'SA',cp:'NOV170',q:'100',w:'1750'}};
 Object.defineProperty(legacy,'body',{get(){throw new Error('legacy body must never be read during native eligibility check')}});
 assert.equal(renderApprovedNativeAiV2Fast(legacy,'original-legacy-slug',url,false),null);
 const nativeScheduled={meta:{...item.meta,status:'scheduled'}};
 Object.defineProperty(nativeScheduled,'body',{get(){throw new Error('unpublished body must never be read')}});
 assert.equal(renderApprovedNativeAiV2Fast(nativeScheduled,'original-unpublished-slug',url,false),null);
});

test('AE approved native article uses cheap metadata-backed fast renderer and the market-approved code',async()=>{
 const u=new URL('https://noondealsnow.com/articles/uae-buyer-baseus-powerbank-long-storage-charge-care-nov188-2026-n6');
 const native='<article><h1>UAE comparison and shopping guide</h1><p>'+('Compare practical battery features and verify NOV188 at checkout. '.repeat(125))+'</p></article>';
 const itemAE={body:native,meta:{status:'published',p:'ai-v2-native',c:'AE',cp:'NOV188',q:'100',w:'1605',
   t:encodeURIComponent('Baseus battery storage guide | Noon UAE NOV188'),
   m:encodeURIComponent('A purchase decision guide covering practical battery features and seller verification for Noon UAE.')}};
 const response=renderApprovedNativeAiV2Fast(itemAE,u.pathname.split('/').at(-1),u,false);
 assert.equal(response?.status,200,'fast renderer must recognize real <article> and <h1> tags');
 assert.equal(response.headers.get('x-native-article-renderer'),'approved-fast-v1');
 const html=await response.text();
 assert.ok(html.includes(native),'Native original article bytes were altered');
 assert.ok(html.includes('NOV188'));
 assert.ok(html.includes('href="'+u.href+'"'));
 // The global site navigation may legitimately mention Saudi codes; assert
 // the actual article content and its primary market-specific CTA instead.
 assert.match(html, /<article class="rescue-article" data-market="AE">/);
 assert.ok(html.includes('NOV188'));
 assert.ok(!native.includes('NOV170'));

 assert.ok(!html.includes('Quality 100'),'No internal quality score in public HTML');
});
test('native fast eligibility correctly recognizes real HTML boundaries, not literal slash-b',()=>{
 const source=readFileSync(new URL('../r2-emergency-readonly.js',import.meta.url),'utf8');
 assert.ok(source.includes(String.raw`/<article\b/i.test(source)`));
 assert.ok(source.includes(String.raw`/<h1\b/i.test(source)`));
 assert.ok(!source.includes(String.raw`/<article\\b/i.test(source)`));
 assert.ok(!source.includes(String.raw`/<h1\\b/i.test(source)`));
});
test('high-impression Search Console pages get honest English snippet updates without changing slugs',async()=>{
 const slug='en-iphone-18-pro-max-noon-abu-dhabi-price';
 const u=new URL('https://noondealsnow.com/en/articles/'+slug);
 const original='<article><h1>iPhone 18 Pro Max Noon Abu Dhabi price</h1><p>'+('Compare the seller and final checkout total. NOV188. '.repeat(130))+'</p></article>';
 const record={body:original,meta:{status:'published',p:'ai-v2-native',c:'AE',cp:'NOV188',q:'99',w:'1775',
   t:encodeURIComponent('iPhone 18 Pro Max Noon Abu Dhabi price'),
   m:encodeURIComponent('A generic original shopping guide for this product on Noon UAE.')}};
 const response=renderApprovedNativeAiV2Fast(record,slug,u,true);
 assert.equal(response?.status,200);
 const html=await response.text();
 assert.match(html,/<title>iPhone 18 Pro Max in Abu Dhabi on Noon UAE \| Price Guide \| Noon Deals Now<\/title>/);
 assert.match(html,/<meta name="description" content="Compare iPhone 18 Pro Max listings/);
 assert.match(html,/rel="canonical" href="https:\/\/noondealsnow\.com\/en\/articles\/en-iphone-18-pro-max-noon-abu-dhabi-price"/);
 assert.ok(html.includes('href="/en/uae/noon-coupon-code"'),'English coupon guide must not lead to Arabic');
 assert.ok(html.includes('href="/en/uae/saving-guide"'),'English article must link to the real saving guide');
 assert.ok(html.includes('href="/en/uae"'),'English article must link to the country hub');
 assert.ok(html.includes('href="/blog/archive/english"'),'English archive remains available');
 assert.ok(!html.includes('href="/uae/noon-coupon-code"'),'no Arabic coupon landing from English article');
 assert.ok(!html.includes('href="/en/uae/categories"'),'never link to known 404');
 assert.match(html,/v=11&amp;country=AE&amp;coupon=NOV188/);
 assert.match(html,/width="1600" height="1000"/);
 assert.ok(html.includes(original),'R2 article body must not be rewritten');
 assert.equal(rescueGscSnippet('an-old-unchanged-page','Original','Existing',true).optimized,false);
 assert.equal(rescueGscSnippet(slug,'Original','Existing',false).optimized,false,'Saudi or Arabic fallback must not take English SEO snippets');
});
test('legacy image query versions are refreshed in HTML without altering article routes or coupons',()=>{
  const source='<img src="/assets/coupon-svg/saudi-guide/2.svg?v=9&amp;coupon=NOV170&amp;country=SA"><a href="/articles/saudi-guide">Read</a>';
  const html=refreshArtworkUrlsInHtml(source);
  assert.match(html,/\/2\.svg\?v=11&amp;coupon=NOV170/);
  assert.match(html,/href="\/articles\/saudi-guide"/);
  assert.ok(!html.includes('v=9'));
  assert.equal(refreshArtworkUrlsInHtml(html),html);
});

test('old generated editorial-review claims are replaced by accurate attribution without changing stored article bytes',async()=>{
  const original=source.replace('<article>','<article><p>Reviewed by Noon Deals Now Editorial Team · Published 02 Oct 2026</p>');
  const archived={...item,body:original};
  const res=renderApprovedNativeAiV2Fast(archived,url.pathname.split('/').pop(),url,false);
  assert.equal(res?.status,200);
  const html=await res.text();
  assert.match(html,/Noon Deals Now shopping guide · Published 02 Oct 2026/);
  assert.doesNotMatch(html,/Reviewed by Noon Deals Now Editorial Team/);
  assert.match(archived.body,/Reviewed by Noon Deals Now Editorial Team/,
    'stored source must never be mutated');
  assert.match(html,/NOV170/);
  assert.match(html,/rel="canonical"/);
  const other='Reviewed by an independent reviewer | https://noondealsnow.com/articles/existing';
  assert.equal(neutralizeUnverifiedEditorialReview(other),other);
  const file=readFileSync(new URL('../r2-emergency-readonly.js',import.meta.url),'utf8');
  assert.ok(file.includes('repairArchivedProductCategoryHtml(neutralizeUnverifiedEditorialReview(body),slug,english)'),
    'legacy fallback must also fix this unsupported claim');
});


test('archived console article gets gaming-console guidance without touching coupon, URL or stored R2',async()=>{
  const slug='en-nintendo-switch-2-noon-sharjah-budget-shopping-guide';
  const u=new URL('https://noondealsnow.com/en/articles/'+slug);
  const original='<article><h1>Nintendo Switch 2 Noon Sharjah budget shopping guide</h1>'+
    '<p>NoonCoupons treats coupon outcomes as variable checkout observations. NOV188</p>'+
    '<p>Noon UAE · laptops and computing</p>'+
    '<h2>Category baseline for laptops and computing</h2>'+
    '<p>For laptops and computing products, verify processor, memory and keyboard layout.</p>'+
    '<p>Computing value depends on the included charger and operating system.</p>'+
    '<h2>Category-specific checks for laptops and computing</h2>'+
    '<p>Check processor class and keyboard layout before paying.</p>'+
    '<p>Inspect operating system, charger and port configuration.</p>'+
    '<h2>UAE checkout evidence</h2><p>'+('Keep this Nintendo Switch 2 cart stable and verify NOV188 at checkout. '.repeat(130))+'</p></article>';
  const article={body:original,meta:{status:'published',p:'ai-v2-native',c:'AE',cp:'NOV188',q:'99',w:'1750',
    t:encodeURIComponent('Nintendo Switch 2 Noon Sharjah budget shopping guide'),
    m:encodeURIComponent('Compare Nintendo Switch 2 console bundle and UAE checkout conditions before purchase.')}};
  const res=renderApprovedNativeAiV2Fast(article,slug,u,true);
  assert.equal(res.status,200);
  const html=await res.text();
  assert.match(html,/Category baseline for gaming consoles/);
  assert.match(html,/Category-specific checks for gaming consoles/);
  assert.match(html,/included controllers and games/);
  assert.doesNotMatch(html,/laptops and computing|processor class|keyboard layout|operating system/);
  assert.match(html,/Noon Deals Now treats coupon outcomes/);
  assert.doesNotMatch(html,/NoonCoupons treats coupon outcomes/);
  assert.match(html,/NOV188/);
  assert.match(html,/rel="canonical" href="https:\/\/noondealsnow\.com\/en\/articles\/en-nintendo-switch-2-noon-sharjah-budget-shopping-guide"/);
  assert.equal(article.body,original,'R2 source body is unchanged');
  assert.equal(repairArchivedProductCategoryHtml(original,slug,false),original,'Arabic route is untouched');
  assert.equal(repairArchivedProductCategoryHtml(original,'en-nintendo-switch-2',true).includes('gaming consoles'),true);
  assert.equal(repairArchivedProductCategoryHtml(original,'en-ipad-price-uae',true),original,'non-console article is untouched');
  const good=original.replaceAll('laptops and computing','gaming consoles');
  assert.equal(repairArchivedProductCategoryHtml(good,slug,true),good,'already-correct category is untouched');
});

test('editorial publisher wording repair is narrowly scoped and idempotent',()=>{
  const input='<p>NoonCoupons treats coupon outcomes as variable checkout observations.</p>'+
    '<a href="https://nooncoupons.com/about">independent other website</a>';
  const once=neutralizeUnverifiedEditorialReview(input);
  assert.match(once,/Noon Deals Now treats coupon outcomes/);
  assert.match(once,/https:\/\/nooncoupons\.com\/about/);
  assert.equal(neutralizeUnverifiedEditorialReview(once),once);
});


test('native Arabic Article schema uses the same verified R2 publication date as its visible timestamp',async()=>{
 const published='2026-11-08T05:51:01.892Z';
 const slug='saudi-buyer-samsung-tablet-offline-annotation-workflow-nov170-2026-n5';
 const u=new URL('https://noondealsnow.com/articles/'+slug);
 const articleJson={'@context':'https://schema.org','@type':'Article',headline:'سامسونج تابلت: التدوين دون إنترنت',url:u.origin+u.pathname};
 const faqJson={'@context':'https://schema.org','@type':'FAQPage',mainEntity:[{'@type':'Question',name:'ما هو NOV170؟',acceptedAnswer:{'@type':'Answer',text:'جرّب الكود في سلة نون'}}]};
 const body='<article><h1>دليل سامسونج تابلت</h1>'+
    '<nav><a href="https://noondealsnow.com/guides">أدلة التسوق</a></nav>'+
    '<p>'+('قارن بين البائعين والضمان وشروط الخصم NOV170 في نون السعودية قبل الشراء. '.repeat(120))+'</p>'+
    '<script type="application/ld+json">'+JSON.stringify(articleJson)+'</script>'+
    '<script type="application/ld+json">'+JSON.stringify(faqJson)+'</script></article>';
 const record={...item,body,meta:{...item.meta,at:published}};
 const response=renderApprovedNativeAiV2Fast(record,slug,u,false);
 assert.equal(response?.status,200);
 const html=await response.text();
 const schemas=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(x=>JSON.parse(x[1]));
 assert.equal(schemas.filter(x=>x['@type']==='Article').length,1,'one Article node, not duplicates');
 assert.equal(schemas.filter(x=>x['@type']==='FAQPage').length,1,'FAQ schema retained');
 assert.equal(schemas.find(x=>x['@type']==='Article').datePublished,published);
 assert.equal(schemas.find(x=>x['@type']==='Article').mainEntityOfPage,u.origin+u.pathname);
 assert.equal(schemas.find(x=>x['@type']==='Article').dateModified,undefined,'no inferred editorial update');
 assert.deepEqual(schemas.find(x=>x['@type']==='FAQPage'),faqJson);
 assert.ok(html.includes('datetime="'+published+'"'),'visible date must match JSON-LD');
 assert.ok(html.includes('property="article:published_time" content="'+published+'"'),'Open Graph date must match JSON-LD');
 assert.ok(html.includes('href="/saudi/shopping-guide"'),'absolute known-404 legacy link repaired');
 assert.ok(!html.includes('href="https://noondealsnow.com/guides"'));
 assert.ok(html.includes('NOV170'),'coupon remains intact');
 assert.equal(record.body,body,'original stored R2 body never altered');
});

test('native schema supplement preserves verified existing dates, FAQ and graph; never invents dateModified',()=>{
 const published='2026-11-08T05:51:01.892Z';
 const canonical='https://noondealsnow.com/articles/sample';
 const given={'@context':'https://schema.org','@graph':[
  {'@type':'Article',datePublished:'2026-11-05T12:00:00.000Z',mainEntityOfPage:canonical},
  {'@type':'BreadcrumbList',itemListElement:[{position:1,name:'Noon'}]}
 ]};
 const source='<script type="application/ld+json">'+JSON.stringify(given)+'</script>';
 const changed=supplementNativeArticleJsonLd(source,{publishedAt:published,canonical});
 assert.equal(changed,source,'existing date and canonical must not be overwritten');
 const fresh=supplementNativeArticleJsonLd(source,{publishedAt:published,modifiedAt:null,canonical});
 assert.equal(fresh,source);
 const noDate=supplementNativeArticleJsonLd(source,{publishedAt:null,canonical});
 assert.equal(noDate,source,'absence of verified date must never create one');
 const patch={'@context':'https://schema.org','@graph':[{'@type':'Article'},given['@graph'][1]]};
 const text='<script type="application/ld+json">'+JSON.stringify(patch)+'</script>';
 const once=supplementNativeArticleJsonLd(text,{publishedAt:published,canonical});
 const json=JSON.parse(once.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);
 assert.equal(json['@graph'][0].datePublished,published);
 assert.equal(json['@graph'][0].mainEntityOfPage,canonical);
 assert.deepEqual(json['@graph'][1],given['@graph'][1],'BreadcrumbList must be untouched');
 assert.equal(supplementNativeArticleJsonLd(once,{publishedAt:published,canonical}),once,'idempotent');
 const onlyFaq='<script type="application/ld+json">'+JSON.stringify({'@type':'FAQPage'})+'</script>';
 assert.equal(supplementNativeArticleJsonLd(onlyFaq,{publishedAt:published,canonical}),onlyFaq);
});

test('native R2 double-encoded Arabic descriptions become human-readable in metadata without altering content',async()=>{
 const title='دليل سامسونج تابلت نون السعودية NOV170';
 const desc='دليل عملي لمقارنة التدوين دون إنترنت، مواصفات تابلت سامسونج والضمان والشحن على نون السعودية قبل الدفع.';
 const twice=s=>encodeURIComponent(encodeURIComponent(s));
 assert.equal(decodeNativeMetadataText(twice(desc)),desc);
 assert.equal(decodeNativeMetadataText(encodeURIComponent(desc)),desc);
 assert.equal(decodeNativeMetadataText(desc),desc);
 assert.equal(decodeNativeMetadataText('%E0%A4%A'),'%E0%A4%A','invalid metadata escapes remain untouched');
 const record={...item,meta:{...item.meta,t:twice(title),m:twice(desc),at:'2026-11-08T05:51:01.892Z'}};
 const res=renderApprovedNativeAiV2Fast(record,url.pathname.split('/').at(-1),url,false);
 assert.equal(res?.status,200);
 const html=await res.text();
 assert.ok(html.includes('<title>'+title+' | كوبونات نون</title>'),'title must decode to Arabic');
 assert.ok(html.includes('<meta name="description" content="'+desc+'">'),'description must decode to Arabic');
 assert.ok(html.includes('<meta property="og:description" content="'+desc+'">'),'OpenGraph description must agree');
 assert.doesNotMatch(html,/<meta name="description" content="%[a-f0-9]{2}/i,'escaped Arabic must not appear in the description field');
 assert.ok(html.includes('href="'+url.href+'"'),'canonical remains original');
 assert.ok(html.includes('NOV170'),'coupon remains unchanged');
 assert.equal(record.meta.m,twice(desc),'source R2 record remains intact');
});

test('native Arabic metadata truncated inside encoded UTF-8 uses its own Article JSON-LD description instead of percent escapes',async()=>{
 const heading='مراجعة تابلت سامسونج وضمان البائع في نون السعودية';
 const originalDesc='دليل شامل عن سامسونج تابلت على نون السعودية: قارن المواصفات والبائع والضمان والشحن، وتحقق من السعر النهائي قبل الدفع.';
 const malformed=encodeURIComponent(originalDesc).slice(0,135)+'%D8%';
 const slug='saudi-buyer-samsung-tablet-offline-annotation-workflow-nov170-2026-n5';
 const u=new URL('https://noondealsnow.com/articles/'+slug);
 const json={'@context':'https://schema.org','@type':'Article',headline:heading,
   description:originalDesc,inLanguage:'ar-SA',datePublished:'2026-11-08T05:51:01.892Z'};
 const body='<article><h1>'+heading+'</h1><p>'+('قارن المواصفات والضمان والشحن قبل الشراء. NOV170. '.repeat(120))+'</p>'+
  '<script type="application/ld+json">'+JSON.stringify(json)+'</script></article>';
 const record={body,meta:{...item.meta,t:encodeURIComponent(heading),m:malformed,at:'2026-11-08T05:51:01.892Z'}};
 assert.equal(articleJsonLdDescription(body),originalDesc);
 assert.equal(nativeMetaDescription(malformed,body),originalDesc);
 const response=renderApprovedNativeAiV2Fast(record,slug,u,false);
 assert.equal(response?.status,200);
 const html=await response.text();
 assert.ok(html.includes('<meta name="description" content="'+originalDesc+'">'));
 assert.ok(html.includes('<meta property="og:description" content="'+originalDesc+'">'));
 assert.doesNotMatch(html,/<meta name="description" content="%/);
 assert.ok(html.includes('href="'+u.href+'"'));
 assert.equal((html.match(/"@type":"Article"/g)||[]).length,1,'no extra Article entity');
 assert.ok(html.includes('NOV170'),'market code preserved');
 assert.equal(record.meta.m,malformed,'R2 metadata unchanged');
 assert.equal(record.body,body,'R2 article unchanged');
});
test('source JSON-LD fallback ignores FAQ schema and cannot invent a description',()=>{
 const source='<script type="application/ld+json">'+JSON.stringify({'@type':'FAQPage',description:'Not the article description'})+'</script>';
 assert.equal(articleJsonLdDescription(source),'');
 const good='Healthy complete description of the coupon workflow before checkout.';
 assert.equal(nativeMetaDescription(encodeURIComponent(good),source),good);
});


test('Saudi native clipped metadata falls back to the article actual complete checkout answer',async()=>{
 const slug='saudi-buyer-samsung-tablet-offline-annotation-workflow-nov170-2026-n5';
 const u=new URL('https://noondealsnow.com/articles/'+slug);
 const heading='سامسونج تابلت: التدوين دون إنترنت — البائع والضمان | نون السعودية';
 const truncated='دليل شامل عن سامسونج تابلت: التدوين دون إنترنت — البائع والضمان | نون السعودية على نون السعودية: قارن المواصفات والبائع والضمان والشحن وتحقق من السعر النهائي قبل الد';
 const answer='جرّب NOV170 داخل سلة نون السعودية قبل الدفع، ولا نفترض أن القسيمة صالحة لكل حساب.';
 const expected=heading+' — '+answer;
 const schema={'@context':'https://schema.org','@type':'Article',headline:heading,description:truncated};
 const faq={'@context':'https://schema.org','@type':'FAQPage',mainEntity:[{'@type':'Question',name:'كيف أستخدم NOV170؟',acceptedAnswer:{'@type':'Answer',text:'راجع السلة.'}}]};
 const body='<article><h1>'+heading+'</h1><p class="direct-answer answer-box"><strong>الإجابة المباشرة:</strong> عند البحث عن سامسونج تابلت، راجع البائع والضمان وشروط التوصيل. '+answer+'</p>'+
  '<p>'+('قارن مواصفات تابلت سامسونج والبائع والضمان في نون السعودية. NOV170. '.repeat(110))+'</p>'+
  '<script type="application/ld+json">'+JSON.stringify(schema)+'</script>'+
  '<script type="application/ld+json">'+JSON.stringify(faq)+'</script></article>';
 const rec={body,meta:{...item.meta,t:encodeURIComponent(heading),m:encodeURIComponent(truncated),at:'2026-11-08T05:51:01.892Z'}};
 assert.equal(nativeCompleteSearchSnippet(body,heading,false),expected);
 const result=renderApprovedNativeAiV2Fast(rec,slug,u,false);
 assert.equal(result?.status,200);
 const html=await result.text(),jsons=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(v=>JSON.parse(v[1]));
 assert.ok(html.includes('<meta name="description" content="'+expected+'">'));
 assert.ok(html.includes('<meta property="og:description" content="'+expected+'">'));
 assert.equal(jsons.filter(x=>x['@type']==='Article').length,1);
 assert.equal(jsons.find(x=>x['@type']==='Article').description,expected);
 assert.deepEqual(jsons.find(x=>x['@type']==='FAQPage'),faq);
 assert.ok(html.includes('href="'+u.href+'"'));
 assert.ok(html.includes('data-rescue-copy="NOV170"'));
 assert.equal(rec.body,body,'stored R2 bytes immutable');
 assert.equal(rec.meta.m,encodeURIComponent(truncated));
});
test('English native Nintendo Switch 2 snippet no longer repeats title or ends with an ellipsis',async()=>{
 const slug='en-noon-uae-final-price-guide-nintendo-switch-2-coupon-eligibility';
 const u=new URL('https://noondealsnow.com/en/articles/'+slug);
 const heading='Noon UAE final price guide Nintendo Switch 2 coupon eligibility';
 const oldDescription='Noon UAE · gaming consoles Noon UAE final price guide Nintendo Switch 2 coupon eligibility Quick answer: Start with a stable cart, copy NOV188, and use the final Noon…';
 const expected='Nintendo Switch 2 on Noon UAE — Start with a stable cart, copy NOV188, and use the final Noon checkout total as the reference.';
 const json={'@context':'https://schema.org','@type':'Article',headline:heading,description:oldDescription};
 const source='<article lang="en"><h1>'+heading+'</h1><p class="direct-answer"><strong>Quick answer:</strong> Start with a stable cart, copy NOV188, and use the final Noon checkout total as the reference instead of assuming a fixed discount.</p>'+
  '<p>'+('Before buying Nintendo Switch 2, compare consoles, seller, bundles, delivery and checkout in Noon UAE. NOV188. '.repeat(90))+'</p>'+
  '<script type="application/ld+json">'+JSON.stringify(json)+'</script></article>';
 const rec={body:source,meta:{...item.meta,c:'AE',cp:'NOV188',t:encodeURIComponent(heading),m:encodeURIComponent(oldDescription),at:'2026-10-24T17:45:00Z'}};
 assert.equal(nativeCompleteSearchSnippet(source,heading,true),expected);
 const result=renderApprovedNativeAiV2Fast(rec,slug,u,true);
 assert.equal(result?.status,200);
 const html=await result.text();
 assert.ok(html.includes('<meta name="description" content="'+expected+'">'));
 assert.ok(html.includes('<meta property="og:description" content="'+expected+'">'));
 assert.ok(!expected.includes('…')&&expected.length<=170);
 const article=JSON.parse([...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)][0][1]);
 assert.equal(article.description,expected);
 assert.equal(article.headline,heading,'H1 and headline must remain original');
 assert.ok(html.includes('href="'+u.href+'"'));
 assert.ok(html.includes('data-rescue-copy="NOV188"'));
 assert.equal(rec.body,source,'no storage mutations');
});
