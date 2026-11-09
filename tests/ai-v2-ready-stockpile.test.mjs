import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {READY_PREFIX, readyObjectKey, validateReadyRecord, nextReadySchedule, isReadyDue, stageReadyArticle} from '../automation/ai-v2/ready-stockpile.mjs';
const html = '<article><h1>Buying guide</h1>' + 'Check the verified product and coupon details. '.repeat(115) + '</article>';
const digest = v => createHash('sha256').update(v).digest('hex');
const mk = (country='SA') => ({
  articleId: 'a'.repeat(24), slug: country === 'SA' ? 'saudi-buyer-real-product-nov170-2026' : 'uae-buyer-real-product-nov188-2026',
  country, coupon: country === 'SA' ? 'NOV170' : 'NOV188', language: country === 'SA' ? 'ar-SA' : 'en-AE',
  contentHash: digest(html), html, state: 'READY', quality: 95, wordCount: 1580,
  createdAt: '2026-11-09T17:00:00.000Z', scheduledAt: '2026-11-09T17:06:00.000Z',
  visuals: Array.from({length:5}, (_,i)=>({key:`_ops/system1/visuals/${country.toLowerCase()}-proof-${i}.svg`,width:1600,height:1000,textLanguage:'en',sha256:digest('image'+i)}))
});
function mockR2(){
  const state = new Map();let puts=0;
  return {state,get puts(){return puts;},
    async head(k){return state.has(k) ? {etag:'existing'} : null},
    async get(k){return state.has(k)?{text:async()=>state.get(k)}:null},
    async put(k,value,{onlyIf}){assert.equal(onlyIf.etagDoesNotMatch,'*');if(state.has(k))return null;state.set(k,value);puts++;return {etag:'saved'};}
  };
}
test('market, code, word count, quality and exactly five distinct visual proofs are required',()=>{
  for (const country of ['SA','AE']) assert.deepEqual(validateReadyRecord(mk(country)),{ok:true});
  assert.equal(validateReadyRecord({...mk(),coupon:'NOV188'}).reason,'MARKET_ISOLATION_FAILED');
  assert.equal(validateReadyRecord({...mk(),quality:94}).reason,'PREAUDIT_INSUFFICIENT');
  assert.equal(validateReadyRecord({...mk(),wordCount:1499}).reason,'PREAUDIT_INSUFFICIENT');
  assert.equal(validateReadyRecord({...mk(),visuals:mk().visuals.slice(0,4)}).reason,'FIVE_VISUALS_REQUIRED');
  const dup=mk();dup.visuals[4]={...dup.visuals[0]};
  assert.equal(validateReadyRecord(dup).reason,'VISUAL_PROOF_INVALID');
  assert.equal(validateReadyRecord({...mk(),slug:'bad'}).reason,'INVALID_ID_OR_SLUG');
});
test('immutable one-minute schedule follows UTC due time, not browser presence',()=>{
  assert.equal(nextReadySchedule('2026-11-09T17:00:01.000Z',0,1),'2026-11-09T17:01:00.000Z');
  assert.equal(nextReadySchedule('2026-11-09T17:00:01.000Z',2,5),'2026-11-09T17:15:00.000Z');
  assert.throws(()=>nextReadySchedule('2026-11-09T17:00:01.000Z',0,2));
  assert.equal(isReadyDue(mk(),'2026-11-09T17:05:59.000Z'),false);
  assert.equal(isReadyDue(mk(),'2026-11-09T17:06:00.000Z'),true);
  assert.equal(isReadyDue({...mk(),state:'PUBLISHED'},'2026-11-09T17:07:00.000Z'),false);
});
test('R2 stage is guarded, verified by readback, write-once and never publishes',async()=>{
  const r2=mockR2(),record=mk(),env={CONTENT_FINAL:r2};
  assert.equal(readyObjectKey(record.articleId),READY_PREFIX+record.articleId+'.json');
  const saved=await stageReadyArticle(env,record);
  assert.deepEqual(saved,{ok:true,state:'READY',key:readyObjectKey(record.articleId),scheduledAt:record.scheduledAt,note:'STAGED_ONLY_NOT_PUBLISHED'});
  assert.equal(r2.puts,1);assert.equal(r2.state.has('articles/'+record.slug+'.html'),false);
  assert.equal((await stageReadyArticle(env,record)).reason,'READY_ALREADY_STAGED');
  assert.equal(r2.puts,1);
});
test('reject already-published, tampered hash and unverified writes without provider calls',async()=>{
  const record=mk(),r2=mockR2();
  r2.state.set('articles/'+record.slug+'.html','published');
  assert.equal((await stageReadyArticle({CONTENT_FINAL:r2},record)).reason,'ALREADY_PUBLISHED');
  const noHash={...record,html:record.html+'edited'};
  assert.equal((await stageReadyArticle({CONTENT_FINAL:mockR2()},noHash)).reason,'CONTENT_HASH_MISMATCH');
  assert.equal((await stageReadyArticle({},record)).reason,'R2_BINDING_UNAVAILABLE');
  const store=mockR2();store.get=async()=>({text:async()=> 'tampered'});
  assert.equal((await stageReadyArticle({CONTENT_FINAL:store},record)).reason,'READY_READBACK_UNVERIFIED');
});
