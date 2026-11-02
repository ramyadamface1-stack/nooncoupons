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

// Public-facing freshness is portfolio-wide; preserve legacy generation's
// own rescue state separately so active legacy Cron controls are unaffected.
export function combineGenerationFreshness(snapshot,ledgerRead,atMs=Date.now()){
 const entries=ledgerRead?.ok?ledgerRead.ledger.articles:[];
 const nativeCount=ledgerRead?.ok?ledgerRead.count:null;
 const aiTime=entries.reduce((latest,a)=>a.publishedAt>latest?a.publishedAt:latest,'');
 const aiMs=Date.parse(aiTime);
 const legacyMs=Date.parse(String(snapshot?.lastSuccessfulPublishAt||''));
 const aiValid=Number.isFinite(aiMs),legacyValid=Number.isFinite(legacyMs);
 const newest=aiValid&&(!legacyValid||aiMs>legacyMs)?aiMs:legacyMs;
 const known=Number.isFinite(newest);
 const elapsed=known?Math.max(0,atMs-newest):null;
 return {...snapshot,
   legacyLastSuccessfulPublishAt:snapshot?.lastSuccessfulPublishAt||null,
   legacyMinutesSinceLastSuccessfulPublish:snapshot?.minutesSinceLastSuccessfulPublish??null,
   legacyRescueDue:Boolean(snapshot?.rescueDue),
   lastSuccessfulPublishAt:known?new Date(newest).toISOString():null,
   lastSuccessfulPublishSource:known&&(aiValid&&newest===aiMs)?'ai-v2-native':'legacy',
   minutesSinceLastSuccessfulPublish:elapsed==null?null:Math.round(elapsed/6000)/10,
   withinOneHour:elapsed!=null&&elapsed<3600000,
   aiV2PublishedCount:nativeCount,
   aiV2LastPublishedAt:aiValid?new Date(aiMs).toISOString():null,
   aiV2PublishedLast24Hours:ledgerRead?.ok?entries.filter(x=>Number.isFinite(Date.parse(x.publishedAt))&&atMs-Date.parse(x.publishedAt)>=0&&atMs-Date.parse(x.publishedAt)<86400000).length:null
 };
}

export function aiV2PublicationWindows(ledgerRead,atMs=Date.now()){
 if(!ledgerRead?.ok||!Array.isArray(ledgerRead.ledger?.articles))
  return {available:false,reason:ledgerRead?.reason||'LEDGER_UNAVAILABLE'};
 const data=ledgerRead.ledger.articles;
 const durations=[1,2,6,24],windows={};
 for(const h of durations){
  const byMarket={SA:0,AE:0};
  for(const a of data){
   const timestamp=Date.parse(a.publishedAt),age=atMs-timestamp;
   if(Number.isFinite(timestamp)&&age>=0&&age<h*3600000&&['SA','AE'].includes(a.country))byMarket[a.country]++;
  }
  windows[h+'h']={total:byMarket.SA+byMarket.AE,...byMarket};
 }
 const newest=[...data].sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt)))[0]||null;
 return {available:true,total:data.length,windows,lastArticle:newest?
  {slug:newest.slug,country:newest.country,publishedAt:newest.publishedAt}:null};
}
