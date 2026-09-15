const norm=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const words=s=>norm(s).split(' ').filter(x=>x.length>1);
const STOP=new Set(['من','في','على','الى','إلى','عن','مع','نون','كود','خصم','السعودية','الامارات','الإمارات','شراء','طريقة','دليل','استخدام']);
const meaningful=s=>new Set(words(s).filter(x=>!STOP.has(x)));

function coverage(article,topic){
  const text=norm(String(article?.html||'').replace(/<[^>]+>/g,' '));
  const signals=[topic?.category,topic?.intentLabel,topic?.useCase,topic?.factor,topic?.scenario].filter(Boolean);
  const hit=signals.filter(x=>{const t=meaningful(x);if(!t.size)return false;let n=0;for(const w of t)if(text.includes(w))n++;return n/t.size>=0.6}).length;
  return signals.length?hit/signals.length:0;
}

export function evaluateIndexation(article,topic,{globalGate=null,contextualLinks=0,clusterSize=0,schemaGate=null,coupon=null}={}){
  const reasons=[];
  const kwTokens=meaningful(article?.primaryKeyword||topic?.kw||'');
  const intentSpecificity=Math.min(1,kwTokens.size/7);
  const topicCoverage=coverage(article,topic);
  const matureCluster=Number(clusterSize||0)>=4;
  const linkSupport=matureCluster?Math.min(1,Number(contextualLinks||0)/3):1;
  const independence=globalGate?.pass?1:0;
  const schema=(!schemaGate||schemaGate.pass)?1:0;
  const fresh=coupon?.publishAllowed?1:0;
  const score=Math.round((intentSpecificity*20+topicCoverage*25+linkSupport*10+independence*25+schema*10+fresh*10)*10)/10;

  if(kwTokens.size<4)reasons.push('intent_too_broad');
  if(topicCoverage<0.8)reasons.push('insufficient_information_gain');
  if(!globalGate?.pass)reasons.push('not_independent_from_existing_content');
  if(schemaGate&&!schemaGate.pass)reasons.push('schema_not_valid');
  if(!coupon?.publishAllowed)reasons.push('coupon_not_fresh_enough');
  if(matureCluster&&Number(contextualLinks||0)<2)reasons.push('weak_cluster_support');
  if(score<85)reasons.push('indexation_value_below_threshold');

  return {indexable:reasons.length===0,score,reasons,intentSpecificity:Math.round(intentSpecificity*1000)/1000,topicCoverage:Math.round(topicCoverage*1000)/1000,contextualLinks:Number(contextualLinks||0),clusterSize:Number(clusterSize||0),matureCluster,policy:'independent-intent-information-gain-v1'};
}

export const INDEXATION_GATE_INFO={version:1,minScore:85,minMeaningfulKeywordTokens:4,minTopicCoverage:0.8,minContextualLinksWhenMature:2,matureClusterSize:4,policy:'independent-intent-information-gain-v1'};
