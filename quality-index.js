import {signatureDistance} from './quality-audit.js';

const VERSION=2;
const MAX_CLUSTER_ENTRIES=25000;
const MAX_RELATED=6;
const BOOTSTRAP_MAX_DAYS=90;
const STOP=new Set(['من','على','في','الى','إلى','عن','مع','عند','قبل','بعد','نون','السعودية','الامارات','الإمارات','كود','خصم','طريقة','شراء','استخدام','دليل','هل','يعمل']);

const now=()=>new Date().toISOString();
const norm=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const tokens=s=>norm(s).split(' ').filter(x=>x.length>1&&!STOP.has(x));
const h32=s=>{let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function r2getCritical(env,key){
  if(!env?.CONTENT_FINAL)throw new Error('r2_binding_missing');
  let last=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{return await env.CONTENT_FINAL.get(key)}
    catch(e){last=e;if(attempt<3)await sleep(40*attempt)}
  }
  throw last||new Error('r2_get_failed');
}
async function r2putRetry(env,key,value,options){
  if(!env?.CONTENT_FINAL)throw new Error('r2_binding_missing');
  let last=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{return await env.CONTENT_FINAL.put(key,value,options)}
    catch(e){last=e;if(attempt<3)await sleep(60*attempt)}
  }
  throw last||new Error('r2_put_failed');
}

export function keywordSimilarity(a,b){
  const A=new Set(tokens(a)),B=new Set(tokens(b));if(!A.size||!B.size)return 0;
  let hit=0;for(const x of A)if(B.has(x))hit++;
  return hit/Math.max(A.size,B.size);
}

export function intentKey(topic){
  return norm([
    topic?.country,topic?.category,topic?.intent,topic?.useCase,topic?.factor,topic?.scenario,
    topic?.queryModifier,topic?.catalogLevel,topic?.catalogTarget,topic?.brandKey,topic?.modelKey,topic?.comparisonKey
  ].join('|'));
}
export function intentOwnerKey(topic){
  return norm([
    topic?.country,topic?.category,topic?.intent,topic?.useCase,topic?.factor,
    topic?.catalogLevel,topic?.catalogTarget,topic?.brandKey,topic?.modelKey,topic?.comparisonKey
  ].join('|'));
}

export function clusterKey(topic){
  const id=h32(`${topic?.country||'SA'}|${norm(topic?.category||'general')}`).toString(16).padStart(8,'0');
  return `quality/global-index/v${VERSION}/${topic?.country||'SA'}/${id}.json`;
}

export function emptyCluster(topic){return {version:VERSION,country:topic?.country||'SA',category:topic?.category||'',updatedAt:null,entries:[]}}

export async function loadCluster(env,topic,cache=new Map()){
  const key=clusterKey(topic);if(cache.has(key))return cache.get(key);
  let data=emptyCluster(topic);
  const o=await r2getCritical(env,key);if(o)data=await o.json();
  if(!Array.isArray(data.entries))data.entries=[];
  cache.set(key,data);return data;
}

function compactEntry(rec){
  if(!rec?.slug||!rec?.primaryKeyword||!rec?.country||!rec?.category)return null;
  return {slug:rec.slug,title:rec.title||rec.primaryKeyword,primaryKeyword:rec.primaryKeyword,signature:rec.signature||null,country:rec.country,category:rec.category,intent:rec.intent||'',intentLabel:rec.intentLabel||'',intentKey:intentKey(rec),ownerIntentKey:intentOwnerKey(rec),createdAt:rec.createdAt||rec.updatedAt||now()};
}

async function r2json(env,key,fallback){try{const o=await r2getCritical(env,key);return o?await o.json():fallback}catch(e){if(String(e?.message||e)==='r2_binding_missing')throw e;return fallback}}

export async function bootstrapGlobalIndex(env){
  if(!env?.CONTENT_FINAL)return {version:VERSION,complete:false,error:'r2_missing'};
  const manifestKey=`quality/global-index/v${VERSION}/bootstrap.json`;
  const old=await r2json(env,manifestKey,null);
  if(old?.complete&&Number(old.version)===VERSION)return old;
  const daysIndex=await r2json(env,'bulk/days.json',{days:[]});
  const days=(daysIndex.days||[]).slice(0,BOOTSTRAP_MAX_DAYS);
  const groups=new Map();let scanned=0,eligible=0,shardsRead=0;
  for(const d of days){
    const shards=Math.max(0,Number(d.shards||Math.ceil(Number(d.count||0)/100)));
    for(let shard=0;shard<shards;shard++){
      const cat=await r2json(env,`bulk/day/${d.day}/${shard}.json`,{articles:[]});shardsRead++;
      for(const rec of cat.articles||[]){
        scanned++;const entry=compactEntry(rec);if(!entry)continue;eligible++;
        const key=clusterKey(entry);if(!groups.has(key))groups.set(key,{topic:entry,entries:[]});groups.get(key).entries.push(entry);
      }
    }
  }
  let clusterWrites=0,indexed=0;
  for(const [key,g] of groups){
    const existing=await r2json(env,key,emptyCluster(g.topic));
    const seen=new Set(),merged=[];
    for(const e of [...g.entries,...(existing.entries||[])]){if(!e?.slug||seen.has(e.slug))continue;seen.add(e.slug);merged.push(e);if(merged.length>=MAX_CLUSTER_ENTRIES)break}
    existing.version=VERSION;existing.country=g.topic.country;existing.category=g.topic.category;existing.updatedAt=now();existing.entries=merged;
    await r2putRetry(env,key,JSON.stringify(existing),{httpMetadata:{contentType:'application/json; charset=utf-8'}});clusterWrites++;indexed+=g.entries.length;
  }
  const manifest={version:VERSION,complete:true,bootstrappedAt:now(),daysScanned:days.map(x=>x.day),daysAvailable:(daysIndex.days||[]).length,shardsRead,articlesScanned:scanned,eligibleArticles:eligible,indexedArticles:indexed,clusterWrites,maxDays:BOOTSTRAP_MAX_DAYS};
  await r2putRetry(env,manifestKey,JSON.stringify(manifest),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  return manifest;
}

export function preflightGlobalGate(topic,cluster){
  const entries=Array.isArray(cluster?.entries)?cluster.entries:[],kw=norm(topic?.kw||''),slug=String(topic?.slug||''),ik=intentKey(topic),owner=intentOwnerKey(topic);
  let exactKeyword=false,exactSlug=false,intentCollision=false,ownerCollision=false,maxKeywordSimilarity=0,nearest=null;
  for(const e of entries){
    if(!e)continue;
    if(slug&&String(e.slug||'')===slug)exactSlug=true;
    if(kw&&norm(e.primaryKeyword||'')===kw)exactKeyword=true;
    if(e.intentKey&&e.intentKey===ik)intentCollision=true;
    if((e.ownerIntentKey||intentOwnerKey(e))===owner)ownerCollision=true;
    const sameContext=(!e.country||e.country===topic?.country)&&(!e.category||e.category===topic?.category);
    if(sameContext&&(!e.intent||e.intent===topic?.intent)){
      const s=keywordSimilarity(topic?.kw||'',e.primaryKeyword||'');
      if(s>maxKeywordSimilarity){maxKeywordSimilarity=s;nearest=e}
    }
  }
  const cannibalization=maxKeywordSimilarity>=0.78,reasons=[];
  if(exactSlug)reasons.push('global_duplicate_slug');
  if(exactKeyword)reasons.push('global_duplicate_keyword');
  if(intentCollision)reasons.push('global_duplicate_intent');
  if(ownerCollision)reasons.push('global_intent_owner_collision');
  if(cannibalization)reasons.push('global_keyword_cannibalization');
  return {pass:reasons.length===0,reasons,maxKeywordSimilarity:Math.round(maxKeywordSimilarity*1000)/1000,nearestSlug:nearest?.slug||null,indexSize:entries.length,intentKey:ik,ownerIntentKey:owner,stage:'preflight'};
}

export function globalGate(article,topic,audit,cluster){
  const entries=Array.isArray(cluster?.entries)?cluster.entries:[],kw=norm(article?.primaryKeyword||topic?.kw||''),slug=String(article?.slug||''),ik=intentKey(topic),owner=intentOwnerKey(topic);
  let exactKeyword=false,exactSlug=false,intentCollision=false,ownerCollision=false,maxKeywordSimilarity=0,minDistance=32,nearest=null;
  for(const e of entries){
    if(!e)continue;
    if(String(e.slug||'')===slug)exactSlug=true;
    if(norm(e.primaryKeyword||'')===kw)exactKeyword=true;
    if(e.intentKey&&e.intentKey===ik)intentCollision=true;
    if((e.ownerIntentKey||intentOwnerKey(e))===owner)ownerCollision=true;
    const sameContext=(!e.country||e.country===topic?.country)&&(!e.category||e.category===topic?.category);
    if(sameContext&&(!e.intent||e.intent===topic?.intent)){const s=keywordSimilarity(article?.primaryKeyword||topic?.kw,e.primaryKeyword||'');if(s>maxKeywordSimilarity){maxKeywordSimilarity=s;nearest=e}}
    if(sameContext&&(!e.intent||e.intent===topic?.intent)&&e.signature&&audit?.signature){const d=signatureDistance(audit.signature,e.signature);if(d<minDistance){minDistance=d;nearest=e}}
  }
  const semanticCollision=minDistance<6;
  const cannibalization=maxKeywordSimilarity>=0.78;
  const reasons=[];
  if(exactSlug)reasons.push('global_duplicate_slug');
  if(exactKeyword)reasons.push('global_duplicate_keyword');
  if(intentCollision)reasons.push('global_duplicate_intent');
  if(ownerCollision)reasons.push('global_intent_owner_collision');
  if(semanticCollision)reasons.push('global_semantic_collision');
  if(cannibalization)reasons.push('global_keyword_cannibalization');
  return {pass:reasons.length===0,reasons,minDistance,maxKeywordSimilarity:Math.round(maxKeywordSimilarity*1000)/1000,nearestSlug:nearest?.slug||null,indexSize:entries.length,intentKey:ik,ownerIntentKey:owner};
}

function relatedScore(topic,entry){
  let s=0;if(entry.country===topic?.country)s+=4;if(entry.category===topic?.category)s+=5;if(entry.intent&&entry.intent!==topic?.intent)s+=2;
  s+=Math.round(keywordSimilarity(topic?.kw||'',entry.primaryKeyword||'')*5);
  return s;
}

export function pickRelated(cluster,topic,limit=MAX_RELATED){
  const owner=intentOwnerKey(topic);
  return (cluster?.entries||[])
    .filter(e=>e?.slug&&e.primaryKeyword&&e.country===topic?.country&&(e.ownerIntentKey||intentOwnerKey(e))!==owner)
    .map(e=>({...e,_score:relatedScore(topic,e)}))
    .filter(e=>e._score>=5)
    .sort((a,b)=>b._score-a._score||String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
    .slice(0,Math.max(0,limit));
}

export function injectContextualLinks(article,links=[]){
  if(!article?.html||!links.length)return article;
  const items=links.map(x=>`<li><a href="/articles/${encodeURI(x.slug)}">${esc(x.title||x.primaryKeyword)}</a><span> — ${esc(x.intentLabel||'دليل مرتبط')}</span></li>`).join('');
  const section=`<section class="contextual-links"><h2>أدلة مرتبطة تساعدك في القرار</h2><p>اختر الدليل الأقرب لمرحلة قرارك بدل تكرار نفس الخطوات في أكثر من صفحة.</p><ul>${items}</ul></section>`;
  article.html=String(article.html).replace(/<section class="methodology accountability">/i,section+'<section class="methodology accountability">');
  article.contextualLinks=links.map(x=>({slug:x.slug,title:x.title||x.primaryKeyword}));
  return article;
}

export function addToCluster(cluster,rec,topic){
  const entry={slug:rec.slug,title:rec.title,primaryKeyword:rec.primaryKeyword,signature:rec.signature,country:rec.country,category:topic?.category||'',intent:topic?.intent||'',intentLabel:topic?.intentLabel||'',intentKey:intentKey(topic),ownerIntentKey:intentOwnerKey(topic),createdAt:rec.createdAt||now()};
  const entries=[entry,...(cluster.entries||[]).filter(x=>x?.slug!==entry.slug)].slice(0,MAX_CLUSTER_ENTRIES);
  cluster.version=VERSION;cluster.country=topic?.country||rec.country;cluster.category=topic?.category||cluster.category||'';cluster.updatedAt=now();cluster.entries=entries;return cluster;
}

export async function flushClusters(env,cache,dirtyKeys){
  if(!env?.CONTENT_FINAL)return;
  const rows=[...dirtyKeys].map(key=>[key,cache.get(key)]).filter(([,value])=>Boolean(value));
  for(let i=0;i<rows.length;i+=16){
    await Promise.all(rows.slice(i,i+16).map(([key,value])=>r2putRetry(env,key,JSON.stringify(value),{httpMetadata:{contentType:'application/json; charset=utf-8'}})));
  }
}

export const GLOBAL_INDEX_INFO={version:VERSION,intentKeyVersion:3,intentOwnerVersion:1,intentKeyDimensions:['country','category','intent','useCase','factor','scenario','queryModifier','catalogLevel','catalogTarget','brandKey','modelKey','comparisonKey'],intentOwnerDimensions:['country','category','intent','useCase','factor','catalogLevel','catalogTarget','brandKey','modelKey','comparisonKey'],maxClusterEntries:MAX_CLUSTER_ENTRIES,semanticDistanceMin:6,cannibalizationSimilarityMax:0.78,relatedLinksMax:MAX_RELATED,bootstrapMaxDays:BOOTSTRAP_MAX_DAYS,clusterWriteConcurrency:16,r2ReadRetry:3,r2WriteRetry:3,failClosedOnClusterRead:true,preflightGate:true,preflightChecks:['duplicate-slug','duplicate-keyword','duplicate-intent','intent-owner-collision','keyword-cannibalization']};
