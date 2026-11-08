import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_V2_LEDGER_KEY,inspectAiV2Ledger,readAiV2PublicationLedger,recordAiV2Publication,appendApprovedAiV2ToPublicBlog,reconcileAiV2Publication,combineGenerationFreshness,aiV2PublicationWindows} from '../ai-v2-publication-ledger.js';
const slug='uae-ninja-airfryer-capacity-warranty-checklist-2026';
function mock(){
 let doc=null,etag=null,rev=0;
 const store={
  async get(k){assert.equal(k,AI_V2_LEDGER_KEY);return doc===null?null:{etag,json:async()=>JSON.parse(doc)}},
  async put(k,body,options){assert.equal(k,AI_V2_LEDGER_KEY);
   if(options.onlyIf.etagDoesNotMatch==='*'&&doc!==null)return null;
   if(options.onlyIf.etagMatches&&options.onlyIf.etagMatches!==etag)return null;
   doc=body;etag='rev-'+(++rev);return {etag}},
  async head(k){return k==='articles/'+slug+'.html'?{customMetadata:{p:'ai-v2-native',status:'published',c:'AE',at:'2026-11-01T20:54:43.401Z'}}:null}
 };
 return {CONTENT_FINAL:store};
}
test('AI V2 ledger starts zero, records once and cannot double count same article',async()=>{
 const env=mock(),first=await readAiV2PublicationLedger(env);
 assert.equal(first.ok,true);assert.equal(first.count,0);
 assert.equal((await recordAiV2Publication(env,{slug,country:'AE'})).recorded,true);
 const twice=await recordAiV2Publication(env,{slug,country:'AE'});assert.equal(twice.alreadyPresent,true);
 assert.equal((await readAiV2PublicationLedger(env)).count,1);
});
test('authenticated reconciliation only counts real metadata-marked articles',async()=>{
 const env=mock();
 assert.equal((await reconcileAiV2Publication(env,{slug})).verifiedInR2,true);
 assert.equal((await reconcileAiV2Publication(env,{slug:'unpublished-entry-2026'})).reason,'ARTICLE_NOT_FOUND');
 assert.equal((await readAiV2PublicationLedger(env)).count,1);
});
test('malformed, duplicate and unrelated entries fail closed',()=>{
 assert.equal(inspectAiV2Ledger({version:1,articles:[{slug,country:'AE'},{slug,country:'AE'}]}).ok,false);
 assert.equal(inspectAiV2Ledger({version:1,articles:[{slug:'not-valid!',country:'AE'}]}).ok,false);
});

test('public freshness includes actually published AI V2 while keeping legacy rescue state',()=>{
 const snapshot={lastSuccessfulPublishAt:'2026-10-31T07:54:28.734Z',minutesSinceLastSuccessfulPublish:2000,rescueDue:true};
 const ledger={ok:true,count:1,ledger:{articles:[{slug,country:'AE',publishedAt:'2026-11-01T20:54:43.401Z'}]}};
 const at=Date.parse('2026-11-01T21:05:00Z');
 const combined=combineGenerationFreshness(snapshot,ledger,at);
 assert.equal(combined.lastSuccessfulPublishSource,'ai-v2-native');
 assert.equal(combined.lastSuccessfulPublishAt,'2026-11-01T20:54:43.401Z');
 assert.equal(combined.legacyRescueDue,true);
 assert.equal(combined.aiV2PublishedCount,1);
 assert.equal(combined.aiV2PublishedLast24Hours,1);
});

test('AI V2 hourly publication counters are based on actual ledger entries by country, not scheduled ticks',()=>{
 const now=Date.parse('2026-11-02T12:00:00Z');
 const ledger={ok:true,ledger:{articles:[
 {slug:'a-samsung-device-selection-2026',country:'SA',publishedAt:'2026-11-02T11:50:00Z'},
 {slug:'b-ninja-cooking-selection-2026',country:'AE',publishedAt:'2026-11-02T10:15:00Z'},
 {slug:'c-apple-audio-selection-2026',country:'AE',publishedAt:'2026-11-02T04:00:00Z'},
 {slug:'d-earlier-comparison-2026',country:'SA',publishedAt:'2026-10-31T09:00:00Z'}
 ]}};
 const result=aiV2PublicationWindows(ledger,now);
 assert.deepEqual({total:result.windows['1h'].total,SA:result.windows['1h'].SA,AE:result.windows['1h'].AE},{total:1,SA:1,AE:0});
 assert.deepEqual({total:result.windows['2h'].total,SA:result.windows['2h'].SA,AE:result.windows['2h'].AE},{total:2,SA:1,AE:1});
 assert.deepEqual({total:result.windows['6h'].total,SA:result.windows['6h'].SA,AE:result.windows['6h'].AE},{total:2,SA:1,AE:1});
 assert.deepEqual({total:result.windows['24h'].total,SA:result.windows['24h'].SA,AE:result.windows['24h'].AE},{total:3,SA:1,AE:2});
 assert.deepEqual({total:result.windows['10h'].total,SA:result.windows['10h'].SA,AE:result.windows['10h'].AE},{total:3,SA:1,AE:2});
 assert.deepEqual({total:result.windows['12h'].total,SA:result.windows['12h'].SA,AE:result.windows['12h'].AE},{total:3,SA:1,AE:2});
 assert.deepEqual(result.windows['24h'].byProvider,{gemini:0,groq:0,unknown:3});
 assert.deepEqual(result.windows['24h'].byKey,{unknown:3});
 assert.equal(result.lastArticle.country,'SA');
 assert.equal(aiV2PublicationWindows({ok:false,reason:'UNAVAILABLE'}).available,false);
});

test('large publication ledger keeps all 1h 10h 24h counts and provider attributes',()=>{
 const at=Date.parse('2026-11-05T09:00:00Z');
 const entries=Array.from({length:2200},(_,i)=>({
  slug:'published-buyer-guide-'+i+'-2026',
  country:i%2?'AE':'SA',
  publishedAt:new Date(at-(i%30)*3600000-60000).toISOString(),
  provider:i%3===0?'groq':'gemini',
  keyRef:i%3===0?'aaaaaaaaaaaa':'bbbbbbbbbbbb'
 }));
 const result=aiV2PublicationWindows({ok:true,ledger:{articles:entries}},at);
 for(const h of [1,2,6,10,12,24]){
  const expected=entries.filter(x=>at-Date.parse(x.publishedAt)<h*3600000);
  assert.equal(result.windows[h+'h'].total,expected.length);
  assert.equal(result.windows[h+'h'].SA,expected.filter(x=>x.country==='SA').length);
  assert.equal(result.windows[h+'h'].AE,expected.filter(x=>x.country==='AE').length);
  assert.equal(result.windows[h+'h'].byProvider.groq,expected.filter(x=>x.provider==='groq').length);
 }
 assert.equal(result.lastArticle.publishedAt,new Date(at-60000).toISOString());
});

test('native published article updates chronological blog without dropping prior articles or skipping QA',async()=>{
 const state=new Map(),versions=new Map();let revision=0;
 const get=async key=>{
  if(!state.has(key))return null;
  return {etag:versions.get(key),json:async()=>JSON.parse(state.get(key))};
 };
 const put=async(key,body,opts={})=>{
  const current=versions.get(key)||null;
  if(opts.onlyIf?.etagDoesNotMatch==='*'&&current)return null;
  if(opts.onlyIf?.etagMatches&&opts.onlyIf.etagMatches!==current)return null;
  state.set(key,body);versions.set(key,'v'+(++revision));return {etag:versions.get(key)};
 };
 const env={CONTENT_FINAL:{get,put}};
 const old={version:1,articles:[{slug:'historic-noon-guide-preserved-2026',country:'SA',
  status:'published',title:'Historical article',publishedAt:'2026-11-07T09:00:00Z'}]};
 await put('blog/latest-live-v1.json',JSON.stringify(old));
 const entry={slug:'saudi-buyer-samsung-tablet-new-intent-nov170-2026-n5',country:'SA',
  publishedAt:'2026-11-08T06:00:00Z',title:'Samsung tablet Noon Saudi buying guide with NOV170',
  metaDescription:'A long product-focused purchasing guide that checks seller warranty and coupon at checkout.',
  quality:100,wordCount:1775};
 const created=await appendApprovedAiV2ToPublicBlog(env,entry);
 assert.equal(created.ok,true);
 assert.equal((await appendApprovedAiV2ToPublicBlog(env,entry)).alreadyPresent,true);
 const rows=(await get('blog/latest-live-v1.json')).json();
 const data=await rows;
 assert.equal(data.articles[0].slug,entry.slug);
 assert.equal(data.articles[0].coupon,'NOV170');
 assert.ok(data.articles.some(x=>x.slug===old.articles[0].slug));
 assert.equal(data.articles.filter(x=>x.slug===entry.slug).length,1);
 assert.equal((await appendApprovedAiV2ToPublicBlog(env,{...entry,quality:92})).ok,false);
});
