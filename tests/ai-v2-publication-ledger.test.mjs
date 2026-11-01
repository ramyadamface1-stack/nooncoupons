import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_V2_LEDGER_KEY,inspectAiV2Ledger,readAiV2PublicationLedger,recordAiV2Publication,reconcileAiV2Publication} from '../ai-v2-publication-ledger.js';
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
