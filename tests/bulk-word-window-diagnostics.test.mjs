import test from 'node:test';
import {buildBulkTopic,buildUsefulArticle} from '../bulk-content-engine.js';
import {chooseBulkCandidateTopicSeed as pick} from '../bulk-candidate-diversity.js';
const strip=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const wc=html=>strip(html).split(/\s+/).filter(Boolean).length;
test('diagnose bounded Arabic article word window without publishing or storage IO',()=>{
 const result=[];
 for(let i=1;i<=18;i++){
  const cursor=12787530+i, seed=pick(cursor,i,{topicSpace:33177600,lowYield:true,previousYieldPct:0});
  const topic=buildBulkTopic(seed),article=buildUsefulArticle(topic,seed);
  result.push({seed,market:topic.country,count:wc(article?.html),sections:(article?.html?.match(/data-diversity-frame=/g)||[]).length,campaign:article?.html?.includes('campaign-search-context')});
 }
 console.log('ARABIC_WORD_WINDOW_DIAGNOSTIC '+JSON.stringify(result));
});
