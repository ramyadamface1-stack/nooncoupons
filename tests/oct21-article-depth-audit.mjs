import {buildBulkTopic,buildUsefulArticle,BULK_ENGINE_INFO} from '../bulk-content-engine.js';
import {auditSeoArticle,preAuditSemanticGate} from '../quality-audit.js';
import {couponStatus} from '../coupon-registry.js';
import {evaluateSearchDemandPolicy} from '../search-demand-policy.js';
import {chooseBulkCandidateTopicSeed} from '../bulk-candidate-diversity.js';
const cursor=12738411,scope=100,wordCounts=[],samples=[],reasons={},uniqueSlugs=new Set(),signatures=new Set();
for(let n=0;n<scope;n++){
  const index=cursor+n,seed=chooseBulkCandidateTopicSeed(index,n+1,{lowYield:true,topicSpace:BULK_ENGINE_INFO.topicSpace});
  const topic=buildBulkTopic(seed),demand=evaluateSearchDemandPolicy(topic),coupon=couponStatus(topic,new Date('2026-10-21T16:55:00Z'));
  if(!coupon.publishAllowed||!demand.createStandalone)continue;
  const article=buildUsefulArticle(topic,index),audit=auditSeoArticle(article,topic,{minWords:1500,qualityThreshold:95,recent:[],semanticRecent:[]});
  wordCounts.push(audit.wordCount);
  for(const reason of [...(audit.p0||[]),...(audit.failed||[])])reasons[reason]=(reasons[reason]||0)+1;
  if(samples.length<18)samples.push({seed,country:topic.country,intent:topic.intent,category:topic.category,words:audit.wordCount,ready:audit.productionReady,quality:audit.score,slug:article.slug.slice(0,70)});
  uniqueSlugs.add(article.slug);signatures.add(audit.signature);
}
wordCounts.sort((a,b)=>a-b);
console.log('OFFLINE_CONTENT_DIAG='+JSON.stringify({scanned:scope,eligible:wordCounts.length,low:wordCounts[0],p10:wordCounts[Math.floor(wordCounts.length*.1)],median:wordCounts[Math.floor(wordCounts.length*.5)],p90:wordCounts[Math.floor(wordCounts.length*.9)],high:wordCounts.at(-1),under1500:wordCounts.filter(x=>x<1500).length,over1900:wordCounts.filter(x=>x>1900).length,distinctSlugs:uniqueSlugs.size,distinctSignatures:signatures.size,reasons,samples}));
