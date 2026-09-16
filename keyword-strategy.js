const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const MONTHS_AR=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const freshness=()=>{const d=new Date();return `${MONTHS_AR[d.getUTCMonth()]} ${d.getUTCFullYear()}`};
const HIGH_VALUE_SCENARIOS=new Set(['وقت العروض','قبل الدفع','للطلب الأول','لحساب حالي','عند رفض الكود']);
function commercialFreshness(t,intent,s){
  if(intent!=='coupon')return '';
  if(!HIGH_VALUE_SCENARIOS.has(t.scenario)&&!HIGH_VALUE_SCENARIOS.has(s))return '';
  return freshness();
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
  const u=clean(t.useCase),f=clean(t.factor),parts=['compare','seller','value','finalprice','warranty'].includes(intent)?[f,u]:[u,f];
  return [...new Set(parts.filter(Boolean))].sort((a,b)=>a.length-b.length);
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
  return out;
}

const BUILDERS={
  coupon:(t,s)=>`كود خصم نون ${market(t)} على ${cat(t)} ${commercialFreshness(t,'coupon',s)} ${s}`,
  howto:(t,s)=>`استخدام كود نون ${market(t)} مع ${cat(t)} ${s}`,
  compare:(t,s)=>`مقارنة سعر ${cat(t)} على نون ${market(t)} ${s}`,
  trouble:(t,s)=>`كود نون لا يعمل على ${cat(t)} في ${market(t)} ${s}`,
  question:(t,s)=>`هل كود نون يعمل على ${cat(t)} في ${market(t)} ${s}`,
  seller:(t,s)=>`اختيار بائع ${cat(t)} على نون ${market(t)} ${s}`,
  decision:(t,s)=>`دليل شراء ${cat(t)} من نون ${market(t)} ${s}`,
  finalprice:(t,s)=>`سعر ${cat(t)} النهائي على نون ${market(t)} ${s}`,
  value:(t,s)=>`التوفير عند شراء ${cat(t)} من نون ${market(t)} ${s}`,
  cart:(t,s)=>`مراجعة سلة ${cat(t)} على نون ${market(t)} ${s}`,
  timing:(t,s)=>`متى تستخدم كود نون مع ${cat(t)} في ${market(t)} ${s}`,
  smartbuy:(t,s)=>`شراء ${cat(t)} من نون ${market(t)} بذكاء ${s}`,
  eligibility:(t,s)=>`شروط كود نون على ${cat(t)} في ${market(t)} ${s}`,
  checklist:(t,s)=>`قبل شراء ${cat(t)} من نون ${market(t)} ${s}`,
  multi:(t,s)=>`كود نون لشراء عدة منتجات ${cat(t)} في ${market(t)} ${s}`,
  returns:(t,s)=>`إرجاع ${cat(t)} وكوبون نون ${market(t)} ${s}`,
  warranty:(t,s)=>`ضمان ${cat(t)} وكوبون نون ${market(t)} ${s}`,
  budget:(t)=>`شراء ${cat(t)} من نون ${market(t)} بميزانية محددة`
};

function fitKeyword(raw,t,intent,s){
  let kw=clean(raw);
  if(kw.length<=70)return kw;
  const noScenario={
    coupon:`كود خصم نون ${market(t)} على ${cat(t)}`,howto:`استخدام كود نون ${market(t)} مع ${cat(t)}`,compare:`مقارنة سعر ${cat(t)} على نون ${market(t)}`,
    trouble:`حل مشكلة كود نون مع ${cat(t)} في ${market(t)}`,question:`هل كود نون يعمل على ${cat(t)} في ${market(t)}`,seller:`اختيار بائع ${cat(t)} على نون ${market(t)}`,
    decision:`دليل شراء ${cat(t)} من نون ${market(t)}`,finalprice:`سعر ${cat(t)} النهائي على نون ${market(t)}`,value:`التوفير في ${cat(t)} على نون ${market(t)}`,
    cart:`مراجعة سلة ${cat(t)} على نون ${market(t)}`,timing:`توقيت كود نون مع ${cat(t)} في ${market(t)}`,smartbuy:`شراء ${cat(t)} من نون ${market(t)} بذكاء`,
    eligibility:`شروط كود نون على ${cat(t)} في ${market(t)}`,checklist:`قبل شراء ${cat(t)} من نون ${market(t)}`,multi:`كود نون لعدة منتجات ${cat(t)} في ${market(t)}`,
    returns:`إرجاع ${cat(t)} وكوبون نون ${market(t)}`,warranty:`ضمان ${cat(t)} وكوبون نون ${market(t)}`,budget:`شراء ${cat(t)} من نون ${market(t)} بميزانية محددة`
  };
  kw=clean(noScenario[intent]||kw);
  return kw.length<=70?kw:kw.slice(0,70).replace(/\s+\S*$/,'');
}

export function applyKeywordStrategy(topic){
  const rawIntent=topic.intent,intent=effectiveIntent(topic),s=scenario(topic,intent),builder=BUILDERS[intent]||BUILDERS.decision;
  const baseKw=fitKeyword(builder(topic,s),topic,intent,s),kw=addSpecificity(baseKw,topic,intent,s),slug=slugify(kw),title=kw,words=kw.split(/\s+/).filter(Boolean).length;
  return {...topic,rawIntent,intent,intentLabel:INTENT_LABELS[intent]||topic.intentLabel||'دليل',kw,slug,title,keywordStrategy:'search-intent-v4-longtail',keywordWordCount:words,searchIntentFamily:intent};
}

export const KEYWORD_STRATEGY_INFO={version:'search-intent-v4-longtail',philosophy:'natural-query-first',markets:['SA','AE'],intents:Object.keys(BUILDERS),productIntentCompatibility:true,avoids:['keyword-stuffing','coupon-claim-invention','country-leakage','product-intent-mismatch'],maxRecommendedWords:14};
