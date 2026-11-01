// Dedicated canonical count for AI V2 articles on the existing R2 bucket.
// DO publisher, existing bulk counters, historical manifests are NOT modified.
// Atomic conditional writes prevent duplicate IDs and lost updates.
export const AI_V2_LEDGER_KEY='_ops/ai-v2-publication-ledger-v1.json';
const fmt=s=>String(s||'');
const slugOk=s=>/^[a-z0-9-]{16,120}$/.test(fmt(s))&&!fmt(s).includes('--');
const empty=()=>({version:1,articles:[]});
export function inspectAiV2Ledger(data){
 if(!data||data.version!==1||!Array.isArray(data.articles)||data.articles.length>100000)return {ok:false,reason:'LEDGER_SCHEMA_INVALID'};
 const seen=new Set();
 for(const a of data.articles){
  if(!slugOk(a.slug)||!['SA','AE'].includes(a.country)||seen.has(a.slug))return {ok:false,reason:'LEDGER_ENTRY_INVALID'};
  seen.add(a.slug);
 }
 return {ok:true,count:seen.size};
}
export async function readAiV2PublicationLedger(env){
 if(!env?.CONTENT_FINAL)return {ok:false,reason:'LEDGER_STORAGE_UNAVAILABLE',count:null};
 try{
  const obj=await env.CONTENT_FINAL.get(AI_V2_LEDGER_KEY);
  if(!obj)return {ok:true,count:0,ledger:empty(),etag:null};
  const ledger=await obj.json(),validation=inspectAiV2Ledger(ledger);
  if(!validation.ok)return {...validation,count:null};
  return {ok:true,count:validation.count,ledger,etag:obj.etag};
 }catch(e){return {ok:false,reason:'LEDGER_READ_UNAVAILABLE',count:null}}
}
export async function recordAiV2Publication(env,entry){
 if(!slugOk(entry?.slug)||!['SA','AE'].includes(entry?.country))return {ok:false,reason:'INVALID_PUBLICATION_RECORD'};
 for(let i=0;i<4;i++){
  const old=await readAiV2PublicationLedger(env);
  if(!old.ok)return old;
  if(old.ledger.articles.some(x=>x.slug===entry.slug))return {ok:true,recorded:false,alreadyPresent:true,count:old.count};
  const article={slug:entry.slug,country:entry.country,publishedAt:fmt(entry.publishedAt)||new Date().toISOString(),provider:'ai-v2-native'};
  const ledger={version:1,updatedAt:new Date().toISOString(),articles:[...old.ledger.articles,article]};
  const options={onlyIf:old.etag?{etagMatches:old.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json; charset=utf-8'}};
  try{
   const saved=await env.CONTENT_FINAL.put(AI_V2_LEDGER_KEY,JSON.stringify(ledger),options);
   if(saved)return {ok:true,recorded:true,count:ledger.articles.length};
  }catch(e){return {ok:false,reason:'LEDGER_WRITE_UNAVAILABLE',count:null}}
 }
 return {ok:false,reason:'LEDGER_CAS_CONTENTION',count:null};
}
// Reconcile only a *physically published* R2 article which carries native AI V2
// custom metadata. Cannot invent a publication by passing an arbitrary slug.
export async function reconcileAiV2Publication(env,{slug}={}){
 if(!slugOk(slug)||!env?.CONTENT_FINAL)return {ok:false,reason:'INVALID_RECONCILIATION_REQUEST'};
 let head;
 try{head=await env.CONTENT_FINAL.head('articles/'+slug+'.html')}catch{return {ok:false,reason:'ARTICLE_HEAD_UNAVAILABLE'}}
 if(!head)return {ok:false,reason:'ARTICLE_NOT_FOUND'};
 const meta=head.customMetadata||{};
 if(meta.p!=='ai-v2-native'||meta.status!=='published')return {ok:false,reason:'NOT_VERIFIED_AI_V2_PUBLICATION'};
 const country=meta.c==='AE'?'AE':meta.c==='SA'?'SA':null;
 if(!country)return {ok:false,reason:'UNVERIFIED_ARTICLE_MARKET'};
 const result=await recordAiV2Publication(env,{slug,country,publishedAt:meta.at});
 return {...result,verifiedInR2:true};
}
