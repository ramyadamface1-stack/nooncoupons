import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBulkTopic,buildUsefulArticle} from '../bulk-content-engine.js';
import {chooseBulkCandidateTopicSeed as pick} from '../bulk-candidate-diversity.js';
import {auditSeoArticle,preAuditSemanticGate} from '../quality-audit.js';
import {validateStructuredData} from '../schema-validator.js';
const strip=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const wc=html=>strip(html).split(/\s+/).filter(Boolean).length;
test('diagnose bounded Arabic article word window without publishing or storage IO',()=>{
 const result=[];
 for(let i=1;i<=18;i++){
  const cursor=12787530+i, seed=pick(cursor,i,{topicSpace:33177600,lowYield:true,previousYieldPct:0});
  const topic=buildBulkTopic(seed),article=buildUsefulArticle(topic,seed);
  const semanticPreflight=preAuditSemanticGate(article,[]);
  const audit=auditSeoArticle(article,topic,{minWords:1500,threshold:95,recent:[],semanticRecent:[],semanticPreflight});
  const schema=validateStructuredData(article);
  result.push({seed,market:topic.country,count:wc(article?.html),sections:(article?.html?.match(/data-diversity-frame=/g)||[]).length,quality:audit.score,productionReady:audit.productionReady,failed:audit.failed?.slice(0,3),schema:schema.pass,campaign:article?.html?.includes('campaign-search-context')});
 }
 assert.equal(result.filter(x=>x.count<1500||x.count>1900).length,0,'all 18 quality-gated Arabic article samples must fit 1500–1900 words');
 assert.ok(result.some(x=>x.sections>=3),'underlength templates should receive targeted decision context');
 console.log('ARABIC_WORD_WINDOW_DIAGNOSTIC '+JSON.stringify(result));
});
