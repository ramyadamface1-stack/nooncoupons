import {buildProgrammaticArticle} from './bulk-generator.js';
import {pickTopic,auditGenerated} from './generator-core-v2.js';

const cfg={minWords:1000,qualityThreshold:95,targetWords:1500};
let ready=0;
for(let cursor=0;cursor<12;cursor++){
  const topic=pickTopic({articles:[]},cursor);
  const article=buildProgrammaticArticle(topic,cursor);
  const audit=auditGenerated(article,topic,cfg);
  const failed=audit.checks.filter(x=>!x.pass).map(x=>x.name);
  console.log(JSON.stringify({cursor,country:topic.country,keyword:topic.kw,score:audit.score,wordCount:audit.wordCount,productionReady:audit.productionReady,failed},null,0));
  if(audit.productionReady)ready++;
}
console.log('READY_COUNT='+ready+'/12');
if(ready<10)process.exitCode=2;
