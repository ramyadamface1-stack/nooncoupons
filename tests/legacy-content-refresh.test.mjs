import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleEditorialDates,nativeBoundLegacyPublicFastResponse,readableMetaDescription} from '../r2-emergency-readonly.js';
import {fullBlogRowFromObject,verifiedRowEditorialDate,completeBlogResponse} from '../complete-blog-listing.js';
import {parseGscCsv,rankDecayingArticles} from '../scripts/gsc-decay-refresh-plan.mjs';

const published='2026-08-06T11:20:00.000Z';
const reviewed='2026-11-18T09:30:00.000Z';
test('historical article metadata snippets end at a sentence or full word, never midway through a word',()=>{
 const lead='كود نون السعودية NOV170 يساعدك على فحص أهلية العرض عند الدفع.';
 const entire=lead+' التفاصيل الكاملة تتطلب مراجعة المنتجات والشحن والمقارنة بين الخيارات قبل الشراء'.repeat(8);
 const snippet=readableMetaDescription(entire,130);
 assert.equal(snippet,lead);
 assert.ok(snippet.length<=130);
 const words='Compare the actual seller warranty shipment coupon eligibility cart total before buying '.repeat(7);
 const clipped=readableMetaDescription(words,115);
 assert.ok(clipped.endsWith('…'));
 assert.ok(clipped.length<=115);
 assert.ok(/\s[A-Za-z]+…$/.test(clipped));
 assert.equal(readableMetaDescription('  سعر نون اليوم   واضح   '),'سعر نون اليوم واضح');
 assert.equal(readableMetaDescription('قارن المواصفات وتحقق من السعر النهائي قبل الدفع، مع'),'قارن المواصفات وتحقق من السعر النهائي قبل الدفع.');
});
test('substantial verified November updates display separately from original publication',async()=>{
 const body='<!doctype html><html><head><title>Outdated page</title></head><body><main><article><h1>دليل مقارنة الهواتف على نون السعودية</h1><p>'+('افحص الضمان والبائع والتوصيل والمواصفات قبل شراء الموبايل. '.repeat(25))+'</p></article></main></body></html>';
 const env={R2_RESCUE_READONLY_ENABLED:'false',CONTENT_FINAL:{async get(key){
   return key==='articles/legacy-phones.html'?{text:async()=>body,customMetadata:{c:'SA',status:'published',at:published,editorialUpdatedAt:reviewed}}:null;
 }}};
 const res=await nativeBoundLegacyPublicFastResponse(new Request('https://noondealsnow.com/articles/legacy-phones'),env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/<time datetime="2026-08-06T11:20:00.000Z">/);
 assert.match(html,/آخر تحديث تحريري:/);
 assert.match(html,/<time itemprop="dateModified" datetime="2026-11-18T09:30:00.000Z">/);
 assert.match(html,/"dateModified":"2026-11-18T09:30:00.000Z"/);
 assert.match(html,/property="article:modified_time" content="2026-11-18T09:30:00.000Z"/);
});
test('an automatic seasonal label is not misrepresented as an editorial November update',()=>{
 const html=visibleEditorialDates(published,null,false);
 assert.match(html,/تاريخ النشر:/);
 assert.doesNotMatch(html,/آخر تحديث تحريري|dateModified/);
 assert.doesNotMatch(visibleEditorialDates(published,'2026-12-05T00:00:00Z'),/dateModified/);
});
test('R2 archive rows expose real reviewed dates, not migration timestamps or future dates',()=>{
 const base={key:'articles/luggage-guide.html',uploaded:new Date('2026-11-19T09:00:00Z'),customMetadata:{at:published,c:'SA',status:'published',t:'Luggage Guide',editorialUpdatedAt:reviewed}};
 const row=fullBlogRowFromObject(base);
 assert.equal(row.publishedAt,published);
 assert.equal(row.editorialUpdatedAt,reviewed);
 const migrated=fullBlogRowFromObject({...base,customMetadata:{...base.customMetadata,editorialUpdatedAt:null}});
 assert.equal(migrated.editorialUpdatedAt,null);
 assert.equal(verifiedRowEditorialDate({substantiveUpdatedAt:'2026-12-02T00:00:00Z'},published,new Date('2026-11-19T09:00:00Z')),null);
});
test('blog preview visibly shows the original date and a later verified editorial update',async()=>{
 const article={key:'articles/luggage-guide.html',uploaded:new Date('2026-11-19T09:00:00Z'),customMetadata:{at:published,c:'SA',status:'published',t:'Luggage Guide',editorialUpdatedAt:reviewed}};
 const env={CONTENT_FINAL:{async list(){return {objects:[article],truncated:false}},async get(){return null}}};
 const page=await completeBlogResponse(env,new URL('https://noondealsnow.com/blog'));
 const html=await page.text();
 assert.match(html,/نشر <time datetime="2026-08-06T11:20:00.000Z">/);
 assert.match(html,/آخر تحديث <time datetime="2026-11-18T09:30:00.000Z">/);
 assert.doesNotMatch(html,/نشر <time datetime="2026-11-19T09:00:00.000Z">/);
});
test('GSC exports identify formerly visited decaying articles by absolute clicks lost',()=>{
 const before=parseGscCsv('\uFEFFTop pages,Clicks,Impressions,Position\r\n"https://noondealsnow.com/articles/luggage-guide",500,4000,3\r\n"https://noondealsnow.com/articles/skincare-guide",50,300,6\r\n"https://other.example/articles/unrelated",999,9999,1\r\n');
 const after=parseGscCsv('Top pages,Clicks,Impressions,Position\nhttps://noondealsnow.com/articles/luggage-guide,120,2000,11\nhttps://noondealsnow.com/articles/skincare-guide,0,70,18\n');
 const rows=rankDecayingArticles(before,after);
 assert.equal(rows.length,2);
 assert.equal(rows[0].url,'https://noondealsnow.com/articles/luggage-guide');
 assert.equal(rows[0].clicksLost,380);
 assert.equal(rows[0].declinePercent,76);
 assert.equal(rows[1].clicksLost,50);
 assert.match(rows[0].action,/substantial/);
});
