import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_V2_LEDGER_KEY,inspectAiV2Ledger,readAiV2PublicationLedger,recordAiV2Publication,reconcileAiV2Publication,combineGenerationFreshness,aiV2PublicationWindows} from '../ai-v2-publication-ledger.js';
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
 assert.deepEqual(result.windows['24h'].byProvider,{gemini:0,groq:0,unknown:3});
 assert.deepEqual(result.windows['24h'].byKey,{unknown:3});
 assert.equal(result.lastArticle.country,'SA');
 assert.equal(aiV2PublicationWindows({ok:false,reason:'UNAVAILABLE'}).available,false);
});
