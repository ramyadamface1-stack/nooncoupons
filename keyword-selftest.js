import {buildBulkTopic,KEYWORD_STRATEGY_INFO} from './bulk-generator.js';

const seen=new Set();
const bad=[];
const rows=[];
const marketLabel=t=>t.country==='AE'?'الإمارات':'السعودية';
for(let i=0;i<160;i++){
  const t=buildBulkTopic(600000+i);
  const words=String(t.kw||'').trim().split(/\s+/).filter(Boolean).length;
  const problems=[];
  if(t.keywordStrategy!=='search-intent-v6-noon-hierarchy')problems.push('wrong_strategy');
  if(words<4||words>18)problems.push('keyword_length');
  if(!String(t.kw||'').includes(marketLabel(t)))problems.push('market_missing');
  if(!String(t.kw||'').includes(t.category))problems.push('category_missing');
  if(!t.slug)problems.push('slug_missing');
  if(/اختيار بائع[^\n]{0,80}قبل اختيار البائع/.test(t.kw))problems.push('seller_tautology');
  if(/ضمان[^\n]{0,80}مراجعة الضمان/.test(t.kw))problems.push('warranty_tautology');
  if(/ميزانية محددة[^\n]{0,80}ميزانية محددة/.test(t.kw))problems.push('budget_tautology');
  if(/\s{2,}/.test(t.kw))problems.push('double_space');
  if(['beauty','fashion'].includes(t.profileKey)&&t.intent==='warranty')problems.push('product_intent_mismatch');
  if(!t.categoryKey||!t.landingPath)problems.push('commerce_metadata_missing');
  if(!t.catalogLevel||!t.catalogTarget)problems.push('catalog_expansion_missing');
  if(t.brandKey&&!t.landingPath.includes('/brand/')&&!t.landingPath.includes('/model/')&&!t.landingPath.includes('/compare/'))problems.push('brand_route_mismatch');
  seen.add(t.slug);
  rows.push({cursor:600000+i,keyword:t.kw,intent:t.intent,profile:t.profileKey,words,market:t.market,country:t.country,categoryKey:t.categoryKey,catalogLevel:t.catalogLevel,catalogTarget:t.catalogTarget,seasonalTerm:t.seasonalTerm,brandKey:t.brandKey,modelKey:t.modelKey,landingPath:t.landingPath,problems});
  if(problems.length)bad.push(rows.at(-1));
}
console.log(JSON.stringify({strategy:KEYWORD_STRATEGY_INFO,total:rows.length,uniqueSlugs:seen.size,badCount:bad.length,bad:bad.slice(0,20),samples:rows.slice(0,12)},null,2));
if(KEYWORD_STRATEGY_INFO.version!=='search-intent-v6-noon-hierarchy')throw new Error('wrong_keyword_strategy_version');
const uniqueRatio=seen.size/rows.length;
if(uniqueRatio<0.65)throw new Error('keyword_diversity_too_low:'+uniqueRatio.toFixed(3));
if(bad.length)throw new Error('keyword_quality_failures:'+bad.length);
console.log(`KEYWORD_SELFTEST_PASS total=${rows.length} unique=${seen.size} diversity=${uniqueRatio.toFixed(3)} strategy=${KEYWORD_STRATEGY_INFO.version}`);
