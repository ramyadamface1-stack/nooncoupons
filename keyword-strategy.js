import {expandNoonTopic,NOON_TOPIC_EXPANSION_INFO} from './noon-topic-expansion.js';

const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const MONTHS_AR=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const freshness=()=>{const d=new Date();return `${MONTHS_AR[d.getUTCMonth()]} ${d.getUTCFullYear()}`};
const HIGH_VALUE_SCENARIOS=new Set(['وقت العروض','قبل الدفع','للطلب الأول','لحساب حالي','عند رفض الكود']);
const SEASONAL_INTENTS=new Set(['coupon','compare','finalprice','value','timing','smartbuy','eligibility','checklist','budget']);
function commercialFreshness(t,intent,s){
  if(intent==='coupon'&&(HIGH_VALUE_SCENARIOS.has(t.scenario)||HIGH_VALUE_SCENARIOS.has(s)))return freshness();
  if(SEASONAL_INTENTS.has(intent)&&t.seasonalTerm)return t.seasonalTerm;
  return '';
}

const SCENARIO_MAP={
  'قبل الدفع':'قبل الدفع','وقت العروض':'وقت العروض','مع الشحن':'مع الشحن','قبل اختيار البائع':'قبل اختيار البائع','عند مقارنة الأسعار':'عند مقارنة الأسعار',
  'بدون شراء زائد':'بدون شراء زائد','عند رفض الكود':'عند رفض الكود','مع سلة كبيرة':'مع سلة كبيرة','للطلب الأول':'للطلب الأول','لحساب حالي':'للحساب الحالي',
  'قبل تغيير طريقة الدفع':'قبل تغيير الدفع','قبل الإرجاع':'قبل الإرجاع','مع مراجعة الضمان':'مع مراجعة الضمان','عند شراء عدة قطع':'عند شراء عدة قطع',
  'من الهاتف':'من التطبيق','من المتصفح':'من المتصفح','عند تغير السعر':'عند تغير السعر','مع ميزانية محددة':'بميزانية محددة','مع أكثر من بائع':'مع عدة بائعين','بعد إضافة رسوم الشحن':'بعد رسوم الشحن'
};

const INTENT_LABELS={coupon:'كود خصم',howto:'استخدام كود',compare:'مقارنة سعر',trouble:'حل رفض الكود',question:'هل يعمل الكود',seller:'اختيار بائع',decision:'دليل شراء',finalprice:'السعر النهائي',value:'التوفير',cart:'مراجعة سلة',timing:'توقيت الكوبون',smartbuy:'شراء ذكي',eligibility:'شروط الكود',checklist:'خطوات قبل الدفع',multi:'شراء عدة منتجات',returns:'مراجعة الإرجاع',warranty:'فحص الضمان',budget:'اختيار بميزانية'};

const REMAP_BY_PROFILE={
  beauty:{warranty:'returns'},fashion:{warranty:'returns'},grocery:{warranty:'checklist',returns:'checklist'},kids:{warranty:'checklist'},baby:{warranty:'checklist'},
  home:{warranty:'decision'},kitchen:{warranty:'decision'},pets:{warranty:'checklist'},travel:{warranty:'decision'},fitness:{warranty:'decision'}
};

function effectiveIntent(t){return REMAP_BY_PROFILE[t.profileKey]?.[t.intent]||t.intent}
function scenario(t,intent){
  let s=SCENARIO_MAP[t.scenario]||clean(t.scenario);
  if(intent==='seller'&&/اختيار البائع/.test(s))s='عند مقارنة الأسعار';
  if(intent==='warranty'&&/مراجعة الضمان/.test(s))s='قبل الدفع';
  if(intent==='budget'&&/ميزانية/.test(s))s='قبل الدفع';
  return s;
}
function market(t){return clean(t.market)}
function cat(t){return clean(t.category)}
function specificityParts(t,intent){
  const u=clean(t.useCase),f=clean(t.factor),modifier=clean(t.queryModifier),base=['compare','seller','value','finalprice','warranty'].includes(intent)?[f,u]:[u,f];
  const natural=[...new Set(base.filter(Boolean))].sort((a,b)=>a.length-b.length);
  return [...new Set([modifier,...natural].filter(Boolean))];
}
function addSpecificity(kw,t,intent,s){
  let out=clean(kw),added=0;
  for(const part of specificityParts(t,intent)){
    if(out.includes(part)){added++;continue}
    const candidate=clean(`${out} ${part}`);
    if(candidate.length<=70){out=candidate;added++}
  }
  if(added)return out;
  const sc=clean(s);
  if(sc&&out.includes(sc)){
    const base=clean(out.replace(sc,' '));
    for(const part of specificityParts(t,intent)){
      const candidate=clean(`${base} ${part}`);
      if(candidate.length<=70)return candidate;
    }
  }
  const modifier=clean(t.queryModifier);
  if(modifier){
    const compact=clean(`${fitKeywordWithoutScenario(t,intent)} ${modifier}`);
    if(compact.length<=70)return compact;
  }
  return out;
}

const BUILDERS={
  coupon:(t,s)=>`كود خصم نون ${market(t)} على ${cat(t)} ${commercialFreshness(t,'coupon',s)} ${s}`,
  howto:(t,s)=>`استخدام كود نون ${market(t)} مع ${cat(t)} ${s}`,
  compare:(t,s)=>`مقارنة سعر ${cat(t)} على نون ${market(t)} ${commercialFreshness(t,'compare',s)} ${s}`,
  trouble:(t,s)=>`كود نون لا يعمل على ${cat(t)} في ${market(t)} ${s}`,
  question:(t,s)=>`هل كود نون يعمل على ${cat(t)} في ${market(t)} ${s}`,
  seller:(t,s)=>`اختيار بائع ${cat(t)} على نون ${market(t)} ${s}`,
  decision:(t,s)=>`دليل شراء ${cat(t)} من نون ${market(t)} ${s}`,
  finalprice:(t,s)=>`سعر ${cat(t)} النهائي على نون ${market(t)} ${commercialFreshness(t,'finalprice',s)} ${s}`,
  value:(t,s)=>`التوفير عند شراء ${cat(t)} من نون ${market(t)} ${commercialFreshness(t,'value',s)} ${s}`,
  cart:(t,s)=>`مراجعة سلة ${cat(t)} على نون ${market(t)} ${s}`,
  timing:(t,s)=>`متى تستخدم كود نون مع ${cat(t)} في ${market(t)} ${commercialFreshness(t,'timing',s)} ${s}`,
  smartbuy:(t,s)=>`شراء ${cat(t)} من نون ${market(t)} بذكاء ${commercialFreshness(t,'smartbuy',s)} ${s}`,
  eligibility:(t,s)=>`شروط كود نون على ${cat(t)} في ${market(t)} ${commercialFreshness(t,'eligibility',s)} ${s}`,
  checklist:(t,s)=>`قبل شراء ${cat(t)} من نون ${market(t)} ${commercialFreshness(t,'checklist',s)} ${s}`,
  multi:(t,s)=>`كود نون لشراء عدة منتجات ${cat(t)} في ${market(t)} ${s}`,
  returns:(t,s)=>`إرجاع ${cat(t)} وكوبون نون ${market(t)} ${s}`,
  warranty:(t,s)=>`ضمان ${cat(t)} وكوبون نون ${market(t)} ${s}`,
  budget:(t)=>`شراء ${cat(t)} من نون ${market(t)} بميزانية محددة ${commercialFreshness(t,'budget','')}`
};

const NO_SCENARIO_BUILDERS={
  coupon:t=>`كود خصم نون ${market(t)} على ${cat(t)}`,howto:t=>`استخدام كود نون ${market(t)} مع ${cat(t)}`,compare:t=>`مقارنة سعر ${cat(t)} على نون ${market(t)}`,
  trouble:t=>`حل مشكلة كود نون مع ${cat(t)} في ${market(t)}`,question:t=>`هل كود نون يعمل على ${cat(t)} في ${market(t)}`,seller:t=>`اختيار بائع ${cat(t)} على نون ${market(t)}`,
  decision:t=>`دليل شراء ${cat(t)} من نون ${market(t)}`,finalprice:t=>`سعر ${cat(t)} النهائي على نون ${market(t)}`,value:t=>`التوفير في ${cat(t)} على نون ${market(t)}`,
  cart:t=>`مراجعة سلة ${cat(t)} على نون ${market(t)}`,timing:t=>`توقيت كود نون مع ${cat(t)} في ${market(t)}`,smartbuy:t=>`شراء ${cat(t)} من نون ${market(t)} بذكاء`,
  eligibility:t=>`شروط كود نون على ${cat(t)} في ${market(t)}`,checklist:t=>`قبل شراء ${cat(t)} من نون ${market(t)}`,multi:t=>`كود نون لعدة منتجات ${cat(t)} في ${market(t)}`,
  returns:t=>`إرجاع ${cat(t)} وكوبون نون ${market(t)}`,warranty:t=>`ضمان ${cat(t)} وكوبون نون ${market(t)}`,budget:t=>`شراء ${cat(t)} من نون ${market(t)} بميزانية محددة`
};
function fitKeywordWithoutScenario(t,intent){
  const kw=clean((NO_SCENARIO_BUILDERS[intent]||NO_SCENARIO_BUILDERS.decision)(t));
  return kw.length<=70?kw:kw.slice(0,70).replace(/\s+\S*$/,'');
}
function fitKeyword(raw,t,intent,s){
  let kw=clean(raw);
  if(kw.length<=70)return kw;
  kw=fitKeywordWithoutScenario(t,intent);
  return kw.length<=70?kw:kw.slice(0,70).replace(/\s+\S*$/,'');
}

export function applyKeywordStrategy(topic){
  const expanded=expandNoonTopic(topic,topic.topicIndex??topic.diversitySeed??0),rawIntent=expanded.intent,intent=effectiveIntent(expanded),s=scenario(expanded,intent),builder=BUILDERS[intent]||BUILDERS.decision;
  const baseKw=fitKeyword(builder(expanded,s),expanded,intent,s),kw=addSpecificity(baseKw,expanded,intent,s),slug=slugify(kw),title=kw,words=kw.split(/\s+/).filter(Boolean).length;
  return {...expanded,rawIntent,intent,intentLabel:INTENT_LABELS[intent]||expanded.intentLabel||'دليل',kw,slug,title,keywordStrategy:'search-intent-v6-noon-hierarchy',keywordWordCount:words,searchIntentFamily:intent};
}

export const KEYWORD_STRATEGY_INFO={version:'search-intent-v6-noon-hierarchy',philosophy:'noon-category-to-product-hierarchy-with-seasonal-commercial-intent',markets:['SA','AE'],intents:Object.keys(BUILDERS),productIntentCompatibility:true,diversityModifier:true,seasonalKeywords:true,seasonalMonth:freshness(),topicExpansion:NOON_TOPIC_EXPANSION_INFO.version,avoids:['keyword-stuffing','coupon-claim-invention','country-leakage','product-intent-mismatch','title-intent-truncation'],maxRecommendedWords:16,maxKeywordCharacters:70};
