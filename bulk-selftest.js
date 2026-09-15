import {buildBulkTopic,buildUsefulArticle,BULK_ENGINE_INFO} from './bulk-generator.js';
import {auditSeoArticle} from './quality-audit.js';

const cfg={minWords:1000,qualityThreshold:95,targetWords:1500};
const recent=[];
let ready=0,rejected=0,minScore=100,maxScore=0,minWords=99999,maxWords=0;
const groupMins={};

for(let n=0;n<40;n++){
  const cursor=500000+n;
  const topic=buildBulkTopic(cursor);
  const article=buildUsefulArticle(topic,cursor);
  const audit=auditSeoArticle(article,topic,{...cfg,recent});
  const row={cursor,country:topic.country,category:topic.category,intent:topic.intent,keyword:topic.kw,score:audit.score,floor:audit.groupFloor,wordCount:audit.wordCount,productionReady:audit.productionReady,p0:audit.p0,failed:audit.failed,minSignatureDistance:audit.minSignatureDistance,groups:audit.groups};
  console.log(JSON.stringify(row));
  if(audit.productionReady){
    ready++;
    minScore=Math.min(minScore,audit.score);maxScore=Math.max(maxScore,audit.score);
    minWords=Math.min(minWords,audit.wordCount);maxWords=Math.max(maxWords,audit.wordCount);
    if(audit.score<95||audit.groupFloor<88||audit.p0.length||audit.wordCount<1000||audit.wordCount>2000)throw new Error('production_ready_invariant_failed:'+JSON.stringify(row));
    for(const [g,v] of Object.entries(audit.groups))groupMins[g]=Math.min(groupMins[g]??100,v);
    recent.unshift({slug:article.slug,primaryKeyword:article.primaryKeyword,signature:audit.signature,blueprint:article.blueprint});
    if(recent.length>120)recent.pop();
  }else{
    rejected++;
    if(!audit.failed.length)throw new Error('rejected_without_reason:'+cursor);
  }
}

console.log(JSON.stringify({engine:BULK_ENGINE_INFO,ready,rejected,minScore,maxScore,minWords,maxWords,groupMins},null,2));
if(BULK_ENGINE_INFO.topicSpace<1000000)throw new Error('topic_space_too_small');
if(BULK_ENGINE_INFO.blueprints<10)throw new Error('blueprint_diversity_too_small');
if(ready<28)throw new Error('too_few_quality_articles:'+ready);
if(minScore<95)throw new Error('score_below_95:'+minScore);
if(Math.min(...Object.values(groupMins))<88)throw new Error('group_floor_below_88');
console.log(`READY_COUNT=${ready}/40 REJECTED=${rejected} MIN_SCORE=${minScore} MAX_SCORE=${maxScore} WORDS=${minWords}-${maxWords}`);
