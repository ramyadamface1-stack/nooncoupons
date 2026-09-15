import {buildBulkTopic,buildUsefulArticle,BULK_ENGINE_INFO} from './bulk-generator.js';
import {auditSeoArticle} from './quality-audit.js';
import {emptyCluster,globalGate,pickRelated,injectContextualLinks,addToCluster,clusterKey,GLOBAL_INDEX_INFO} from './quality-index.js';
import {couponStatus,injectCouponFreshness,COUPON_REGISTRY_INFO} from './coupon-registry.js';
import {validateStructuredData,SCHEMA_GATE_INFO} from './schema-validator.js';

const cfg={minWords:1000,qualityThreshold:95,targetWords:1500};
const recent=[];
const clusters=new Map();
let ready=0,rejected=0,minScore=100,maxScore=0,minWords=99999,maxWords=0,firstAccepted=null;
const groupMins={};

for(let n=0;n<40;n++){
  const cursor=500000+n;
  const topic=buildBulkTopic(cursor);
  const coupon=couponStatus(topic,new Date('2026-09-15T12:00:00Z'));
  if(!coupon.publishAllowed)throw new Error('known_coupon_not_publishable:'+topic.code);
  const ck=clusterKey(topic),cluster=clusters.get(ck)||emptyCluster(topic);
  const links=pickRelated(cluster,topic,6);
  let article=injectCouponFreshness(buildUsefulArticle(topic,cursor),coupon);
  article=injectContextualLinks(article,links);
  const schemaGate=validateStructuredData(article);
  if(!schemaGate.pass)throw new Error('schema_gate_failed:'+JSON.stringify(schemaGate));
  const auditRecent=[...(cluster.entries||[]),...recent];
  const audit=auditSeoArticle(article,topic,{...cfg,recent:auditRecent});
  const gg=globalGate(article,topic,audit,{entries:auditRecent});
  const productionReady=audit.productionReady&&gg.pass&&schemaGate.pass;
  const row={cursor,country:topic.country,category:topic.category,intent:topic.intent,keyword:topic.kw,score:audit.score,floor:audit.groupFloor,wordCount:audit.wordCount,productionReady,p0:audit.p0,failed:audit.failed,globalReasons:gg.reasons,minSignatureDistance:Math.min(audit.minSignatureDistance,gg.minDistance),groups:audit.groups,links:links.length,schemaBlocks:schemaGate.blocks,faqQuestions:schemaGate.faqQuestions};
  console.log(JSON.stringify(row));
  if(productionReady){
    ready++;
    minScore=Math.min(minScore,audit.score);maxScore=Math.max(maxScore,audit.score);
    minWords=Math.min(minWords,audit.wordCount);maxWords=Math.max(maxWords,audit.wordCount);
    if(audit.score<95||audit.groupFloor<88||audit.p0.length||audit.wordCount<1000||audit.wordCount>2000)throw new Error('production_ready_invariant_failed:'+JSON.stringify(row));
    for(const [g,v] of Object.entries(audit.groups))groupMins[g]=Math.min(groupMins[g]??100,v);
    const rec={slug:article.slug,title:article.title,primaryKeyword:article.primaryKeyword,signature:audit.signature,country:topic.country,createdAt:new Date().toISOString()};
    addToCluster(cluster,rec,topic);clusters.set(ck,cluster);
    recent.unshift({...rec,blueprint:article.blueprint});if(recent.length>300)recent.pop();
    if(!firstAccepted)firstAccepted={article,topic,audit,cluster};
  }else{
    rejected++;
    if(!audit.failed.length&&!gg.reasons.length)throw new Error('rejected_without_reason:'+cursor);
  }
}

if(!firstAccepted)throw new Error('no_accepted_sample');
const duplicateGate=globalGate(firstAccepted.article,firstAccepted.topic,firstAccepted.audit,firstAccepted.cluster);
if(duplicateGate.pass||!duplicateGate.reasons.some(x=>/duplicate/.test(x)))throw new Error('global_duplicate_gate_failed:'+JSON.stringify(duplicateGate));

const badCoupon=couponStatus({...firstAccepted.topic,code:'BAD000'},new Date('2026-09-15T12:00:00Z'));
if(badCoupon.publishAllowed||badCoupon.reason!=='coupon_not_in_registry')throw new Error('unknown_coupon_gate_failed');
const staleCoupon=couponStatus(firstAccepted.topic,new Date('2026-10-20T12:00:00Z'));
if(staleCoupon.publishAllowed||staleCoupon.reason!=='coupon_registry_stale')throw new Error('coupon_freshness_expiry_failed:'+JSON.stringify(staleCoupon));

const linked=injectContextualLinks({...firstAccepted.article,html:firstAccepted.article.html},[{slug:'related-one',title:'دليل مرتبط أول',primaryKeyword:'دليل مرتبط أول',country:firstAccepted.topic.country,category:firstAccepted.topic.category,intent:'compare'},{slug:'related-two',title:'دليل مرتبط ثان',primaryKeyword:'دليل مرتبط ثان',country:firstAccepted.topic.country,category:firstAccepted.topic.category,intent:'howto'}]);
if(!/class="contextual-links"/.test(linked.html)||!/articles\/related-one/.test(linked.html))throw new Error('contextual_link_injection_failed');

const brokenSchema={...firstAccepted.article,html:firstAccepted.article.html.replace(/"@type":"FAQPage"/,'"@type":FAQPage')};
if(validateStructuredData(brokenSchema).pass)throw new Error('invalid_schema_was_not_blocked');

console.log(JSON.stringify({engine:BULK_ENGINE_INFO,globalIndex:GLOBAL_INDEX_INFO,couponRegistry:COUPON_REGISTRY_INFO,schemaGate:SCHEMA_GATE_INFO,ready,rejected,minScore,maxScore,minWords,maxWords,groupMins,clusters:clusters.size},null,2));
if(BULK_ENGINE_INFO.topicSpace<1000000)throw new Error('topic_space_too_small');
if(BULK_ENGINE_INFO.blueprints<10)throw new Error('blueprint_diversity_too_small');
if(ready<28)throw new Error('too_few_quality_articles:'+ready);
if(minScore<95)throw new Error('score_below_95:'+minScore);
if(Math.min(...Object.values(groupMins))<88)throw new Error('group_floor_below_88');
console.log(`READY_COUNT=${ready}/40 REJECTED=${rejected} MIN_SCORE=${minScore} MAX_SCORE=${maxScore} WORDS=${minWords}-${maxWords} GLOBAL_INDEX_V=${GLOBAL_INDEX_INFO.version} COUPON_REGISTRY=${COUPON_REGISTRY_INFO.version} SCHEMA_GATE_V=${SCHEMA_GATE_INFO.version}`);
