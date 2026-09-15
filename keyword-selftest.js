import {buildBulkTopic,KEYWORD_STRATEGY_INFO} from './bulk-generator.js';

const seen=new Set();
const bad=[];
const rows=[];
for(let i=0;i<160;i++){
  const t=buildBulkTopic(600000+i);
  const words=String(t.kw||'').trim().split(/\s+/).filter(Boolean).length;
  const problems=[];
  if(t.keywordStrategy!=='search-intent-v2')problems.push('wrong_strategy');
  if(words<4||words>14)problems.push('keyword_length');
  if(!String(t.kw||'').includes(t.market))problems.push('market_missing');
  if(!String(t.kw||'').includes(t.category))problems.push('category_missing');
  if(!t.slug||seen.has(t.slug))problems.push('duplicate_slug');
  if(/اختيار بائع[^\n]{0,80}قبل اختيار البائع/.test(t.kw))problems.push('seller_tautology');
  if(/ضمان[^\n]{0,80}مراجعة الضمان/.test(t.kw))problems.push('warranty_tautology');
  if(/ميزانية محددة[^\n]{0,80}ميزانية محددة/.test(t.kw))problems.push('budget_tautology');
  if(/\s{2,}/.test(t.kw))problems.push('double_space');
  if(['beauty','fashion'].includes(t.profileKey)&&t.intent==='warranty')problems.push('product_intent_mismatch');
  seen.add(t.slug);
  rows.push({cursor:600000+i,keyword:t.kw,intent:t.intent,profile:t.profileKey,words,problems});
  if(problems.length)bad.push(rows.at(-1));
}
console.log(JSON.stringify({strategy:KEYWORD_STRATEGY_INFO,total:rows.length,uniqueSlugs:seen.size,badCount:bad.length,bad:bad.slice(0,20),samples:rows.slice(0,12)},null,2));
if(KEYWORD_STRATEGY_INFO.version!=='search-intent-v2')throw new Error('wrong_keyword_strategy_version');
if(bad.length)throw new Error('keyword_quality_failures:'+bad.length);
console.log(`KEYWORD_SELFTEST_PASS total=${rows.length} unique=${seen.size} strategy=${KEYWORD_STRATEGY_INFO.version}`);
