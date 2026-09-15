import {buildBulkTopic,buildUsefulArticle,BULK_ENGINE_INFO} from './bulk-content-engine.js';
import {auditSeoArticle,auditSummary} from './quality-audit.js';

const now=()=>new Date().toISOString();
const enc=s=>encodeURIComponent(String(s||'')).slice(0,1800);
const MAX_LATEST=300;
const SHARD_SIZE=100;
const V2_CURSOR_START=500000;

async function readJson(env,key,fallback){
  try{const o=await env.CONTENT_FINAL.get(key);return o?await o.json():fallback}catch{return fallback}
}

async function writeCatalogs(env,day,countBefore,records){
  if(!records.length)return;
  const latest=await readJson(env,'bulk/latest.json',{version:2,articles:[]});
  const seen=new Set(records.map(r=>r.slug));
  const merged=[...records.slice().reverse(),...(latest.articles||[]).filter(r=>!seen.has(r.slug))].slice(0,MAX_LATEST);
  await env.CONTENT_FINAL.put('bulk/latest.json',JSON.stringify({version:2,engine:BULK_ENGINE_INFO.version,updatedAt:now(),articles:merged}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});

  const groups=new Map();
  records.forEach((r,i)=>{const shard=Math.floor((countBefore+i)/SHARD_SIZE);if(!groups.has(shard))groups.set(shard,[]);groups.get(shard).push(r)});
  for(const [shard,items] of groups){
    const key=`bulk/day/${day}/${shard}.json`;
    const current=await readJson(env,key,{version:2,day,shard,articles:[]});
    const have=new Set((current.articles||[]).map(r=>r.slug));
    const articles=[...(current.articles||[]),...items.filter(r=>!have.has(r.slug))];
    await env.CONTENT_FINAL.put(key,JSON.stringify({version:2,engine:BULK_ENGINE_INFO.version,day,shard,updatedAt:now(),articles}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
  }

  const days=await readJson(env,'bulk/days.json',{version:2,days:[]});
  const newCount=countBefore+records.length;
  const row={day,count:newCount,shards:Math.ceil(newCount/SHARD_SIZE),engine:BULK_ENGINE_INFO.version,updatedAt:now()};
  const next=[row,...(days.days||[]).filter(x=>x.day!==day)].sort((a,b)=>String(b.day).localeCompare(String(a.day))).slice(0,3650);
  await env.CONTENT_FINAL.put('bulk/days.json',JSON.stringify({version:2,updatedAt:now(),days:next}),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
}

export async function runProgrammaticBatch(env,cfg,status,{dailyTarget=2000,batchSize=2}={}){
  if(!env.CONTENT_FINAL)return {ok:false,error:'r2_binding_missing',patch:{bulkLastError:'r2_binding_missing',bulkLastRun:now()}};
  const day=now().slice(0,10),countBefore=String(status.bulkDay||'')===day?Math.max(0,Number(status.bulkPublishedToday||0)):0,target=Math.max(0,Math.min(5000,Number(dailyTarget??2000))),batch=Math.max(1,Math.min(5,Number(batchSize||2)));
  if(target===0)return {ok:true,skipped:'bulk_paused',records:[],patch:{bulkDay:day,bulkPublishedToday:countBefore,bulkDailyTarget:0,bulkLastRun:now(),bulkLastError:null,bulkEngine:BULK_ENGINE_INFO.version}};
  if(countBefore>=target)return {ok:true,skipped:'daily_target_reached',records:[],patch:{bulkDay:day,bulkPublishedToday:countBefore,bulkDailyTarget:target,bulkLastRun:now(),bulkLastError:null,bulkEngine:BULK_ENGINE_INFO.version}};

  const latest=await readJson(env,'bulk/latest.json',{articles:[]});
  const recent=[...(latest.articles||[])].slice(0,120);
  let cursor=Math.max(V2_CURSOR_START,Number(status.bulkCursorV2||0)),tries=0,rejectedQuality=0,rejectedDuplicate=0;
  const records=[];
  while(records.length<batch&&countBefore+records.length<target&&tries<batch*14){
    const currentCursor=cursor++;
    tries++;
    const topic=buildBulkTopic(currentCursor),article=buildUsefulArticle(topic,currentCursor);
    const audit=auditSeoArticle(article,topic,{...cfg,minWords:Math.max(1000,Number(cfg.minWords||1000)),threshold:Math.max(95,Number(cfg.qualityThreshold||95)),recent});
    if(!audit.productionReady){rejectedQuality++;continue}
    const key='articles/'+article.slug+'.html';
    if(await env.CONTENT_FINAL.head(key)){rejectedDuplicate++;continue}
    const createdAt=now(),summary=auditSummary(audit);
    const rec={slug:article.slug,title:article.title,metaDescription:article.metaDescription,country:topic.country,coupon:topic.code,status:'published',createdAt,updatedAt:createdAt,quality:audit.score,qualityGroups:audit.groups,qualityFloor:audit.groupFloor,qualityChecks:audit.measuredChecks,provider:BULK_ENGINE_INFO.version,primaryKeyword:topic.kw,wordCount:audit.wordCount,signature:audit.signature,blueprint:article.blueprint,topicIndex:topic.topicIndex,contentPolicy:'helpful-quality-first',p0:[],auditSummary:summary};
    await env.CONTENT_FINAL.put(key,String(article.html||''),{
      httpMetadata:{contentType:'text/html; charset=utf-8'},
      customMetadata:{t:enc(rec.title),m:enc(rec.metaDescription),c:rec.country,cp:rec.coupon,q:String(rec.quality),qf:String(rec.qualityFloor),qc:String(rec.qualityChecks),p:rec.provider,kw:enc(rec.primaryKeyword),sig:rec.signature,bp:String(rec.blueprint),at:createdAt,status:'published'}
    });
    records.push(rec);
    recent.unshift(rec);if(recent.length>120)recent.pop();
  }
  await writeCatalogs(env,day,countBefore,records);
  const total=Math.max(0,Number(status.bulkPublishedTotal||0))+records.length,last=records.at(-1)||null;
  const patch={bulkDay:day,bulkPublishedToday:countBefore+records.length,bulkPublishedTotal:total,bulkDailyTarget:target,bulkCursorV2:cursor,bulkLastRun:now(),bulkLastError:records.length?'':(countBefore>=target?null:'quality_gate_no_article_passed'),bulkLastSlug:last?.slug||status.bulkLastSlug||null,bulkLastQuality:last?.quality??status.bulkLastQuality??null,bulkLastQualityFloor:last?.qualityFloor??status.bulkLastQualityFloor??null,bulkLastWordCount:last?.wordCount??status.bulkLastWordCount??null,bulkLastGroups:last?.qualityGroups||status.bulkLastGroups||null,bulkLastSignature:last?.signature||status.bulkLastSignature||null,bulkEngine:BULK_ENGINE_INFO.version,bulkRejectedQuality:Number(status.bulkRejectedQuality||0)+rejectedQuality,bulkRejectedDuplicate:Number(status.bulkRejectedDuplicate||0)+rejectedDuplicate};
  return {ok:true,engine:BULK_ENGINE_INFO.version,records,tries,rejectedQuality,rejectedDuplicate,patch};
}

export {buildBulkTopic,buildUsefulArticle,BULK_ENGINE_INFO};
