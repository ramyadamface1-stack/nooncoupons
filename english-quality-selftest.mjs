import {buildBulkTopic,buildEnglishNativeCandidate,buildEnglishUsefulArticle} from './bulk-content-engine.js';
import {auditEnglishSeoArticle} from './quality-audit.js';

const samples=[],rejections={notReady:0,duplicateKeyword:0,duplicateIntentProfile:0};
let cursor=760000,attempts=0;
while(samples.length<24&&attempts<12000){
 const topic=buildBulkTopic(cursor++,{forceCountry:'AE',independentPriority:true});
 const candidate=buildEnglishNativeCandidate(topic);
 attempts++;
 if(!candidate||candidate.country!=='AE')continue;
 if(samples.some(x=>x.article.primaryKeyword===candidate.nativeKeyword)){rejections.duplicateKeyword++;continue}
 if(samples.some(x=>x.candidate.intent===candidate.intent&&x.candidate.profileKey===candidate.profileKey)){rejections.duplicateIntentProfile++;continue}
 const article=buildEnglishUsefulArticle(candidate,cursor);
 const audit=auditEnglishSeoArticle(article,candidate,{recent:samples.map(x=>({signature:x.audit.signature,plain:x.audit.plain,primaryKeyword:x.article.primaryKeyword,slug:x.article.slug})),threshold:95});
 if(!audit.productionReady||audit.minJaccardDistance<0.18){rejections.notReady++;continue}
 samples.push({candidate,article,audit});
}
if(samples.length<24)throw new Error('EN_UAE_PRODUCTION_READY_COVERAGE_TOO_LOW '+samples.length+' attempts='+attempts+' rejections='+JSON.stringify(rejections));
const intentCoverage=new Set(samples.map(x=>x.candidate.intent));
if(intentCoverage.size<5)throw new Error('EN_INTENT_COVERAGE_TOO_LOW '+intentCoverage.size);
if(samples.some(x=>x.candidate.country!=='AE'))throw new Error('EN_NON_UAE_SAMPLE');
if(samples.some(x=>x.audit.score<95||x.audit.minJaccardDistance<0.18||!x.audit.productionReady))throw new Error('EN_QUALITY_GATE_BYPASS');
const summary={samples:samples.length,attempts,rejections,intentCoverage:intentCoverage.size,minScore:Math.min(...samples.map(x=>x.audit.score)),minWords:Math.min(...samples.map(x=>x.audit.wordCount)),maxWords:Math.max(...samples.map(x=>x.audit.wordCount)),minJaccardDistance:Math.min(...samples.map(x=>x.audit.minJaccardDistance)),minEnglishRatio:Math.min(...samples.map(x=>x.audit.englishRatio)),goldenCount:samples.filter(x=>String(x.candidate.keywordTier||'').startsWith('uae-golden-commercial')).length,tiers:[...new Set(samples.map(x=>x.candidate.keywordTier).filter(Boolean))],distanceDistribution:samples.map(x=>({keyword:x.article.primaryKeyword,tier:x.candidate.keywordTier,distance:x.audit.minJaccardDistance,simhashDistance:x.audit.minSignatureDistance}))};
console.log(JSON.stringify(summary,null,2));
console.log('ENGLISH_ARTICLE_QUALITY=PASS');
