import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectNativeReadyStock,countArchivedUncertainStock} from '../cloudflare-ai-direct/stock-housekeeping.mjs';
import {classifyNativeRejection} from '../cloudflare-ai-direct/native-rejection.mjs';
import {couponStatus} from '../coupon-registry.js';
import {readFileSync} from 'node:fs';

const ROOT='_ops/noondealsnow-direct-ai-v1/';
const READY=ROOT+'ready/';
const UNCERTAIN=ROOT+'uncertain-publication/';
const at=Date.parse('2026-11-19T09:30:00.000Z');

function mockBucket(initial){
 const records=new Map(Object.entries(initial)),deletions=[];
 return {records,deletions,
  async list({prefix,limit}){
   const keys=[...records.keys()].filter(k=>k.startsWith(prefix)).sort();
   return {objects:keys.slice(0,limit).map(key=>({key})),truncated:keys.length>limit};
  },
  async get(key){return records.has(key)?{json:async()=>records.get(key)}:null},
  async head(key){return records.has(key)?{etag:'exists'}:null},
  async put(key,body,{onlyIf}={}){
   if(onlyIf?.etagDoesNotMatch==='*'&&records.has(key))return null;
   records.set(key,JSON.parse(body));return {etag:'saved'};
  },
  async delete(key){deletions.push(key);records.delete(key)}
 };
}
const unknown=(slug,preparedAt)=>({state:'UNKNOWN_PUBLICATION_OUTCOME',topic:{slug},
 article:{html:'<article>Original content is preserved</article>'},
 checkpoint:{contentHash:'hash'},preparedAt});

test('24-hour uncertain archive frees backpressure without reposting or losing original content',async()=>{
 const slug='saudi-buyer-uncertain-source-2026',key=READY+'1-'+slug+'.json';
 const original=unknown(slug,'2026-11-12T21:00:00.000Z');
 const bucket=mockBucket({[key]:original});
 const first=await inspectNativeReadyStock(bucket,{now:at});
 assert.equal(first.archivedUncertain,1);
 assert.equal(first.activeCount,0);
 assert.equal(first.unknownCount,0);
 assert.equal(bucket.records.has(key),false);
 const archival=bucket.records.get(UNCERTAIN+slug+'.json');
 assert.equal(archival.manualReviewRequired,true);
 assert.equal(archival.archivedFromReadyKey,key);
 assert.deepEqual(archival.article,original.article);
 assert.deepEqual(archival.checkpoint,original.checkpoint);
 assert.deepEqual(await countArchivedUncertainStock(bucket),{count:1,exact:true});
 assert.deepEqual(bucket.deletions,[key]);
});

test('twelve stranded attempts are durably retained across three bounded cron housekeeping ticks',async()=>{
 const initial={};
 for(let i=0;i<12;i++){
  const slug='saudi-buyer-stranded-'+String(i).padStart(2,'0')+'-2026';
  initial[READY+slug+'.json']=unknown(slug,'2026-11-13T09:00:00.000Z');
 }
 const bucket=mockBucket(initial);
 for(let tick=0;tick<3;tick++){
  const result=await inspectNativeReadyStock(bucket,{now:at+tick*60000,maxCleanup:4});
  assert.equal(result.archivedUncertain,4);
  assert.equal(result.cleanupErrors,0);
 }
 const stock=await inspectNativeReadyStock(bucket,{now:at+4*60000,maxCleanup:0});
 assert.equal(stock.activeCount,0);
 assert.equal(stock.unknownCount,0);
 assert.equal((await countArchivedUncertainStock(bucket)).count,12);
 assert.equal(bucket.deletions.length,12);
 for(let i=0;i<12;i++){
  const slug='saudi-buyer-stranded-'+String(i).padStart(2,'0')+'-2026';
  assert.match(bucket.records.get(UNCERTAIN+slug+'.json').article.html,/Original content is preserved/);
 }
});

test('recent ambiguous publication remains protected and blocks the generation buffer',async()=>{
 const slug='uae-buyer-recently-unknown-2026',key=READY+slug+'.json';
 const bucket=mockBucket({[key]:unknown(slug,'2026-11-19T09:00:00.000Z')});
 const check=await inspectNativeReadyStock(bucket,{now:at});
 assert.equal(check.activeCount,1);
 assert.equal(check.unknownCount,1);
 assert.equal(check.archivedUncertain,0);
 assert.equal(bucket.deletions.length,0);
});

test('uncertain archive is idempotent after interrupted queue deletion',async()=>{
 const slug='saudi-buyer-interrupted-cleanup-2026',key=READY+slug+'.json';
 const original=unknown(slug,'2026-11-13T09:00:00.000Z');
 const copy={...original,archivedFromReadyKey:key,manualReviewRequired:true};
 const bucket=mockBucket({[key]:original,[UNCERTAIN+slug+'.json']:copy});
 const check=await inspectNativeReadyStock(bucket,{now:at});
 assert.equal(check.archivedUncertain,1);
 assert.equal(bucket.records.has(key),false);
});

test('conflicting archive and failed copy preserve the original queue pointer',async()=>{
 const slug='saudi-buyer-protected-conflict-2026',key=READY+slug+'.json';
 const original=unknown(slug,'2026-11-12T00:00:00Z');
 const bucket=mockBucket({[key]:original,[UNCERTAIN+slug+'.json']:{different:true}});
 const check=await inspectNativeReadyStock(bucket,{now:at});
 assert.equal(check.activeCount,1);
 assert.equal(check.unknownCount,1);
 assert.equal(check.cleanupErrors,1);
 assert.equal(bucket.records.has(key),true);
 assert.equal(bucket.deletions.length,0);
});

test('native no-write rejections do not fill UNKNOWN queue; unrecognized outcomes stay protected',()=>{
 for(const reason of [
  'NATIVE_QUALITY_BLOCKED','DUPLICATE_INTENT','COUPON_FRESHNESS_BLOCK',
  'INVALID_MARKET_COUPON','INVALID_LANGUAGE','UNSAFE_MARKUP',
  'CHECKPOINT_HASH_MISMATCH','STALE_CURRENT_SEASON_CLAIM'
 ])assert.equal(classifyNativeRejection(409,reason),'BLOCKED_REVIEW',reason);
 for(const reason of ['NATIVE_BINDINGS_MISSING','QUALITY_INDEX_UNAVAILABLE',
  'DUPLICATE_CHECK_UNAVAILABLE','GLOBAL_PUBLICATION_SLOT_NOT_GRANTED'])
  assert.equal(classifyNativeRejection(409,reason),'READY',reason);
 for(const [status,reason] of [[500,'native_publish_unavailable'],[409,'ARTICLE_WRITE_OUTCOME_UNKNOWN'],
  [409,'ARTICLE_ALREADY_PUBLISHED'],[200,'NATIVE_QUALITY_BLOCKED'],[409,'SOMETHING_NEW']])
  assert.equal(classifyNativeRejection(status,reason),'UNKNOWN_PUBLICATION_OUTCOME');
});

test('direct publication checks different uncertain records over successive minutes',()=>{
 const source=readFileSync(new URL('../cloudflare-ai-direct/engine.mjs',import.meta.url),'utf8');
 assert.match(source,/unresolved\[minute%unresolved\.length\]/);
 assert.match(source,/record\.publishAttemptAt=utc\(\)/);
 assert.match(source,/classifyNativeRejection\(response\.status,answer\?\.reason\)/);
 assert.doesNotMatch(source,/api\.github\.com|actions\/workflows/);
});

test('owner code review protects free requests when approval next expires',()=>{
 const at=new Date('2026-11-19T10:00:00Z');
 for(const [country,code] of [['SA','NOV170'],['AE','NOV188']]){
  const status=couponStatus({country,code},at);
  assert.equal(status.publishAllowed,true);
  const future=couponStatus({country,code},new Date('2026-12-20T10:00:00.000Z'));
  assert.equal(future.publishAllowed,false);
  assert.equal(future.reason,'coupon_registry_stale');
 }
 const source=readFileSync(new URL('../cloudflare-ai-direct/engine.mjs',import.meta.url),'utf8');
 const gate=source.indexOf("if(env.DIRECT_AI_STAGE==='production'&&!coupon.publishAllowed)return logState");
 const firstKeyRead=source.indexOf('keys=await listDirectKeys(env,{includePlain:true})');
 assert.ok(gate>0&&firstKeyRead>gate,'reject stale coupons before reading provider keys');
 assert.match(source,/marketPlan\.filter\(market=>couponGate\(market\)\.publishAllowed\)/);
 assert.match(source,/reason:'COUPON_OWNER_REVIEW_REQUIRED'/);
});

test('a site deploy lag prevents direct Cloudflare from spending provider quota',async()=>{
 const {directTick}=await import('../cloudflare-ai-direct/engine.mjs');
 const originalFetch=globalThis.fetch;
 let providerCalls=0;
 const statusWrites=[];
 globalThis.fetch=async url=>{
  if(String(url)!=='https://noondealsnow.com/api/ai-v2-control-policy'){
   providerCalls++;throw Error('PROVIDER_OR_PUBLISH_MUST_NOT_RUN');
  }
  return new Response(JSON.stringify({ok:true,enabled:true,
   intervalMinutes:1,publishingIntervalMinutes:1}),{status:200});
 };
 try{
  const env={DIRECT_AI_STAGE:'production',CONTENT_FINAL:{
   async put(key,body){statusWrites.push({key,row:JSON.parse(body)});return {etag:'saved'}},
   async list(){throw Error('NO_READY_SCAN_WHILE_SITE_VERSION_UNKNOWN')}
  }};
  const result=await directTick(env,{scheduledAt:at});
  assert.equal(result.phase,'SITE_COUPON_CATALOG_DEPLOY_PENDING');
  assert.equal(providerCalls,0);
  assert.equal(statusWrites.length,1);
  assert.match(statusWrites[0].key,/status\.json$/);
 }finally{globalThis.fetch=originalFetch;}
 const siteSource=readFileSync(new URL('../auto-platform.js',import.meta.url),'utf8');
 assert.match(siteSource,/ownerCatalogUpdatedAt:COUPON_REGISTRY_INFO\.catalogUpdatedAt/);
});
