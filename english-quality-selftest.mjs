import {buildBulkTopic,buildEnglishNativeCandidate,buildEnglishUsefulArticle} from './bulk-content-engine.js';
import {auditEnglishSeoArticle} from './quality-audit.js';

const samples=[];
let cursor=0,attempts=0;
while(samples.length<24&&attempts<5000){
 const topic=buildBulkTopic(cursor++);
 const candidate=buildEnglishNativeCandidate(topic);
 attempts++;
 if(!candidate)continue;
 const article=buildEnglishUsefulArticle(candidate,cursor);
 const audit=auditEnglishSeoArticle(article,candidate,{recent:samples.map(x=>({signature:x.audit.signature,primaryKeyword:x.article.primaryKeyword,slug:x.article.slug}))});
 samples.push({candidate,article,audit});
}
if(samples.length<20)throw new Error('EN_SAMPLE_COVERAGE_TOO_LOW '+samples.length);
const bad=samples.filter(x=>!x.audit.productionReady);
const summary={samples:samples.length,attempts,minScore:Math.min(...samples.map(x=>x.audit.score)),minWords:Math.min(...samples.map(x=>x.audit.wordCount)),maxWords:Math.max(...samples.map(x=>x.audit.wordCount)),minEnglishRatio:Math.min(...samples.map(x=>x.audit.englishRatio)),failures:bad.map(x=>({keyword:x.article.primaryKeyword,score:x.audit.score,words:x.audit.wordCount,p0:x.audit.p0,failed:x.audit.failed,groups:x.audit.groups}))};
console.log(JSON.stringify(summary,null,2));
if(bad.length)process.exit(1);
console.log('ENGLISH_ARTICLE_QUALITY=PASS');
