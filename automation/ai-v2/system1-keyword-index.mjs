// Keyword inventory from the *real* NoonDealsNow GitHub runner queue.
// No GSC/demand metrics invented and no provider calls. Source-only insight:
// these topics are already in the runner, not newly created pending articles.
import {readFileSync} from 'node:fs';
import {expandedEditorialTopics} from './topic-expansion.mjs';
import {newEditorialTopicWave} from './topic-refresh.mjs';
import {thirdEditorialTopicWave} from './topic-refresh-n3.mjs';
import {fourthEditorialTopicWave} from './topic-refresh-n4.mjs';
import {fifthEditorialTopicWave} from './topic-refresh-n5.mjs';
import {sixthEditorialTopicWave} from './topic-refresh-n6.mjs';
import {seventhEditorialTopicWave} from './topic-refresh-n7.mjs';

export const INTENT_WEIGHTS=Object.freeze({
  purchase:25,relevance:20,contentGap:20,verifiedDemand:15,seasonality:10,internalLinks:10
});
export function system1ScoreTopic(topic){
  if(!topic||!['SA','AE'].includes(topic.country)||typeof topic.topic!=='string')
    return null;
  // Only observed relevance & intent are scored. A content gap needs index
  // inspection; GSC demand needs a first-party GSC source; these are unknown.
  const text=[topic.topic,topic.category].join(' ');
  const commerce=/(شراء|قارن|مقارنة|طلب|compare|before ordering|buy|price|seller|warranty|delivery|coupon|كوبون|ضمان|شحن)/i.test(text);
  const season=/(رمضان|black friday|white friday|11.11|العيد|ramadan|eid|back.to.school)/i.test(text);
  const breakdown={
    purchaseIntent:commerce?25:0,
    siteRelevance:20,
    contentGap:null,verifiedDemand:null,
    seasonality:season?10:0,internalLinkCoverage:null
  };
  return {scoreKnown:breakdown.purchaseIntent+breakdown.siteRelevance+breakdown.seasonality,
    scoreOutOf:100,measured:false,missingComponents:['contentGap','verifiedDemand','internalLinkCoverage'],
    breakdown};
}
export function assembleSystem1KeywordIndex(input,{limitPerCountry=120,now=new Date().toISOString()}={}){
 if(!Array.isArray(input)||!Number.isInteger(limitPerCountry)||limitPerCountry<1||limitPerCountry>500)
   throw Error('INVALID_KEYWORD_INDEX_INPUT');
 const seen=new Set(),all=[];
 for(const topic of input){
   if(!topic||!['SA','AE'].includes(topic.country)||typeof topic.slug!=='string'||
      !/^[a-z0-9-]{16,120}$/.test(topic.slug)||typeof topic.topic!=='string'||
      topic.topic.trim().length<12)continue;
   const key=topic.country+':'+topic.slug;
   if(seen.has(key))continue;
   seen.add(key);
   const score=system1ScoreTopic(topic);
   all.push({keyword:topic.topic.slice(0,200),variants:[],
     intent:score.breakdown.purchaseIntent?'شراء أو مقارنة':'معلوماتي غير محسوم',
     country:topic.country,language:topic.language||(topic.country==='SA'?'ar-SA':'en-AE'),
     brand:String(topic.brand||'').slice(0,70),product:null,
     category:String(topic.category||'').slice(0,100),season:null,
     slug:topic.slug,source:'curated_github_runner_queue',
     confidence:'editorial_curated_demand_unknown',priority:score.scoreKnown,
     priorityStatus:'partial_no_demand_or_gap_evidence',status:'ALREADY_IN_RUNNER_QUEUE',
     discovered_at:null,target_article_id:null});
 }
 // Keep a diverse, representative sample: latest curated wave first, preserving
 // a stable sample among each market, never claiming these are newly discovered.
 const selected=[];
 for(const market of ['SA','AE']){
  const slice=all.filter(x=>x.country===market);
  const picks=slice.slice(-limitPerCountry).reverse();
  selected.push(...picks);
 }
 return {version:1,site:'noondealsnow',generatedAt:now,total:all.length,items:selected,
   source:'curated_github_runner_queue',demandMeasured:false,
   canDirectlyApproveOrIgnore:false,publishedOrReadyStatusMeasured:false,
   note:'existing compiled topic queue only; the live checkpoint status of each topic is not checked here'};
}
export function buildFromProject(){
 const base=JSON.parse(readFileSync(new URL('./topics.json',import.meta.url)));
 return assembleSystem1KeywordIndex([...base,...expandedEditorialTopics,...newEditorialTopicWave,
  ...thirdEditorialTopicWave,...fourthEditorialTopicWave,...fifthEditorialTopicWave,
  ...sixthEditorialTopicWave,...seventhEditorialTopicWave]);
}
