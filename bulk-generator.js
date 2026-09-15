import {buildBulkTopic,buildUsefulArticle,BULK_ENGINE_INFO} from './bulk-content-engine.js';
import {auditSeoArticle,auditSummary} from './quality-audit.js';
import {loadCluster,globalGate,pickRelated,injectContextualLinks,addToCluster,flushClusters,clusterKey,GLOBAL_INDEX_INFO} from './quality-index.js';
import {couponStatus,injectCouponFreshness,writeCouponFreshnessSnapshot,COUPON_REGISTRY_INFO} from './coupon-registry.js';
import {validateStructuredData,SCHEMA_GATE_INFO} from './schema-validator.js';

const now=()=>new Date().toISOString();
const enc=s=>encodeURIComponent(String(s||'')).slice(0,1800);
const MAX_LATEST=300;
const SHARD_SIZE=100;
const V2_CURSOR_START=500000;
const AUTO_BRAKE_AFTER=5;
const AUTO_BRAKE_MS=10*60*1000;

async function readJson(env,key,fallback){
  try{const o=await env.CONTENT_FINAL.get(key);return o?await o.json():fallback}catch{return fallback}
}

function dedupeRecent(items){
  const seen=new Set(),out=[];
  for(const x of items||[]){if(!x?.slug||seen.has(x.slug))continue;seen.add(x.slug);out.push(x)}
  return out;
}

async function writeCatalogs(env,day,countBefore,records){
  if(!records.length)return;
  const latest=await readJson(env,'bulk/latest.json',{version:2,articles:[]});
  const seen=new Set(records.map(r=>r.slug));
  const merged=[...records.slice().reverse(),...(latest.articles||[]).filter(r=>!seen.has(r.slug))].slice(0,MAX_LATEST);
  await env.CONTENT_FINAL.put('bulk/latest.json',JSON.stringify({version:2,engine:BULK_ENGINE_INFO.version,qualityLayer:'global-quality-v1',updatedAt:now(),articles:merged}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});

  const groups=new Map();
  records.forEach((r,i)=>{const shard=Math.floor((countBefore+i)/SHARD_SIZE);if(!groups.has(shard))groups.set(shard,[]);groups.get(shard).push(r)});
  for(const [shard,items] of groups){
    const key=`bulk/day/${day}/${shard}.json`;
    const current=await readJson(env,key,{version:2,day,shard,articles:[]});
    const have=new Set((current.articles||[]).map(r=>r.slug));
    const articles=[...(current.articles||[]),...items.filter(r=>!have.has(r.slug))];
    await env.CONTENT_FINAL.put(key,JSON.stringify({version:2,engine:BULK_ENGINE_INFO.version,qualityLayer:'global-quality-v1',day,shard,updatedAt:now(),articles}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  }

  const days=await readJson(env,'bulk/days.json',{version:2,days:[]});
  const newCount=countBefore+records.length;
  const row={day,count:newCount,shards:Math.ceil(newCount/SHARD_SIZE),engine:BULK_ENGINE_INFO.version,qualityLayer:'global-quality-v1',updatedAt:now()};
  const next=[row,...(days.days||[]).filter(x=>x.day!==day)].sort((a,b)=>String(b.day).localeCompare(String(a.day))).slice(0,3650);
  await env.CONTENT_FINAL.put('bulk/days.json',JSON.stringify({version:2,updatedAt:now(),days:next}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
}

export async function runProgrammaticBatch(env,cfg,status,{dailyTarget=2000,batchSize=2}={}){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing',patch:{bulkLastError:'r2_binding_missing',bulkLastRun:now()}};
  const pauseUntil=Date.parse(status.bulkAutoPauseUntil||'');
  if(Number.isFinite(pauseUntil)&&pauseUntil>Date.now())return {ok:true,skipped:'bulk_auto_brake',records:[],patch:{bulkLastRun:now(),bulkLastError:null,bulkAutoPauseUntil:status.bulkAutoPauseUntil,bulkNoPassStreak:Number(status.bulkNoPassStreak||0)}};

  const day=now().slice(0,10),countBefore=String(status.bulkDay||'')===day?Math.max(0,Number(status.bulkPublishedToday||0)):0,target=Math.max(0,Math.min(5000,Number(dailyTarget??2000))),batch=Math.max(1,Math.min(5,Number(batchSize||2)));
  if(target===0)return {ok:true,skipped:'bulk_paused',records:[],patch:{bulkDay:day,bulkPublishedToday:countBefore,bulkDailyTarget:0,bulkLastRun:now(),bulkLastError:null,bulkEngine:BULK_ENGINE_INFO.version}};
  if(countBefore>=target)return {ok:true,skipped:'daily_target_reached',records:[],patch:{bulkDay:day,bulkPublishedToday:countBefore,bulkDailyTarget:target,bulkLastRun:now(),bulkLastError:null,bulkEngine:BULK_ENGINE_INFO.version}};

  const latest=await readJson(env,'bulk/latest.json',{articles:[]});
  const latestRecent=[...(latest.articles||[])].slice(0,300);
  const clusterCache=new Map(),dirtyKeys=new Set();
  let cursor=Math.max(V2_CURSOR_START,Number(status.bulkCursorV2||0)),tries=0,rejectedQuality=0,rejectedDuplicate=0,rejectedGlobal=0,rejectedCoupon=0,rejectedLinks=0,rejectedSchema=0;
  const records=[];
  while(records.length<batch&&countBefore+records.length<target&&tries<batch*18){
    const currentCursor=cursor++;
    tries++;
    const topic=buildBulkTopic(currentCursor),coupon=couponStatus(topic);
    if(!coupon.publishAllowed){rejectedCoupon++;continue}

    const cluster=await loadCluster(env,topic,clusterCache);
    const relatedPool={entries:dedupeRecent([...(cluster.entries||[]),...latestRecent])};
    const links=pickRelated(relatedPool,topic,6);
    if((cluster.entries||[]).length>=4&&links.length<2){rejectedLinks++;continue}

    let article=buildUsefulArticle(topic,currentCursor);
    article=injectCouponFreshness(article,coupon);
    article=injectContextualLinks(article,links);
    const schemaGate=validateStructuredData(article);
    if(!schemaGate.pass){rejectedSchema++;continue}

    const auditRecent=dedupeRecent([...(cluster.entries||[]),...latestRecent]).slice(0,25000);
    const audit=auditSeoArticle(article,topic,{...cfg,minWords:Math.max(1000,Number(cfg.minWords||1000)),threshold:Math.max(95,Number(cfg.qualityThreshold||95)),recent:auditRecent});
    if(!audit.productionReady){rejectedQuality++;continue}

    const gg=globalGate(article,topic,audit,{entries:auditRecent});
    if(!gg.pass){rejectedGlobal++;continue}

    const key='articles/'+article.slug+'.html';
    if(await env.CONTENT_FINAL.head(key)){rejectedDuplicate++;continue}

    const createdAt=now(),summary=auditSummary(audit);
    const rec={
      slug:article.slug,title:article.title,metaDescription:article.metaDescription,country:topic.country,coupon:topic.code,status:'published',createdAt,updatedAt:createdAt,
      quality:audit.score,qualityGroups:audit.groups,qualityFloor:audit.groupFloor,qualityChecks:audit.measuredChecks,provider:BULK_ENGINE_INFO.version,
      primaryKeyword:topic.kw,wordCount:audit.wordCount,signature:audit.signature,blueprint:article.blueprint,topicIndex:topic.topicIndex,
      category:topic.category,profileKey:topic.profileKey,intent:topic.intent,intentLabel:topic.intentLabel,useCase:topic.useCase,factor:topic.factor,scenario:topic.scenario,
      contentPolicy:'helpful-quality-first-global',p0:[],auditSummary:summary,
      globalQuality:{indexVersion:GLOBAL_INDEX_INFO.version,clusterKey:clusterKey(topic),indexSizeBefore:gg.indexSize,minDistance:gg.minDistance,maxKeywordSimilarity:gg.maxKeywordSimilarity,intentKey:gg.intentKey},
      contextualLinks:(article.contextualLinks||[]).map(x=>x.slug),
      couponFreshness:{state:coupon.state,evidence:coupon.evidence,officialVerified:coupon.officialVerified,catalogUpdatedAt:coupon.catalogUpdatedAt,reviewDueAt:coupon.reviewDueAt,publishBlockAt:coupon.publishBlockAt,registryVersion:COUPON_REGISTRY_INFO.version},
      schemaGate:{version:SCHEMA_GATE_INFO.version,blocks:schemaGate.blocks,nodes:schemaGate.nodes,faqQuestions:schemaGate.faqQuestions}
    };

    await env.CONTENT_FINAL.put(key,String(article.html||''),{
      httpMetadata:{contentType:'text/html; charset=utf-8'},
      customMetadata:{t:enc(rec.title),m:enc(rec.metaDescription),c:rec.country,cp:rec.coupon,q:String(rec.quality),qf:String(rec.qualityFloor),qc:String(rec.qualityChecks),p:rec.provider,kw:enc(rec.primaryKeyword),sig:rec.signature,bp:String(rec.blueprint),at:createdAt,status:'published',qv:'global-quality-v1',cf:coupon.state,sg:String(SCHEMA_GATE_INFO.version)}
    });
    records.push(rec);
    addToCluster(cluster,rec,topic);dirtyKeys.add(clusterKey(topic));
    latestRecent.unshift(rec);if(latestRecent.length>300)latestRecent.pop();
  }

  await flushClusters(env,clusterCache,dirtyKeys);
  let freshnessSnapshot=null;
  if(records.length)freshnessSnapshot=await writeCouponFreshnessSnapshot(env,new Date());
  await writeCatalogs(env,day,countBefore,records);
  const total=Math.max(0,Number(status.bulkPublishedTotal||0))+records.length,last=records.at(-1)||null;
  const noPassStreak=records.length?0:Number(status.bulkNoPassStreak||0)+1;
  const autoPauseUntil=!records.length&&noPassStreak>=AUTO_BRAKE_AFTER?new Date(Date.now()+AUTO_BRAKE_MS).toISOString():null;
  const patch={
    bulkDay:day,bulkPublishedToday:countBefore+records.length,bulkPublishedTotal:total,bulkDailyTarget:target,bulkCursorV2:cursor,bulkLastRun:now(),
    bulkLastError:records.length?'':(autoPauseUntil?'bulk_auto_brake_engaged':'quality_gate_no_article_passed'),bulkLastSlug:last?.slug||status.bulkLastSlug||null,
    bulkLastQuality:last?.quality??status.bulkLastQuality??null,bulkLastQualityFloor:last?.qualityFloor??status.bulkLastQualityFloor??null,bulkLastWordCount:last?.wordCount??status.bulkLastWordCount??null,
    bulkLastGroups:last?.qualityGroups||status.bulkLastGroups||null,bulkLastSignature:last?.signature||status.bulkLastSignature||null,bulkEngine:BULK_ENGINE_INFO.version,
    bulkQualityLayer:'global-quality-v1',bulkGlobalIndexVersion:GLOBAL_INDEX_INFO.version,bulkCouponRegistryVersion:COUPON_REGISTRY_INFO.version,bulkSchemaGateVersion:SCHEMA_GATE_INFO.version,
    bulkFreshnessPublishable:freshnessSnapshot?.publishable??status.bulkFreshnessPublishable??null,bulkFreshnessReviewDue:freshnessSnapshot?.reviewDue??status.bulkFreshnessReviewDue??null,bulkFreshnessBlocked:freshnessSnapshot?.blocked??status.bulkFreshnessBlocked??null,
    bulkLastContextualLinks:last?.contextualLinks?.length??status.bulkLastContextualLinks??null,bulkLastCouponFreshness:last?.couponFreshness?.state||status.bulkLastCouponFreshness||null,
    bulkNoPassStreak:noPassStreak,bulkAutoPauseUntil:autoPauseUntil,
    bulkRejectedQuality:Number(status.bulkRejectedQuality||0)+rejectedQuality,bulkRejectedDuplicate:Number(status.bulkRejectedDuplicate||0)+rejectedDuplicate,
    bulkRejectedGlobal:Number(status.bulkRejectedGlobal||0)+rejectedGlobal,bulkRejectedCoupon:Number(status.bulkRejectedCoupon||0)+rejectedCoupon,bulkRejectedLinks:Number(status.bulkRejectedLinks||0)+rejectedLinks,bulkRejectedSchema:Number(status.bulkRejectedSchema||0)+rejectedSchema
  };
  return {ok:true,engine:BULK_ENGINE_INFO.version,qualityLayer:'global-quality-v1',records,tries,rejectedQuality,rejectedDuplicate,rejectedGlobal,rejectedCoupon,rejectedLinks,rejectedSchema,freshnessSnapshot,patch};
}

export {buildBulkTopic,buildUsefulArticle,BULK_ENGINE_INFO,GLOBAL_INDEX_INFO,COUPON_REGISTRY_INFO,SCHEMA_GATE_INFO};
